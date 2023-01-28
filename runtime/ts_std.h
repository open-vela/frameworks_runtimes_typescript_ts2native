#ifndef TS_STD_H_
#define TS_STD_H_

#include "ts_common.h"
#include "ts_runtime.h"

TS_CPP_BEGIN

ts_module_t* ts_create_std_module(ts_runtime_t* rt);

inline static void ts_std_console_output(ts_runtime_t* rt, uint32_t method_index, ts_argument_t args) {
  ts_method_call(ts_module_object_of(rt->std_module, 0),
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

TS_CPP_END

#endif
