#ifndef TS_STD_H_
#define TS_STD_H_

#include "ts_common.h"
#include "ts_runtime.h"
#include "ts_lang.h"
#include "ts_std_async_await.h"

TS_CPP_BEGIN

typedef enum _ts_std_object_index_t {
  ts_std_console_index,
  ts_std_timer_index,
  ts_std_promise_index,
  ts_std_promise_awaiter_index,
  ts_std_promise_resolver_index,
  ts_std_promise_rejecter_index,
  ts_std_exception_error_index,
  ts_std_object_last_index
} ts_std_object_index_t;


ts_module_t* ts_create_std_module(ts_runtime_t* rt);

////////////////////////////////////////////////////////////////
// task
static inline ts_std_task_t ts_std_new_task(ts_runtime_t* rt, void (*task_impl)(void*), void* data, void (*free_data)(void*)) {
  return rt->std_backend.create_task(task_impl, data, free_data,
		  rt->std_backend.backend_data);
}
static inline void ts_std_post_task_delay(ts_runtime_t* rt, ts_std_task_t task, uint32_t delayms) {
  rt->std_backend.post_task_delay(task, delayms, rt->std_backend.backend_data);
}
static inline void ts_std_post_task(ts_runtime_t* rt, ts_std_task_t task) {
  ts_std_post_task_delay(rt, task, 0);  
}

/////////////////////////////////////////////////////////////////
//
inline static ts_boolean_t ts_object_is_std_object(ts_object_t* obj, ts_std_object_index_t type) {
  return obj && obj->vtable_env == ts_module_class_of(
	    ts_runtime_from_object(obj)->std_module, type);
}

inline static ts_boolean_t ts_object_is_console(ts_object_t* obj) {
  return ts_object_is_std_object(obj, lang_class_max + ts_std_console_index);
}

inline static ts_boolean_t ts_object_is_promise(ts_object_t* obj) {
  return ts_object_is_std_object(obj, lang_class_max + ts_std_promise_index);
}

inline static ts_boolean_t ts_object_is_promise_awaiter(ts_object_t* obj) {
  return ts_object_is_std_object(obj, lang_class_max + ts_std_promise_awaiter_index);
}


inline static ts_boolean_t ts_object_is_resolver(ts_object_t* obj) {
  return ts_object_is_std_object(obj, lang_class_max + ts_std_promise_resolver_index);
}

inline static ts_boolean_t ts_object_is_rejecter(ts_object_t* obj) {
  return ts_object_is_std_object(obj, lang_class_max + ts_std_promise_rejecter_index);
}

///////////////////////////////////////////////////////////////////
// console
inline static void ts_std_console_output(ts_runtime_t* rt, uint32_t method_index, ts_argument_t args) {
  ts_method_call(ts_module_object_of(rt->std_module, ts_std_console_index),
		 ts_method_last + method_index,
		 args,
		 NULL);
}

inline static void ts_std_console_info(ts_runtime_t* rt, ts_argument_t args) {
  ts_std_console_output(rt, 0, args);
}

inline static void ts_std_console_log(ts_runtime_t* rt, ts_argument_t args) {
  ts_std_console_output(rt, 1, args);
}

inline static void ts_std_console_debug(ts_runtime_t* rt, ts_argument_t args) {
  ts_std_console_output(rt, 2, args);
}

inline static void ts_std_console_warn(ts_runtime_t* rt, ts_argument_t args) {
  ts_std_console_output(rt, 3, args);
}

inline static void ts_std_console_error(ts_runtime_t* rt, ts_argument_t args) {
  ts_std_console_output(rt, 4, args);
}

inline static void ts_std_console_trace(ts_runtime_t* rt, ts_argument_t args) {
  ts_std_console_output(rt, 5, args);
}

/////////////////////////////////////////////////////////////////
// timer
inline static void ts_std_timer_function(ts_runtime_t* rt, int member_index, ts_argument_t args, ts_return_t ret) {
  ts_method_call(ts_module_object_of(rt->std_module, ts_std_timer_index),
		 ts_method_last + member_index, args, ret);
}

inline static int64_t ts_std_set_timeout_params(ts_runtime_t* rt, ts_argument_t args) {
  ts_value_t ret;
  ts_std_timer_function(rt, 0, args, &ret);
  return ret.lval;
}

