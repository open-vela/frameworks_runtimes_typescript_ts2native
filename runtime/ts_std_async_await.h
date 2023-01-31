#ifndef TS_STD_ASYNC_AWAIT_H_
#define TS_STD_ASYNC_AWAIT_H_

#include "ts_common.h"
#include "ts_runtime.h"
#include "ts_lang.h"

TS_CPP_BEGIN

typedef struct _ts_std_awaiter_t ts_std_awaiter_t;


struct _ts_std_awaiter_t {
  void* next_label;
  ts_object_t* promise;
  ts_object_t* resolver;
  ts_object_t* rejecter;
  uint32_t size:16;
  uint32_t object_count:16;
};

#define TS_STD_AWAITER_OBJECT(awaiter) \
	 TS_OFFSET(ts_object_t*, awaiter, sizeof(ts_std_awaiter_t))

#define TS_STD_AWAITER_DATA(awaiter, type, offset)             \
	TS_OFFSET(type, awaiter,                               \
	    sizeof(ts_std_awaiter_t) +                         \
	    sizeof(ts_object_t*) * ((awaiter)->object_count) + \
	    (offset))

#define TS_STD_AWAITER_SET_LABLE(awaiter, label) \
	(awaiter)->next_label = &&label

#define TS_STD_AWAITER_SET_END(awaiter) (awaiter)->next_label = NULL

#define TS_STD_AWAITER_GOTO_RETRUN(awaiter, ret)  do { \
	if ((awaiter) && ((awaiter)->next_label))      \
	  goto *((awaiter)->next_label);               \
	else                                           \
	  return (ret);                                \
    } while(0)

static inline ts_std_awaiter_t* ts_std_new_awaiter(ts_runtime_t* rt, uint32_t data_size, uint32_t object_count) {
  ts_std_awaiter_t* awaiter = (ts_std_awaiter_t*)(
		  rt->gc_alloc(rt->gc, sizeof(ts_std_awaiter_t) + data_size));

  awaiter->next_label = NULL;
  awaiter->size = (uint16_t)(sizeof(ts_std_awaiter_t) + data_size);
  awaiter->object_count = (uint16_t)(object_count);
  awaiter->promise = NULL;

  return awaiter;
}

static inline void ts_std_free_awaiter(ts_runtime_t* rt, ts_std_awaiter_t* awaiter) {
  if (!awaiter)
    return;
  
  ts_object_release(awaiter->promise);
  ts_object_t** objects = TS_STD_AWAITER_OBJECT(awaiter);
  for(uint16_t i = 0; i < awaiter->object_count; i++) {
    ts_object_release(objects[i]);
  }
  
  rt->gc_free(rt->gc, awaiter);
}

static inline ts_std_awaiter_t* ts_std_awaiter_of(ts_object_t* self) {
  return *(TS_FUNC_CLOSURE_DATA(ts_std_awaiter_t*, self, 0));
}

static inline ts_object_t* ts_std_create_awaiter_function(ts_runtime_t* rt, ts_vtable_env_t* vt_env, ts_std_awaiter_t* awaiter) {

  ts_object_t* obj = ts_new_object(rt, vt_env, NULL);
  *(TS_FUNC_CLOSURE_DATA(ts_std_awaiter_t*, obj, 0)) = awaiter;

  return obj;
}

static inline void _ts_std_awaiter_function_destroy(ts_object_t* self) {
  ts_std_awaiter_t* awaiter = ts_std_awaiter_of(self);
  if (awaiter)
    ts_std_free_awaiter(ts_runtime_from_object(self), awaiter);
}

static inline void _ts_std_awaiter_function_gc_visit(ts_object_t* self, ts_object_visitor_t visit, void* user_data) {
  ts_std_awaiter_t* awaiter = ts_std_awaiter_of(self);
  if (awaiter) {
    if (awaiter->promise)
      visit(awaiter->promise, user_data);
    ts_object_t** objects = TS_STD_AWAITER_OBJECT(awaiter);
    for(uint16_t i = 0; i < awaiter->object_count; i++) {
      if (objects[i])
        visit(objects[i], user_data);
    }
  }
}

#define TS_FUNCTION_AWAITER_VTABLE_DEF(name, func_impl) \
  TS_FUNCTIONLIKE_CLOSURE_VTABLE_DEF(                   \
	name##_awaiter,                                 \
	func_impl,                                      \
	ts_object_function_awaiter,                     \
	ts_value_void,                                  \
	sizeof(ts_std_awaiter_t*),                      \
	NULL,                                           \
	_ts_std_awaiter_function_destroy,               \
	_ts_std_awaiter_function_gc_visit)

TS_CPP_END
#endif
