
#include <ts_runtime.h>
#include <ts_std.h>
#include <ts_lang.h>

static int _func_impl_test_timeout(ts_object_t* self, ts_argument_t args, ts_return_t ret) {
  int32_t n = TS_ARG_INT(args, 0);
  int32_t count = ts_module_value_of(ts_module_from_object(self), 0)->ival;

  if (n >= count)
    return 0;

  ts_runtime_t* rt = ts_runtime_from_object(self);
  // console.log(`==== n: ${n}`);
  do {
    TS_DEF_ARGUMENTS(2);
    TS_SET_OBJECT_ARG(TS_STRING_NEW_STACK(rt, "==== n:"));
    TS_SET_OBJECT_ARG(TS_INT32_NEW_STACK(rt, n));
    ts_std_console_log(rt, TS_ARGUMENTS);
  } while(0);

  // setTimeout(test_timeout, 500, n+1)
  do {
    TS_DEF_ARGUMENTS(3);
    TS_SET_OBJECT_ARG(self);  // callback
    TS_SET_INT64_ARG(500); // delayms
    TS_SET_INT_ARG(n + 1);
    ts_std_set_timeout_params(rt, TS_ARGUMENTS);
  } while(0);
  return 0;
}

static int _func_impl_test_interval(ts_object_t* self, ts_argument_t args, ts_return_t ret) {
  int32_t count = ts_module_value_of(ts_module_from_object(self), 0)->ival;
  int32_t interval = ts_module_value_of(ts_module_from_object(self), 1)->ival;

  ts_runtime_t* rt = ts_runtime_from_object(self);
  if (interval >= count) {
    int64_t interval_id = ts_module_value_of(ts_module_from_object(self), 2)->lval;
    ts_std_clear_interval(rt, interval_id);
    return 0;
  }

  // console.log(`==== n: ${n}`);
  do {
    TS_DEF_ARGUMENTS(2);
    TS_SET_OBJECT_ARG(TS_STRING_NEW_STACK(rt, "intervalId ==== n:"));
    TS_SET_OBJECT_ARG(TS_INT32_NEW_STACK(rt, interval));
    ts_std_console_log(rt, TS_ARGUMENTS);
  } while(0);

  // interval = interval+1;
  ts_module_value_of(ts_module_from_object(self), 1)->ival = interval+1;

  return 0;
}

static TS_FUNCTION_VTABLE_DEF(test_timeout, _func_impl_test_timeout, ts_value_void);
static TS_FUNCTION_VTABLE_DEF(test_interval, _func_impl_test_interval, ts_value_void);

static int _module_initialize(ts_module_t* m, ts_argument_t args, ts_return_t ret) {
  ts_module_value_of(m, 0)->ival = 10;

  do {
    TS_DEF_ARGUMENTS(1);
    TS_SET_OBJECT_ARG(TS_STRING_NEW_STACK(m->runtime, "start timeout"));
    ts_std_console_log(m->runtime, TS_ARGUMENTS);
  } while(0);

  do {
    TS_DEF_ARGUMENTS(1);
    TS_SET_INT_ARG(0);
    ts_module_call_function(m, 0, TS_ARGUMENTS, NULL);
  } while(0);

  do {
    ts_module_value_of(m, 2)->lval =
            ts_std_set_interval(m->runtime, m->functions[1],1000);
  } while(0);

  return 0;
}

static TS_VTABLE_DEF(_test_timeout_module_vt, 1/*member count*/) = {
  TS_MODULE_VTABLE_BASE(
    TS_MODULE_SIZE(0, 3/*values*/, 2/*functions*/, 2/*classes of functions*/, 0),
    "test_timeout",
    0,
    TS_VTABLE_NEMBER_COUNT(_test_timeout_module_vt), // member count
    NULL, //constructor
    NULL, // destroy
    NULL, // tostring
    NULL // visitor
  ),
  {
    {.method = (ts_call_t)_module_initialize}
  }
};

TS_EXTERN ts_module_t* _test_timeout_module(ts_runtime_t* runtime) {
  ts_module_t* m = ts_new_module(runtime, &_test_timeout_module_vt.base, 0, 3, 2, 2, 0);

  m->values[0].ival = 0;
  m->values[1].ival = 0;
  m->values[2].lval = 0;

  ts_init_vtable_env(&m->classes[0], &_test_timeout_vt.base, m, NULL);
  ts_init_vtable_env(&m->classes[1], &_test_interval_vt.base, m, NULL);

  m->functions[0] = ts_new_object(runtime, &m->classes[0], NULL);
  m->functions[1] = ts_new_object(runtime, &m->classes[1], NULL);

  return m;
}