inline static int64_t ts_std_set_timeout(ts_runtime_t* rt, ts_object_t* func, int64_t delay) {
  TS_DEF_ARGUMENTS(2);
  TS_SET_OBJECT_ARG(func);
  TS_SET_INT64_ARG(delay);
  return ts_std_set_timeout_params(rt, TS_ARGUMENTS);
}

inline static void ts_std_clear_timeout(ts_runtime_t* rt, int64_t timer_id) {
  TS_DEF_ARGUMENTS(1);
  TS_SET_INT64_ARG(timer_id);
  ts_std_timer_function(rt, 1, TS_ARGUMENTS, NULL);
}

inline static int64_t ts_std_set_interval_params(ts_runtime_t* rt, ts_argument_t args) {
  ts_value_t ret;
  ts_std_timer_function(rt, 2, args, &ret);
  return ret.lval;
}

inline static int64_t ts_std_set_interval(ts_runtime_t* rt, ts_object_t* func, int64_t delay) {
  TS_DEF_ARGUMENTS(2);
  TS_SET_OBJECT_ARG(func);
  TS_SET_INT64_ARG(delay);
  return ts_std_set_interval_params(rt, TS_ARGUMENTS);
}

inline static int64_t ts_std_clear_interval(ts_runtime_t* rt, int64_t timer_id) {
  TS_DEF_ARGUMENTS(1);
  TS_SET_INT64_ARG(timer_id);
  ts_std_timer_function(rt, 3, TS_ARGUMENTS, NULL);
}

///////////////////////////////////////////////////////
// promise
static inline ts_object_t* ts_std_new_promise(ts_runtime_t* rt, ts_object_t* executor) {
  if (executor == NULL) {
    return ts_new_object(rt, ts_module_class_of(rt->std_module, lang_class_max + ts_std_promise_index), NULL);
  } else {
    TS_DEF_ARGUMENTS(1);
    TS_SET_OBJECT_ARG(executor);
    return ts_new_object(rt, ts_module_class_of(rt->std_module, lang_class_max + ts_std_promise_index), TS_ARGUMENTS);
  }
}

static inline ts_object_t* ts_std_new_promise_awaiter(ts_runtime_t* rt, ts_object_t* executor) {
  ts_debug_check(executor != NULL, "promise_awaiter need a executor!");
  TS_DEF_ARGUMENTS(1);
  TS_SET_OBJECT_ARG(executor);
  return ts_new_object(rt, ts_module_class_of(rt->std_module, lang_class_max + ts_std_promise_awaiter_index), TS_ARGUMENTS);
}

static inline ts_object_t* ts_std_promise_then(ts_object_t* promise, ts_object_t* on_resolve, ts_object_t* on_reject) {
  TS_DEF_ARGUMENTS(2);
  TS_SET_OBJECT_ARG(on_resolve);
  TS_SET_OBJECT_ARG(on_reject);
  ts_value_t ret;
  ts_method_call(promise, ts_method_last + 0, TS_ARGUMENTS, &ret);
  return ret.object;
}

static inline ts_object_t* ts_std_promise_catch(ts_object_t* promise, ts_object_t* on_reject) {
  TS_DEF_ARGUMENTS(1);
  TS_SET_OBJECT_ARG(on_reject);
  ts_value_t ret;
  ts_method_call(promise, ts_method_last + 1, TS_ARGUMENTS, &ret);
  return ret.object;
}

static inline void ts_std_promise_finally(ts_object_t* promise, ts_object_t* on_finally) {
  TS_DEF_ARGUMENTS(1);
  TS_SET_OBJECT_ARG(on_finally);
  ts_method_call(promise, ts_method_last + 2, TS_ARGUMENTS, NULL);
}

static inline void ts_std_promise_then_promise(ts_object_t* promise, ts_object_t* then_promise) {
  TS_DEF_ARGUMENTS(1);
  TS_SET_OBJECT_ARG(then_promise);
  ts_method_call(promise, ts_method_last + 3, TS_ARGUMENTS, NULL);
}

static inline ts_object_t* ts_std_promise_from(ts_object_t* resolver_or_rejector) {
  if (ts_object_is_resolver(resolver_or_rejector)
	|| ts_object_is_rejecter(resolver_or_rejector)) {
    return *(TS_OFFSET(ts_object_t*, resolver_or_rejector,
			    sizeof(ts_object_t)));
  }
  return NULL;
}

TS_CPP_END

#endif
