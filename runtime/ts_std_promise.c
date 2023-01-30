
#include <stdlib.h>

#include "ts_runtime.h"
#include "ts_std.h"
#include "ts_lang.h"

typedef struct _ts_std_promise_t ts_std_promise_t;
typedef struct _ts_std_resolver_t ts_std_resolver_t;
typedef struct _ts_std_resolve_entry_t ts_std_resolve_entry_t;
typedef ts_std_resolver_t ts_std_rejecter_t;

static ts_object_t* ts_std_promise_new_resolver(ts_runtime_t* rt, ts_std_promise_t* self);
static ts_object_t* ts_std_promise_new_rejecter(ts_runtime_t* rt, ts_std_promise_t* self);
static void ts_std_promise_async_resolve(ts_std_promise_t* self);
static void ts_std_free_resolves(ts_std_resolve_entry_t* entries);
static void ts_std_promise_insert_then(ts_std_promise_t* promise, ts_std_promise_t* then);
static void ts_std_promise_insert_resolve(ts_std_promise_t* promise, ts_std_promise_t* then, ts_object_t* on_resolved, ts_object_t* on_rejected, ts_object_t* on_finally);

typedef enum _ts_std_promise_state_t {
  ts_std_promise_pending,
  ts_std_promise_fulfiled,
  ts_std_promise_rejected
} ts_std_promise_state_t;

typedef enum _ts_std_resolve_type_t {
  ts_std_on_resolve,
  ts_std_on_reject,
  ts_std_on_finally,
} ts_std_resolve_type_t;

struct _ts_std_promise_t {
  ts_object_t base;
  uint32_t state: 16;  // ts_std_promise_state_t
  uint32_t resolved_type: 16; // ts_value_type_t
 
  ts_value_t   result;  // the result of resovled or reject
  
  ts_std_task_t  resolve_task;
  ts_std_resolve_entry_t*  resolves;
};

struct _ts_std_resolver_t {
  ts_object_t base;
  ts_std_promise_t*  owner_promise;
};

struct _ts_std_resolve_entry_t {
  ts_object_t* on_fulfiled;
  ts_object_t* on_finally;
  ts_object_t* on_rejected;
  ts_std_promise_t* then;
  ts_std_resolve_entry_t* next;
};

static void _promise_process_resolve(ts_std_promise_t* promise, ts_std_resolve_entry_t* resolve) {
  // call resolve
  ts_value_t ret;
  ts_value_type_t ret_type;

  ts_object_t* callback = resolve->on_finally;

  if (promise->state == ts_std_promise_fulfiled)
    callback = resolve->on_fulfiled;
  else if (promise->state == ts_std_promise_rejected)
    callback = resolve->on_rejected;

  if (callback && callback == resolve->on_finally) {
    ts_function_call(callback, NULL, NULL);
    return;
  }

  ts_std_promise_t* next_promise = resolve->then;
  if (callback) {
    do {
      TS_DEF_ARGUMENTS(1);
      if (promise->resolved_type == ts_value_object)
        TS_SET_OBJECT_ARG(promise->result.object);
      else
        TS_SET_LONG_ARG(promise->result.lval);

      ts_function_call(callback, TS_ARGUMENTS, &ret);
      ret_type = ts_function_return_type(callback);
    } while(0);
  } else if (next_promise) {
    ret.lval = promise->result.lval;
    ret_type = promise->resolved_type;
    next_promise->state = promise->state;
  }

  if (!next_promise) {
    if (ret_type == ts_value_object || !ts_object_is_promise(ret.object))
      ts_object_release(ret.object);
    return;
  }

  ts_object_add_ref(&next_promise->base);
  if (ret_type != ts_value_object || !ts_object_is_promise(ret.object)) {
    next_promise->result.lval = ret.lval;
    next_promise->resolved_type = ret_type;
    next_promise->state = promise->state;
    ts_std_promise_async_resolve(next_promise);
  } else {
    ts_std_promise_t* ret_promise = (ts_std_promise_t*)(ret.object);
    ts_std_promise_insert_then(ret_promise, next_promise);
  }
}

static int _func_impl_std_promise_resolver_rejecter(ts_object_t* self, ts_argument_t args, ts_return_t ret) {
  ts_std_resolver_t* thiz = (ts_std_resolver_t*)self;
  ts_std_promise_t*  promise = thiz->owner_promise;

  if (TS_ARG_COUNT(args) == 0) {
    promise->result.object = NULL;
    promise->resolved_type = ts_value_object;
  } else {
    promise->result.lval = TS_ARG_INT64(args, 0);
    promise->resolved_type = TS_ARG_IS_OBJECT(args, 0) ? ts_value_object : ts_value_int64;
  }

  if (ts_object_is_resolver(self))
    promise->state = ts_std_promise_fulfiled;
  else
    promise->state = ts_std_promise_rejected;
  
  ts_std_promise_async_resolve(promise);
  return 0;
}

