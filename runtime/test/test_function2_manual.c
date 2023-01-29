
#include <ts_runtime.h>
#include <ts_std.h>
#include <ts_lang.h>

static int _func_impl_foo_closure1(ts_object_t* self, ts_argument_t args, ts_return_t ret) {
  TS_RETURN_INT(ret,
	(*TS_FUNC_CLOSURE_DATA(int32_t, self, 0) + TS_ARG_INT(args, 0)));
  return 0;
}

static TS_FUNCTION_CLOSURE_VTABLE_DEF(foo_closure1, _func_impl_foo_closure1, sizeof(int32_t));

static int _func_impl_foo(ts_object_t* self, ts_argument_t args, ts_return_t ret) {
  ts_object_t* TS_NEW_CLOSURE_FUNC_BEGIN(closure1, ts_module_from_object(self), 1)
        TS_ADD_FUNC_CLOSURE_DATA(int32_t, TS_ARG_INT(args, 0))
      TS_NEW_CLOSURE_FUNC_END

  TS_RETURN_OBJECT(ret, closure1);
  return 0;
}

static TS_FUNCTION_VTABLE_DEF(foo, _func_impl_foo);


static int _module_initialize(ts_module_t* m, ts_argument_t args, ts_return_t ret) {
  ts_runtime_t* rt = m->runtime;

  TS_PUSH_LOCAL_SCOPE(rt, 1);

  // let f = foo(10)
  do {
    TS_DEF_ARGUMENTS(1);
    TS_SET_INT_ARG(10);
    ts_value_t ret;
    ts_module_call_function(m, 0, TS_ARGUMENTS, &ret);
    TS_SET_LOCAL_OBJECT(0, ret.object);  // f = ret
  } while(0);

  //console.log(f(20))
  do {
    ts_value_t ret1;
    do {
      TS_DEF_ARGUMENTS(1);
      TS_SET_INT_ARG(20);
      ts_function_call(TS_LOCAL_OBJECT(0), TS_ARGUMENTS, &ret1);
    } while(0);

    TS_DEF_ARGUMENTS(1);
    TS_SET_OBJECT_ARG(TS_INT32_NEW_STACK(rt, ret1.ival));
    ts_std_console_log(rt, TS_ARGUMENTS);
  } while(0);

  //console.log(f(30))
  do {
    ts_value_t ret1;
    do {
      TS_DEF_ARGUMENTS(1);
      TS_SET_INT_ARG(30);
      ts_function_call(TS_LOCAL_OBJECT(0), TS_ARGUMENTS, &ret1);
    } while(0);

    TS_DEF_ARGUMENTS(1);
    TS_SET_OBJECT_ARG(TS_INT32_NEW_STACK(rt, ret1.ival));
    ts_std_console_log(rt, TS_ARGUMENTS);
  } while(0);


  ts_object_release(TS_LOCAL_OBJECT(0));
  TS_POP_LOCAL_SCOPE(rt);
}

static void _module_visitor(ts_object_t* self, ts_object_visitor_t visitor, void* user_data) {
  ts_module_t* m = (ts_module_t*)self;
  visitor(ts_module_function_of(m, 0), user_data);
}

static TS_VTABLE_DEF(_test_function2_vt, 1/*member count*/) = {
  TS_VTABLE_BASE(
     TS_MODULE_SIZE(0, 0/*values*/, 1/*functions*/, 2/*class of functions*/, 0),
     "test_function2",
     0,
     1, // member count
     NULL,
     NULL,
     NULL,
     _module_visitor
  ),
  {
    {.method = (ts_call_t)_module_initialize}
  }
};

TS_EXTERN ts_module_t* _test_function2_module(ts_runtime_t* runtime) {
  ts_module_t* m = ts_new_module(runtime, &_test_function2_vt.base, 0, 0, 1, 2, 0);

  ts_init_vtable_env(&m->classes[0], &_foo_vt.base, m, NULL);
  ts_init_vtable_env(&m->classes[1], &_foo_closure1_vt.base, m, NULL);

  m->functions[0] = ts_new_object(runtime, &m->classes[0], NULL);

  return m;
}
