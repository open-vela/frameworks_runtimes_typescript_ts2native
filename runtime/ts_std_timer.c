#include <stdlib.h>
#include <alloca.h>

#include "ts_std.h"
#include "ts_lang.h"
#include "ts_std_timer_internal.h"

#include "heap-inl.h"

typedef struct _ts_timer_node_t {
  struct heap_node node;
  ts_object_t*  callback;
  uint64_t      timeout;
  uint64_t      repeat; // repeat timeout
  uint32_t      timer_id;
  uint32_t      handle_timer:1; // on timeout
  uint32_t      clear_timer:1; // fire timeout
  uint32_t      flags:30;
  ts_value_t    params[1]; // the params, count and values
} ts_timer_node_t;

static void reset_timer_timeout(ts_runtime_t* rt, ts_timer_node_t* node, uint64_t timeout) {
  uint64_t clamped_timeout =
	     rt->std_backend.get_current_timeout(rt->std_backend.backend_data) 
	     + timeout;
  if (clamped_timeout < timeout)
     clamped_timeout = (uint64_t)-1;

  node->timeout = clamped_timeout;
}

static ts_timer_node_t* new_timer_node(ts_runtime_t* rt,
		ts_object_t* callback,
		uint64_t timeout,
		ts_boolean_t is_repeat,
		uint64_t timer_id,
		int64_t param_count,
		const ts_value_t* params) {

  ts_timer_node_t* node = (ts_timer_node_t*)malloc(
		  sizeof(ts_timer_node_t) +
		  TS_GET_ARG_COUNT(param_count) * sizeof(ts_value_t));

  node->callback = ts_object_add_ref(callback);

  reset_timer_timeout(rt, node, timeout);

  node->repeat = is_repeat ? timeout : 0;
  node->timer_id = timer_id;
  node->params[0].lval = param_count;
  node->handle_timer = 0;
  node->clear_timer = 0;
  node->flags = 0;

  for (uint32_t i = 0; i < TS_GET_ARG_COUNT(param_count); i ++) {
    if (TS_CHECK_ARG_IS_OBJECT(param_count, i)) {
      node->params[i+1].object = ts_object_add_ref(params[i].object);
    } else {
      node->params[i+1].lval = params[i].lval;
    }
  }

  return node;
}

static void free_timer_node(ts_timer_node_t* node) {
  if (!node) {
    return ;
  }
  if (node->callback) {
    ts_object_release(node->callback);
  }

  if (TS_ARG_HAS_OBJECTS(node->params)) {
    for (uint32_t i = 0; i < TS_ARG_COUNT(node->params); i ++) {
      if (TS_ARG_IS_OBJECT(node->params, i)) {
        ts_object_release(TS_ARG_OBJECT(node->params, i));
      }
    }
  }

  free(node);
}

static int timer_less_than(const struct heap_node* a, const struct heap_node* b) {
  ts_timer_node_t* node_a = (ts_timer_node_t*)a;
  ts_timer_node_t* node_b = (ts_timer_node_t*)b;

  if (node_a->timeout < node_b->timeout)
    return 1;
  if (node_a->timeout > node_b->timeout)
    return 0;

  return node_a->timer_id < node_b->timer_id;
}

static void heap_node_visit(struct heap_node* node, void (*visit)(ts_timer_node_t*, void*), void* user_data) {
  if (node) {
    heap_node_visit(node->left, visit, user_data);
    heap_node_visit(node->right, visit, user_data);
    visit((ts_timer_node_t*)node, user_data);
  }
}

typedef struct _ts_std_timer_t {
  ts_object_t base;
  struct heap timer_heap;
  uint32_t timer_sequence;
} ts_std_timer_t;

static int _ts_std_timer_add_timeout(ts_std_timer_t* self, ts_boolean_t repeat, ts_argument_t args, ts_return_t ret) {
  int count = TS_ARG_COUNT(args);

  ts_runtime_t* rt = ts_runtime_from_object(&self->base);
  ts_timer_node_t* node = new_timer_node(rt,
	(ts_object_t*)TS_ARG_OBJECT(args, 0),
	count > 1 ? TS_ARG_INT64(args, 1) : 0l,
	repeat,
	++ self->timer_sequence,
	count > 2 ? count - 2 : 0, 
	count > 2 ? &TS_GET_ARG(args, 2) : NULL);

  rt->std_backend.set_next_timeout(node->timeout, rt->std_backend.backend_data);
  heap_insert(&self->timer_heap, &node->node, timer_less_than);
  TS_RETURN_PTR(ret, node);
  return 0;
}

static int _ts_std_timer_clear_timeout(ts_std_timer_t* self, ts_argument_t args, ts_return_t ret) {
  ts_timer_node_t* node = TS_ARG_PTR(args, 0);
  if (node) {
    if (node->handle_timer) {
      node->clear_timer = 1;
    }
    else {
      heap_remove(&self->timer_heap, &node->node, timer_less_than);
      free_timer_node(node);
    }
  }
}


