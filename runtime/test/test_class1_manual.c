
#include <ts_runtime.h>
#include <ts_std.h>
#include <ts_lang.h>

static int _person_constructor(ts_object_t* obj, ts_argument_t args, ts_return_t ret) {
  ts_debug_check(TS_ARG_COUNT(args) == 2, "Person constructor need 2 arguments");

  *TS_OBJECT_MEMBER_OF(ts_object_t*, obj, 0) = ts_object_add_ref(TS_ARG_OBJECT(args, 0));
  *TS_OBJECT_MEMBER_OF(int32_t, obj, sizeof(ts_object_t*)) = TS_ARG_INT(args, 1);
  return 0;
}

static void _person_destroy(ts_object_t* obj) {
  ts_object_release(*TS_OBJECT_MEMBER_OF(ts_object_t*, obj, 0));
}

static void _person_gc_visit(ts_object_t* obj, ts_object_visitor_t visitor, void* user_data) {
  visitor(*TS_OBJECT_MEMBER_OF(ts_object_t*, obj, 0), user_data);
}

static int _person_say(ts_object_t* obj, ts_argument_t args, ts_return_t ret) {
  ts_runtime_t* rt = ts_runtime_from_object(obj);
  TS_DEF_ARGUMENTS(5);
  TS_SET_OBJECT_ARG(TS_STRING_NEW_STACK(rt, "hello my name is "));
  TS_SET_OBJECT_ARG(*TS_OBJECT_MEMBER_OF(ts_object_t*, obj, 0));
  TS_SET_OBJECT_ARG(TS_STRING_NEW_STACK(rt, ", I\'m "));
  TS_SET_OBJECT_ARG(TS_INT32_NEW_STACK(rt,
			  *TS_OBJECT_MEMBER_OF(int32_t, obj, sizeof(ts_object_t*))));
  TS_SET_OBJECT_ARG(TS_STRING_NEW_STACK(rt, " old"));

  ts_std_console_log(rt, TS_ARGUMENTS);
}

static TS_VTABLE_DEF(_person_vt, 3/*member count*/) = {
  TS_VTABLE_BASE(
    sizeof(ts_object_t) + sizeof(ts_object_t*) + sizeof(uint32_t), // size
    "Person", // name
    0, // interface count
    3, // member count
    _person_constructor,
    _person_destroy,
    NULL, // to_string
    _person_gc_visit
  ),

  { // interface for person class
    {.method = _person_say },
    {.field = sizeof(ts_object_t)}, // field name
    {.field = sizeof(ts_object_t) + sizeof(ts_object_t*)}, // field age
  }
};

///////////////////////////////////////////////////

static int _module_initialize(ts_module_t* obj, ts_argument_t args, ts_return_t ret) {
  ts_object_t* tom;
  ts_object_t* jerry;
  do {
    TS_DEF_ARGUMENTS(2);
    TS_SET_OBJECT_ARG(ts_new_string(obj->runtime, "tom", ts_true));
    TS_SET_INT_ARG(10);
    tom = ts_new_object(obj->runtime, &obj->classes[0], TS_ARGUMENTS);
  } while(0);

  do {
    TS_DEF_ARGUMENTS(2);
    TS_SET_OBJECT_ARG(ts_new_string(obj->runtime, "jerry", ts_true));
    TS_SET_INT_ARG(8);
    jerry = ts_new_object(obj->runtime, &obj->classes[0], TS_ARGUMENTS);
  } while(0);

  // call say
  ts_method_call(tom, ts_method_last + 0, NULL, NULL);
  ts_method_call(jerry, ts_method_last + 0, NULL, NULL);
  return 0;
}
// the export module interface
static TS_VTABLE_DEF(_test_class1_vt, 1/*member count*/) = {
  TS_VTABLE_BASE(
    TS_MODULE_SIZE(0, 0, 0, 1),
    "test_class1",
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

TS_EXTERN ts_module_t* _test_class1_module(ts_runtime_t* runtime) {
  ts_module_t* m = ts_new_module(runtime, &_test_class1_vt.base, 0, 0, 0, 1);

  ts_init_vtable_env(&m->classes[0], &_person_vt.base, m, NULL);

  return m;
}
