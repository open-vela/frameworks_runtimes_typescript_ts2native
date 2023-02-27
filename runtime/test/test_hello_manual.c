// this the manual

#include <ts_runtime.h>
#include <ts_std.h>
#include <ts_lang.h>

static int _module_initialize(ts_module_t* obj, ts_argument_t args, ts_return_t ret) {
  do {
    TS_DEF_ARGUMENTS(1);
    TS_SET_OBJECT_ARG(TS_STRING_NEW_STACK(obj->runtime, "hello world!"));
    ts_std_console_log(obj->runtime, TS_ARGUMENTS);
  } while(0);

  do {
    TS_DEF_ARGUMENTS(1);
    TS_SET_OBJECT_ARG(TS_STRING_NEW_STACK(obj->runtime, "info : hello world!"));
    ts_std_console_info(obj->runtime, TS_ARGUMENTS);
  } while(0);

  do {
    TS_DEF_ARGUMENTS(1);
    TS_SET_OBJECT_ARG(TS_STRING_NEW_STACK(obj->runtime, "debug : hello world!"));
    ts_std_console_debug(obj->runtime, TS_ARGUMENTS);
  } while(0);

  do {
    TS_DEF_ARGUMENTS(1);
    TS_SET_OBJECT_ARG(TS_STRING_NEW_STACK(obj->runtime, "warn : hello world!"));
    ts_std_console_warn(obj->runtime, TS_ARGUMENTS);
  } while(0);

  do {
    TS_DEF_ARGUMENTS(1);
    TS_SET_OBJECT_ARG(TS_STRING_NEW_STACK(obj->runtime, "error : hello world!"));
    ts_std_console_error(obj->runtime, TS_ARGUMENTS);
  } while(0);

  do {
    TS_DEF_ARGUMENTS(0);
    ts_std_console_trace(obj->runtime, TS_ARGUMENTS);
  } while(0);

  return 0;
}

// the export module interface
static TS_VTABLE_DEF(_test_hello_vt, 1/*member count*/) = {
  TS_MODULE_VTABLE_BASE(
    TS_MODULE_SIZE(0, 0, 0, 0, 0),
    "test_hello",
    0,
    1,  // member count
    NULL,
    NULL,
    NULL,
    NULL
  ),
  {
    {.method = (ts_call_t)_module_initialize}
  }
};

TS_EXTERN ts_module_t* _test_hello_module(ts_runtime_t* runtime) {
  return (ts_module_t*)ts_new_module(runtime, &_test_hello_vt.base, 0, 0, 0, 0, 0);
}
