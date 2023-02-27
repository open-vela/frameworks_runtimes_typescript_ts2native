#include <stdlib.h>
#include <ts_lang.h>
#include <ts_runtime.h>
#include <ts_std.h>

static int _module_initialize(ts_module_t* obj,
                              ts_argument_t args,
                              ts_return_t ret) {
  ts_runtime_t* rt = obj->runtime;
  do {
    ts_object_t* date;
    //// date = new Date(1437384704000);
    //    {
    //      TS_DEF_ARGUMENTS(1);
    //      TS_SET_DOUBLE_ARG(1437384704000);
    //      date = ts_new_object(
    //          rt, &rt->std_module->classes[lang_class_max +
    //          ts_std_date_index], TS_ARGUMENTS);
    //    }
    //// date = new Date();
    {
      // var date = new Date();
      date = ts_new_object(
          rt, &rt->std_module->classes[lang_class_max + ts_std_date_index],
          NULL);
    }
    {
      // console.log(date.getFullYear());
      TS_DEF_ARGUMENTS(1);
      TS_SET_OBJECT_ARG(
          TS_INT32_NEW_STACK(rt, ts_std_date_getFullYear(date, rt, args)));
      ts_std_console_log(rt, TS_ARGUMENTS);
    }
    {
      // date.setFullYear(2024);
      TS_DEF_ARGUMENTS(1);
      TS_SET_DOUBLE_ARG(2024);
      ts_std_date_setFullYear(date, rt, TS_ARGUMENTS);
    }
    {
      // console.log(date.getFullYear());
      TS_DEF_ARGUMENTS(1);
      TS_SET_OBJECT_ARG(
          TS_INT32_NEW_STACK(rt, ts_std_date_getFullYear(date, rt, args)));
      ts_std_console_log(rt, TS_ARGUMENTS);
    }
    {
      // console.log(date.getMonth());
      TS_DEF_ARGUMENTS(1);
      TS_SET_OBJECT_ARG(
          TS_INT32_NEW_STACK(rt, ts_std_date_getMonth(date, rt, args)));
      ts_std_console_log(rt, TS_ARGUMENTS);
    }

    {
      ts_value_t ret;
      ts_std_date_toString(date, rt, args, &ret);
      TS_DEF_ARGUMENTS(1);
      TS_SET_OBJECT_ARG(ret.object);
      ts_std_console_log(rt, TS_ARGUMENTS);
    }
  } while (0);
  do {
    // console.log(Date.now());
    TS_DEF_ARGUMENTS(1);
    TS_SET_OBJECT_ARG(TS_DOUBLE_NEW_STACK(rt, ts_std_date_now(rt, args)));
    ts_std_console_log(rt, TS_ARGUMENTS);
  } while (0);

  return 0;
}

// the export module interface
static TS_VTABLE_DEF(_test_date_vt, 1 /*member count*/) = {
    TS_MODULE_VTABLE_BASE(TS_MODULE_SIZE(0, 0, 0, 0, 0),
                          "test_date",
                          0,
                          1,  // member count
                          NULL,
                          NULL,
                          NULL,
                          NULL),
    {{.method = (ts_call_t)_module_initialize}}};

TS_EXTERN ts_module_t* _test_date_module(ts_runtime_t* runtime) {
  ts_module_t* m =
      (ts_module_t*)ts_new_module(runtime, &_test_date_vt.base, 0, 0, 0, 0, 0);

  return m;
}
