
#include <ts_runtime.h>
#include <ts_std.h>
#include <ts_lang.h>

static int _func_impl_set_new_name(ts_object_t* self, ts_argument_t args, ts_return_t ret) {
  ts_reset_object(&ts_module_value_of(ts_module_from_object(self), 0)->object,
	           ts_string_dup(TS_ARG_OBJECT(args, 0)));
  return 0;
}

TS_FUNCTION_VTABLE_DEF(set_new_name, _func_impl_set_new_name, ts_value_void);

static int _func_impl_show_name(ts_object_t* self, ts_argument_t args, ts_return_t ret) {
  ts_runtime_t* rt = ts_runtime_from_object(self);
  TS_DEF_ARGUMENTS(2);
  TS_SET_OBJECT_ARG(TS_STRING_NEW_STACK(rt, "==== the name is "));
  TS_SET_OBJECT_ARG(ts_module_value_of(ts_module_from_object(self), 0)->object);
  ts_std_console_log(rt, TS_ARGUMENTS);
  return 0;
}

TS_FUNCTION_VTABLE_DEF(show_name, _func_impl_show_name, ts_value_void);


static int _module_initialize(ts_module_t* m, ts_argument_t args, ts_return_t ret) {
  ts_module_value_of(m, 0)->object = ts_new_string(m->runtime, "Sun Wukong", ts_true);
  
  ts_module_call_function(m, 1, NULL, NULL);  // show_name();

  do { // set_new_name('Zhu Bajie');
    TS_DEF_ARGUMENTS(1);
    TS_SET_OBJECT_ARG(TS_STRING_NEW_STACK(m->runtime, "Zhu Bajie"));
    ts_module_call_function(m, 0, TS_ARGUMENTS, NULL);
  }while(0);

  ts_module_call_function(m, 1, NULL, NULL); // show_name();
  return 0;
}

static void _module_visitor(ts_object_t* self, ts_object_visitor_t visitor, void* user_data) {
  ts_module_t* m = (ts_module_t*)self;
  visitor(ts_module_value_of(m, 0)->object, user_data);
  visitor(ts_module_function_of(m, 0), user_data);
  visitor(ts_module_function_of(m, 1), user_data);
}

// the export module interface
static TS_VTABLE_DEF(_test_function1_vt, 1/*member count*/) = {
  TS_MODULE_VTABLE_BASE(
    TS_MODULE_SIZE(0, 1/*values*/, 2/*functions*/, 2/*classes of functions*/, 0),
    "test_function1",
    0,
    1,  // member count
    NULL,
    NULL,
    NULL,
    _module_visitor
  ),
  {
    {.method = (ts_call_t)_module_initialize}
  }
};

TS_EXTERN ts_module_t* _test_function1_module(ts_runtime_t* runtime) {
  ts_module_t* m = ts_new_module(runtime, &_test_function1_vt.base, 0, 1, 2, 2, 0);

  m->values[0].object = NULL;  // init the value of "name"

  ts_init_vtable_env(&m->classes[0], &_set_new_name_vt.base, m, NULL);
  ts_init_vtable_env(&m->classes[1], &_show_name_vt.base, m, NULL);

  m->functions[0] = ts_new_object(runtime, &m->classes[0], NULL);
  m->functions[1] = ts_new_object(runtime, &m->classes[1], NULL);

  return m;
}