static int _std_promise_resolver_rejecter_constructor(ts_std_resolver_t* self, ts_argument_t args, ts_return_t ret) {
  if (args && TS_ARG_COUNT(args) > 0 && TS_ARG_IS_OBJECT(args, 0)) {
    self->owner_promise = (ts_std_promise_t*)ts_object_add_ref(TS_ARG_OBJECT(args, 0));
  }
}

static int _std_promise_resolver_rejecter_destroy(ts_std_resolver_t* self) {
  if (self->owner_promise)
    ts_object_release(&self->owner_promise->base);
}

static int _std_promise_resolver_rejecter_gc_visit(ts_std_resolver_t* self, ts_object_visitor_t visit, void* user_data) {
  if (self->owner_promise)
    visit(&self->owner_promise->base, user_data);
}

static ts_object_t* ts_std_promise_new_resolver(ts_runtime_t* rt, ts_std_promise_t* owner_promise) {
  TS_DEF_ARGUMENTS(1);
  TS_SET_OBJECT_ARG(owner_promise);
  return ts_new_object(rt,
		  ts_module_class_of(rt->std_module,
			  lang_class_max + ts_std_promise_resolver_index), TS_ARGUMENTS);
}

static ts_object_t* ts_std_promise_new_rejecter(ts_runtime_t* rt, ts_std_promise_t* owner_promise) {
  TS_DEF_ARGUMENTS(1);
  TS_SET_OBJECT_ARG(owner_promise);
  return ts_new_object(rt,
		  ts_module_class_of(rt->std_module,
			  lang_class_max + ts_std_promise_rejecter_index), TS_ARGUMENTS);
}

static void _promise_do_resolve(void* data) {
  ts_std_promise_t* self = (ts_std_promise_t*)data;
  if (!self) {
    return;
  }

  self->resolve_task = NULL;
  ts_std_resolve_entry_t* resolves = self->resolves;
  ts_std_resolve_entry_t* resolve = resolves;

  while(resolve) {
    _promise_process_resolve(self, resolve);
    resolve = resolve->next;
  };

  ts_std_free_resolves(resolves);
  ts_object_release(&self->base);
}

static void ts_std_promise_async_resolve(ts_std_promise_t* self) {
  if (self->state != ts_std_promise_pending && self->resolve_task == NULL) {
    self->resolve_task = ts_std_new_task(ts_runtime_from_object(&self->base), _promise_do_resolve, self, NULL);
    ts_std_post_task(ts_runtime_from_object(&self->base), self->resolve_task);
  }
}

static void ts_std_free_resolves(ts_std_resolve_entry_t* entry) {
  while(entry) {
    ts_std_resolve_entry_t* tmp = entry;
    entry = entry->next;

    ts_object_release(tmp->on_finally);
    ts_object_release(tmp->on_fulfiled);
    ts_object_release(tmp->on_rejected);
    ts_object_release(&tmp->then->base); //used by next promise
    free(tmp);
  }
}

static void ts_std_promise_insert_then(ts_std_promise_t* promise, ts_std_promise_t* then) {
  ts_std_promise_insert_resolve(promise, then, NULL, NULL, NULL);
}

static void ts_std_promise_insert_resolve(ts_std_promise_t* promise, ts_std_promise_t* then, ts_object_t* on_resolved, ts_object_t* on_rejected, ts_object_t* on_finally) {
  if (promise == NULL)
    return;

  if (then == NULL && on_rejected == NULL && on_resolved == NULL && on_finally == NULL)
    return;

  ts_std_resolve_entry_t* entry = (ts_std_resolve_entry_t*)malloc(sizeof(ts_std_resolve_entry_t));

  entry->on_fulfiled = on_resolved;
  entry->on_rejected = on_rejected;
  entry->on_finally = on_finally;
  entry->then = then;
  entry->next = NULL;

  if (promise->resolves == NULL) {
    promise->resolves = entry;
    return;
  }

  ts_std_resolve_entry_t* header = promise->resolves;
  while (header->next) {
    header = header->next;
  }
  header->next = entry;
}

static int _std_promise_then_catch_finally(ts_std_promise_t* self, ts_std_resolve_type_t type, ts_argument_t args, ts_return_t ret) {

  ts_runtime_t* rt = ts_runtime_from_object(&self->base);
  int arg_count = TS_ARG_COUNT(args);
  ts_object_t* on_resolved = NULL;
  ts_object_t* on_rejected = NULL;
  ts_object_t* on_finally = NULL;

  if (type == ts_std_on_resolve) {
    if (arg_count >= 1 && TS_ARG_IS_OBJECT(args, 0)) {
      on_resolved = TS_ARG_OBJECT(args, 0);
    }
    if (arg_count >= 2 && TS_ARG_IS_OBJECT(args, 1)) {
      on_rejected = TS_ARG_OBJECT(args, 1);
    }
  } else if (type == ts_std_on_reject) {
    if (arg_count >= 1 && TS_ARG_IS_OBJECT(args, 0)) {
      on_rejected = TS_ARG_OBJECT(args, 0);
    }
  } else if (type == ts_std_on_finally) {
    if (arg_count >= 1 && TS_ARG_IS_OBJECT(args, 0)) {
      on_finally = TS_ARG_OBJECT(args, 0);
    }
  }

  // new promise
  ts_std_promise_t* new_promise = NULL;
  if (type != ts_std_on_finally)
    new_promise = (ts_std_promise_t*)ts_std_new_promise(rt, NULL);

  ts_std_promise_insert_resolve(self, new_promise, on_resolved, on_rejected, on_finally);

  ts_std_promise_async_resolve(self);

  TS_RETURN_OBJECT(ret, new_promise);
  return 0;
}

