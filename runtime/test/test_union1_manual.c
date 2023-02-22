
#include <ts_runtime.h>
#include <ts_std.h>
#include <ts_lang.h>


static int _Foo_constructor(ts_object_t* self, ts_argument_t args, ts_return_t ret) {
  TS_SET_FIELD(int32_t, self, ts_method_last + 0, TS_ARG_INT(args, 0));
  TS_SET_FIELD(int32_t, self, ts_method_last + 1, TS_ARG_INT(args, 1));

  return 0;
}

static int _Foo_say(ts_object_t* self, ts_argument_t args, ts_return_t ret) {
  ts_runtime_t* rt = ts_runtime_from_object(self);

  TS_DEF_ARGUMENTS(4);
  TS_SET_OBJECT_ARG(TS_STRING_NEW_STACK(rt, "Foo say: a "));
  TS_SET_OBJECT_ARG(TS_INT32_NEW_STACK(rt, TS_GET_FIELD(int32_t, self, ts_method_last + 0)));
  TS_SET_OBJECT_ARG(TS_STRING_NEW_STACK(rt, ", b: "));
  TS_SET_OBJECT_ARG(TS_INT32_NEW_STACK(rt, TS_GET_FIELD(int32_t, self, ts_method_last + 1)));
  ts_std_console_log(rt, TS_ARGUMENTS);
  return 0;
}

static TS_VTABLE_DEF(_Foo_vt, 3/*member count*/) = {
  TS_VTABLE_BASE(
    sizeof(ts_object_t) + sizeof(int32_t) * 2,
    "Foo",
    0, // interface count
    3, // member count
    _Foo_constructor, // constructor
    NULL, // destroy,
    NULL, // to_string
    NULL
  ),
  {
    {.field = sizeof(ts_object_t)}, // a
    {.field = sizeof(ts_object_t) + sizeof(int32_t)}, // b
    {.method = _Foo_say}
  }
};


/////////////////////////////////////////////////////////
static int _Goo_constructor(ts_object_t* self, ts_argument_t args, ts_return_t ret) {
  TS_SET_FIELD(int32_t, self, ts_method_last + 2, TS_ARG_INT(args, 0));
  TS_SET_FIELD(ts_boolean_t, self, ts_method_last + 0, (ts_boolean_t)TS_ARG_INT(args, 1));

  return 0;
}

static int _Goo_say(ts_object_t* self, ts_argument_t args, ts_return_t ret) {
  ts_runtime_t* rt = ts_runtime_from_object(self);

  TS_DEF_ARGUMENTS(4);
  TS_SET_OBJECT_ARG(TS_STRING_NEW_STACK(rt, "Goo say: a "));
  TS_SET_OBJECT_ARG(TS_INT32_NEW_STACK(rt, TS_GET_FIELD(int32_t, self, ts_method_last + 2)));
  TS_SET_OBJECT_ARG(TS_STRING_NEW_STACK(rt, ", c: "));
  TS_SET_OBJECT_ARG(TS_BOOLEAN_NEW_STACK(rt, TS_GET_FIELD(ts_boolean_t, self, ts_method_last + 0)));
  ts_std_console_log(rt, TS_ARGUMENTS);
  return 0;
}

static TS_VTABLE_DEF(_Goo_vt, 3/*member count*/) = {
  TS_VTABLE_BASE(
    sizeof(ts_object_t) + sizeof(ts_boolean_t) + sizeof(int32_t),
    "Foo",
    0, // interface count
    3, // member count
    _Goo_constructor, // constructor
    NULL, // destroy,
    NULL, // to_string
    NULL
  ),
  {
    {.field = sizeof(ts_object_t)}, // c
    {.method = _Goo_say},
    {.field = sizeof(ts_object_t) + sizeof(ts_boolean_t)}, // a
  }
};


//////////////////////////////////////////////////////
// function
static int _func_impl_test(ts_object_t* self, ts_argument_t args, ts_return_t ret) {
  static uint32_t members[][2] = {
    {ts_method_last + 0, ts_method_last + 2}, // Foo
    {ts_method_last + 2, ts_method_last + 1}, // Goo
  };

  uint32_t* member;
  ts_object_t* v;
  TS_INIT_UNION_OBJECT(TS_ARG_OBJECT(args, 0), members, v, member);


  ts_runtime_t* rt = ts_runtime_from_object(self);

  // console.log("test a: ${v.a}")
  do {
    TS_DEF_ARGUMENTS(2);
    TS_SET_OBJECT_ARG(TS_STRING_NEW_STACK(rt, "test a: "));
    TS_SET_OBJECT_ARG(TS_INT32_NEW_STACK(rt, TS_GET_FIELD(int32_t, v, member[0])));
    ts_std_console_log(rt, TS_ARGUMENTS);
  } while(0);

  do {
    ts_method_call(v, member[1], NULL, NULL);
  } while(0);

  return 0;
}

TS_FUNCTION_VTABLE_DEF(test, _func_impl_test, ts_value_void);

////////////////////////////////////////////////////////
// module
static int _module_initialize(ts_module_t* m, ts_argument_t args, ts_return_t ret) {
  ts_runtime_t* rt = m->runtime;

  TS_PUSH_LOCAL_SCOPE(rt, 2);
  do {
    // test(new Foo(10, 20))
    do {
      TS_DEF_ARGUMENTS(2);
      TS_SET_INT_ARG(10);
      TS_SET_INT_ARG(20);
      TS_SET_LOCAL_OBJECT(0, ts_new_object(
			   rt, ts_module_class_of(m, 0), TS_ARGUMENTS));
    } while(0);
    TS_DEF_ARGUMENTS(1);
    TS_SET_OBJECT_ARG(TS_LOCAL_OBJECT(0));
    ts_module_call_function(m, 0, TS_ARGUMENTS, NULL);
  } while(0);

  do {
    // test(new Goo(200,true))
    do {
      TS_DEF_ARGUMENTS(2);
      TS_SET_INT_ARG(200);
      TS_SET_INT_ARG(ts_true);
      TS_SET_LOCAL_OBJECT(1, ts_new_object(
			   rt, ts_module_class_of(m, 1), TS_ARGUMENTS));
    } while(0);
    TS_DEF_ARGUMENTS(1);
    TS_SET_OBJECT_ARG(TS_UNION_INDEX(TS_LOCAL_OBJECT(1), 1));
    ts_module_call_function(m, 0, TS_ARGUMENTS, NULL);
  } while(0);
  TS_POP_LOCAL_SCOPE(rt);
  return 0;
}

// the export module interface
static TS_VTABLE_DEF(_test_union1_vt, 1/*member count*/) = {
  TS_MODULE_VTABLE_BASE(
    TS_MODULE_SIZE(0, 0/*values*/, 1/*functions*/, 3/*classes of functions*/, 0),
    "test_union1",
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

TS_EXTERN ts_module_t* _test_union1_module(ts_runtime_t* runtime) {
  ts_module_t* m = ts_new_module(runtime, &_test_union1_vt.base, 0, 0, 1, 3, 0);


  ts_init_vtable_env(&m->classes[0], &_Foo_vt.base, m, NULL);
  ts_init_vtable_env(&m->classes[1], &_Goo_vt.base, m, NULL);
  ts_init_vtable_env(&m->classes[2], &_test_vt.base, m, NULL);

  m->functions[0] = ts_new_object(runtime, &m->classes[2], NULL);

  return m;
}
