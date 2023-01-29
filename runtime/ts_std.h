#ifndef TS_STD_H_
#define TS_STD_H_

#include "ts_common.h"
#include "ts_runtime.h"

TS_CPP_BEGIN

typedef enum _ts_std_object_index_t {
  ts_std_console_index,
  ts_std_timer_index,
  ts_std_object_last_index
} ts_std_object_index_t;


ts_module_t* ts_create_std_module(ts_runtime_t* rt);

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

inline static void ts_std_console_warn(ts_runtime_t* rt, ts_argument_t args) {
  ts_std_console_output(rt, 3, args);
}

inline static void ts_std_console_error(ts_runtime_t* rt, ts_argument_t args) {
  ts_std_console_output(rt, 4, args);
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
  TS_SET_LONG_ARG(delay);
  return ts_std_set_timeout_params(rt, TS_ARGUMENTS);
}

inline static void ts_std_clear_timeout(ts_runtime_t* rt, int64_t timer_id) {
  TS_DEF_ARGUMENTS(1);
  TS_SET_LONG_ARG(timer_id);
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
  TS_SET_LONG_ARG(delay);
  return ts_std_set_interval_params(rt, TS_ARGUMENTS);
}

inline static int64_t ts_std_clear_interval(ts_runtime_t* rt, int64_t timer_id) {
  TS_DEF_ARGUMENTS(1);
  TS_SET_LONG_ARG(timer_id);
  ts_std_timer_function(rt, 3, TS_ARGUMENTS, NULL);
}

TS_CPP_END

#endif