static int _std_promise_then(ts_std_promise_t* self, ts_argument_t args, ts_return_t ret) {
  return _std_promise_then_catch_finally(self, ts_std_on_resolve, args, ret);
}

static int _std_promise_catch(ts_std_promise_t* self, ts_argument_t args, ts_return_t ret) {
  return _std_promise_then_catch_finally(self, ts_std_on_reject, args, ret);
}

static int _std_promise_finally(ts_std_promise_t* self, ts_argument_t args, ts_return_t ret) {
  return _std_promise_then_catch_finally(self, ts_std_on_finally, args, ret);
}

static int _std_promise_constructor(ts_std_promise_t* self, ts_argument_t args, ts_return_t ret) {
  self->state = ts_std_promise_pending;
  self->resolved_type = ts_value_int64;
  self->result.lval = 0l;
  self->resolve_task = NULL;
  self->resolves = NULL;

  if (args == NULL || (TS_ARG_COUNT(args) < 1 && !TS_ARG_IS_OBJECT(args, 0)))
    return 0;

  ts_runtime_t* rt = ts_runtime_from_object(&self->base);

  ts_object_t* executor = TS_ARG_OBJECT(args, 0);

  // call executor
  ts_object_t* resolver = ts_std_promise_new_resolver(rt, self);
  ts_object_t* rejecter = ts_std_promise_new_rejecter(rt, self);

  do {
    TS_DEF_ARGUMENTS(2);
    TS_SET_OBJECT_ARG(resolver);
    TS_SET_OBJECT_ARG(rejecter);
    ts_function_call(executor, TS_ARGUMENTS, NULL);
  } while(0);
}

static void _std_promise_destroy(ts_std_promise_t* self) {
  ts_std_free_resolves(self->resolves);
  if (self->resolved_type == ts_value_object)
    ts_object_release(self->result.object);
}

static void _std_promise_gc_visit(ts_std_promise_t* self, ts_object_visitor_t visit, void* user_data) {
  if (self->resolved_type == ts_value_object)
    visit(self->result.object, user_data);

  ts_std_resolve_entry_t* entry = self->resolves;
  while (entry) {
    if(entry->on_fulfiled)
      visit(entry->on_fulfiled, user_data);
    if (entry->on_rejected)
      visit(entry->on_rejected, user_data);
    if (entry->on_finally)
      visit(entry->on_finally, user_data);
    if (entry->then)
      visit(&entry->then->base, user_data);
    entry = entry->next;
  }
}

static TS_FUNCTION_CLOSURE_VTABLE_DEF(std_promise_resolver,
		_func_impl_std_promise_resolver_rejecter,
		sizeof(ts_object_t*),
		ts_value_void,
		_std_promise_resolver_rejecter_constructor,
		_std_promise_resolver_rejecter_destroy,
		_std_promise_resolver_rejecter_gc_visit);
static TS_FUNCTION_CLOSURE_VTABLE_DEF(std_promise_rejecter,
		_func_impl_std_promise_resolver_rejecter,
		sizeof(ts_object_t*),
		ts_value_void,
		_std_promise_resolver_rejecter_constructor,
		_std_promise_resolver_rejecter_destroy,
		_std_promise_resolver_rejecter_gc_visit);

static TS_VTABLE_DEF(_std_promise_vt, 3/*member count*/) = {
  TS_VTABLE_BASE(
    sizeof(ts_std_promise_t),
    "std_promise",
    0, // interface count
    3, // member count
    (ts_call_t) _std_promise_constructor,
    (ts_finialize_t) _std_promise_destroy,
    NULL, // to_string
    (ts_gc_visit_t) _std_promise_gc_visit
  ),

  {
    {.method = (ts_call_t) _std_promise_then},
    {.method = (ts_call_t) _std_promise_catch},
    {.method = (ts_call_t) _std_promise_finally},
  }
};

void ts_std_init_promise_in_std_module(ts_module_t* m) {

  ts_init_vtable_env(&m->classes[lang_class_max + ts_std_promise_index], &_std_promise_vt.base, m, NULL);
  ts_init_vtable_env(&m->classes[lang_class_max + ts_std_promise_resolver_index], &_std_promise_resolver_vt.base, m, NULL);
  ts_init_vtable_env(&m->classes[lang_class_max + ts_std_promise_rejecter_index], &_std_promise_rejecter_vt.base, m, NULL);
}