static int _ts_std_timer_setTimeout(ts_object_t* self, ts_argument_t args, ts_return_t ret) {
  return _ts_std_timer_add_timeout((ts_std_timer_t*)self, ts_false, args, ret);
}

static int _ts_std_timer_clearTimeout(ts_object_t* self, ts_argument_t args, ts_return_t ret) {
  return _ts_std_timer_clear_timeout((ts_std_timer_t*)self, args, ret);
}


static int _ts_std_timer_setInterval(ts_object_t* self, ts_argument_t args, ts_return_t ret) {
  return _ts_std_timer_add_timeout((ts_std_timer_t*)self, ts_true, args, ret);
}

static int _ts_std_timer_clearInterval(ts_object_t* self, ts_argument_t args, ts_return_t ret) {
  return _ts_std_timer_clear_timeout((ts_std_timer_t*)self, args, ret);
}

static int _std_timer_constructor(ts_object_t* self, ts_argument_t args, ts_return_t ret) {
  ts_std_timer_t* timer = (ts_std_timer_t*)self;

  heap_init(&timer->timer_heap);
  timer->timer_sequence = 0;

  return 0;
}

static void _visit_free_timer_node(ts_timer_node_t* node, void* data) {
  free_timer_node(node);
}

static void _std_timer_destroy(ts_object_t* self) {
  ts_std_timer_t* timer = (ts_std_timer_t*)self;
  // visit the heap_node
  heap_node_visit(heap_min(&timer->timer_heap), _visit_free_timer_node, NULL);
}

static void _gc_visit_timer_node(ts_timer_node_t* timer_node, void* data) {
  void** pdatas = (void**)data;
  ts_object_visitor_t visitor = (ts_object_visitor_t)pdatas[0];
  visitor(timer_node->callback, pdatas[1]);

  if (TS_ARG_HAS_OBJECTS(timer_node->params)) {
    for (uint32_t i = 0; i < TS_ARG_COUNT(timer_node->params); i ++) {
      if (TS_ARG_IS_OBJECT(timer_node->params, i)) {
        visitor(TS_ARG_OBJECT(timer_node->params, i), pdatas[1]);
      }
    }
  }
}

static void _std_timer_gc_visit(ts_object_t* self, ts_object_visitor_t visitor, void* user_data) {
  ts_std_timer_t* timer = (ts_std_timer_t*)self;
  
  void* datas[2] = {visitor, user_data};
  heap_node_visit(heap_min(&timer->timer_heap), _gc_visit_timer_node, (void*)datas);
}

static TS_VTABLE_DEF(_std_timer_vt, 4) = {
  TS_VTABLE_BASE(
    sizeof(ts_std_timer_t),
    "timer",
    0,
    4, // member count
    _std_timer_constructor,
    _std_timer_destroy,
    NULL, // to string
    _std_timer_gc_visit
  ),
  {
    {.method = _ts_std_timer_setTimeout},
    {.method = _ts_std_timer_clearTimeout},
    {.method = _ts_std_timer_setInterval},
    {.method = _ts_std_timer_clearInterval}
  }
};

static void _std_timer_fire(ts_timer_node_t* node) {
  if (!node || !node->callback)
    return;

  ts_value_t ret;
  ts_function_call(node->callback, node->params, &ret);
}

static void _ts_std_timer_on_timeout(ts_runtime_t* rt, uint64_t timeout) {
  ts_std_timer_t* timer = (ts_std_timer_t*)ts_module_object_of(rt->std_module, ts_std_timer_index);  

  ts_timer_node_t* node = (ts_timer_node_t*)heap_min(&timer->timer_heap);
  if (node->timeout <= timeout) {
    // remove node first
    heap_remove(&timer->timer_heap, &node->node, timer_less_than);

    node->handle_timer = 1;
    _std_timer_fire(node);
    node->handle_timer = 0;

    if (!node->clear_timer && node->repeat) {
      reset_timer_timeout(rt, node, node->repeat); 
      heap_insert(&timer->timer_heap, &node->node, timer_less_than);
    } else {
      free_timer_node(node);
    }

    ts_timer_node_t* min_node = (ts_timer_node_t*)(heap_min(&timer->timer_heap));
    if (min_node) {
      rt->std_backend.set_next_timeout( min_node->timeout, rt->std_backend.backend_data);
    }
  }
}

ts_vtable_t* ts_get_std_timer_vtable() {
  return &_std_timer_vt.base;
}

void ts_init_std_timer_backend(ts_runtime_t* rt) {
  rt->std_backend.on_timeout = _ts_std_timer_on_timeout;
}
