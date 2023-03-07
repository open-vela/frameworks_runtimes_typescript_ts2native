
#include <ts_runtime.h>
#include <ts_std.h>
#include <ts_lang.h>
#include <ts_exception.hpp>

static int _func_impl_inner_func(ts_object_t* self, ts_argument_t args, ts_return_t ret) {
  ts_runtime_t* rt = ts_runtime_from_object(self);
#ifdef TOWASM
  TS_TRY_BEGIN(rt)
  //这里可以看到，主要区别在于，将TS_CATCH的定义提前到紧跟着TS_TRY_BEGIN
  //因为这里的宏定义展开是动态赋值了rt->try_block->callback回调函数，必须放在最前面
  //所以后面ts转化c代码，也必须按照这个规范来
  TS_CATCH(rt,err)
    TS_DEF_ARGUMENTS(2);
    TS_SET_OBJECT_ARG(TS_STRING_NEW_STACK(rt, "inner error = "));
    TS_SET_OBJECT_ARG(err);
    ts_std_console_log(rt, TS_ARGUMENTS);

    TS_THORW_ERROR(rt, "from inner func error");
  TS_FINALLY
    TS_DEF_ARGUMENTS(1);
    TS_SET_OBJECT_ARG(TS_STRING_NEW_STACK(rt, "== inner finally =="));
    ts_std_console_log(rt, TS_ARGUMENTS);
  TS_TRY_END

    TS_DEF_ARGUMENTS(1);
    TS_SET_OBJECT_ARG(TS_STRING_NEW_STACK(rt, "=== inner do something =="));
    ts_std_console_log(rt, TS_ARGUMENTS);
    
    TS_THORW_ERROR(rt, "inner fatal error");
  TS_TRY_REAL_END
#else
  TS_TRY_BEGIN(rt)
    TS_DEF_ARGUMENTS(1);
    TS_SET_OBJECT_ARG(TS_STRING_NEW_STACK(rt, "=== inner do something =="));
    ts_std_console_log(rt, TS_ARGUMENTS);
    
    TS_THORW_ERROR(rt, "inner fatal error");
  TS_CATCH(err)
    TS_DEF_ARGUMENTS(2);
    TS_SET_OBJECT_ARG(TS_STRING_NEW_STACK(rt, "inner error = "));
    TS_SET_OBJECT_ARG(err);
    ts_std_console_log(rt, TS_ARGUMENTS);

    TS_THORW_ERROR(rt, "from inner func error");
  TS_FINALLY
    TS_DEF_ARGUMENTS(1);
    TS_SET_OBJECT_ARG(TS_STRING_NEW_STACK(rt, "== inner finally =="));
    ts_std_console_log(rt, TS_ARGUMENTS);
  TS_TRY_END
#endif
  return 0;
}

static TS_FUNCTION_VTABLE_DEF(inner_func, _func_impl_inner_func, ts_value_void);

static int _func_impl_outter_func(ts_object_t* self, ts_argument_t args, ts_return_t ret) {

  ts_runtime_t* rt = ts_runtime_from_object(self);
#ifdef TOWASM
  TS_TRY_BEGIN(rt)
  TS_CATCH(rt,err)
    do {
      TS_DEF_ARGUMENTS(1);
      TS_SET_OBJECT_ARG(TS_STRING_NEW_STACK(rt, "=== outter catch =="));
      ts_std_console_log(rt, TS_ARGUMENTS);
    } while(0);

    do {
      TS_DEF_ARGUMENTS(1);
      TS_SET_OBJECT_ARG(err);
      ts_std_console_log(rt, TS_ARGUMENTS);
    } while(0);

  TS_FINALLY
    TS_DEF_ARGUMENTS(1);
    TS_SET_OBJECT_ARG(TS_STRING_NEW_STACK(rt, "=== outter finally"));
    ts_std_console_log(rt, TS_ARGUMENTS);
  TS_TRY_END
  
    TS_DEF_ARGUMENTS(1);
    TS_SET_OBJECT_ARG(TS_STRING_NEW_STACK(rt, "=== outter do ===="));
    ts_std_console_log(rt, TS_ARGUMENTS);
    ts_module_call_function(ts_module_from_object(self), 0, NULL, NULL);
  TS_TRY_REAL_END
#else
  TS_TRY_BEGIN(rt)
    TS_DEF_ARGUMENTS(1);
    TS_SET_OBJECT_ARG(TS_STRING_NEW_STACK(rt, "=== outter do ===="));
    ts_std_console_log(rt, TS_ARGUMENTS);

    ts_module_call_function(ts_module_from_object(self), 0, NULL, NULL);
  TS_CATCH(err)
    do {
      TS_DEF_ARGUMENTS(1);
      TS_SET_OBJECT_ARG(TS_STRING_NEW_STACK(rt, "=== outter catch =="));
      ts_std_console_log(rt, TS_ARGUMENTS);
    } while(0);

    do {
      TS_DEF_ARGUMENTS(1);
      TS_SET_OBJECT_ARG(err);
      ts_std_console_log(rt, TS_ARGUMENTS);
    } while(0);

  TS_FINALLY
    TS_DEF_ARGUMENTS(1);
    TS_SET_OBJECT_ARG(TS_STRING_NEW_STACK(rt, "=== outter finally"));
    ts_std_console_log(rt, TS_ARGUMENTS);
  TS_TRY_END
#endif

  return 0;
}

static TS_FUNCTION_VTABLE_DEF(outter_func, _func_impl_outter_func, ts_value_void);

////////////////////////////////////////////////////////
// module
static int _module_initialize(ts_module_t* m, ts_argument_t args, ts_return_t ret) {

   ts_module_call_function(m, 1, NULL, NULL);

  return 0;
}

// the export module interface
static TS_VTABLE_DEF(_test_trycatch_vt, 1/*member count*/) = {
  TS_MODULE_VTABLE_BASE(
    TS_MODULE_SIZE(0, 0/*values*/, 2/*functions*/, 2/*classes of functions*/, 0),
    "test_trycatch",
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

TS_EXTERN ts_module_t* _test_trycatch_module(ts_runtime_t* runtime) {
  ts_module_t* m = ts_new_module(runtime, &_test_trycatch_vt.base, 0, 0, 2, 2, 0);


  ts_init_vtable_env(&m->classes[0], &_inner_func_vt.base, m, NULL);
  ts_init_vtable_env(&m->classes[1], &_outter_func_vt.base, m, NULL);

  m->functions[0] = ts_new_object(runtime, &m->classes[0], NULL);
  m->functions[1] = ts_new_object(runtime, &m->classes[1], NULL);

  return m;
}
