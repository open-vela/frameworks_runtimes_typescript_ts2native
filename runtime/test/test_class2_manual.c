
#include <ts_runtime.h>
#include <ts_std.h>
#include <ts_lang.h>

static int _person_constructor(ts_object_t* obj, ts_argument_t args, ts_return_t ret) {
  ts_debug_check(TS_ARG_COUNT(args) >= 2, "Person constructor need 2 arguments");

  *TS_OBJECT_MEMBER_OF(ts_object_t*, obj, 0) = ts_string_dup(TS_ARG_OBJECT(args, 0));
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
  return 0;
}

#define PERSION_SIZE (sizeof(ts_object_t) + sizeof(ts_object_t*) + sizeof(uint32_t))
static TS_VTABLE_DEF(_person_vt, 3/*member count*/) = {
  TS_VTABLE_BASE(
    PERSION_SIZE, // size
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

/////////////////////////////////////
// Teacher
static int _teacher_constructor(ts_object_t* self, ts_argument_t args, ts_return_t ret) {
  // call super
  ts_super_call(self, ts_method_constructor, args, ret);
  *TS_OBJECT_MEMBER_OF(ts_object_t*, self, TS_OBJECT_SUPER_SIZE(self)) = \
       ts_string_dup(TS_ARG_OBJECT(args, 2));
  return 0;
}

static int _teacher_say(ts_object_t* self, ts_argument_t args, ts_return_t ret) {
  // call super
  ts_runtime_t* rt = ts_runtime_from_object(self);
  ts_super_call(self, ts_method_last + 0, args, ret);
  do {
    TS_DEF_ARGUMENTS(2);
    TS_SET_OBJECT_ARG(TS_STRING_NEW_STACK(rt, "I teach "));
    TS_SET_OBJECT_ARG(*TS_OBJECT_MEMBER_OF(ts_object_t*, self, TS_OBJECT_SUPER_SIZE(self)));
    ts_std_console_log(rt, TS_ARGUMENTS);
  } while(0);
}

static void _teacher_destroy(ts_object_t* obj) {
  ts_super_destroy(obj);
  ts_object_release(*TS_OBJECT_MEMBER_OF(ts_object_t*, obj, TS_OBJECT_SUPER_SIZE(obj)));
}

static void _teacher_gc_visit(ts_object_t* obj, ts_object_visitor_t visitor, void* user_data) {
  ts_super_visit(obj, visitor, user_data);
  visitor(*TS_OBJECT_MEMBER_OF(ts_object_t*, obj, TS_OBJECT_SUPER_SIZE(obj)), user_data);
}

static TS_VTABLE_DEF(_teacher_vt, 4/*member count*/) = {
  TS_VTABLE_SUPER_BASE(
    PERSION_SIZE + sizeof(ts_object_t*), // size
    "Teacher",
    &_person_vt.base,
    0, //interface count
    4, //member count
    _teacher_constructor,
    _teacher_destroy,
    NULL, // tostring
    _teacher_gc_visit),

  {
    // same as Person
    {.method = _teacher_say},
    {.field = sizeof(ts_object_t)}, // field name
    {.field = sizeof(ts_object_t) + sizeof(ts_object_t*)}, // field age
    {.field = PERSION_SIZE}, // field grade
  }
};

//////////////////////////////////////////////////
// Student
static int _student_constructor(ts_object_t* self, ts_argument_t args, ts_return_t ret) {
  // call super
  ts_super_call(self, ts_method_constructor, args, ret);
  *TS_OBJECT_MEMBER_OF(int32_t, self, TS_OBJECT_SUPER_SIZE(self)) = \
       TS_ARG_INT(args, 2);
  return 0;
}

static int _student_say(ts_object_t* self, ts_argument_t args, ts_return_t ret) {
  // call super
  ts_runtime_t* rt = ts_runtime_from_object(self);
  ts_super_call(self, ts_method_last + 0, args, ret);
  do {
    TS_DEF_ARGUMENTS(2);
    TS_SET_OBJECT_ARG(TS_STRING_NEW_STACK(rt, "I\'m in grade "));
    TS_SET_OBJECT_ARG(TS_INT32_NEW_STACK(rt, \
		 *TS_OBJECT_MEMBER_OF(int32_t, self, TS_OBJECT_SUPER_SIZE(self))));
    ts_std_console_log(rt, TS_ARGUMENTS);
  } while(0);
}

static TS_VTABLE_DEF(_student_vt, 4/*member count*/) = {
  TS_VTABLE_SUPER_BASE(
    PERSION_SIZE + sizeof(ts_object_t*), // size
    "Student",
    &_person_vt.base,
    0, //interface count
    4, //member count
    _student_constructor,
    _person_destroy,
    NULL,
    _person_gc_visit),

  {
    // same as Person
    {.method = _student_say},
    {.field = sizeof(ts_object_t)}, // field name
    {.field = sizeof(ts_object_t) + sizeof(ts_object_t*)}, // field age
    {.field = PERSION_SIZE}, // field grade
  }
};
///////////////////////////////////////////////////

static int _module_initialize(ts_module_t* obj, ts_argument_t args, ts_return_t ret) {
  ts_object_t* tom;
  ts_object_t* jerry;
  do {
    TS_DEF_ARGUMENTS(3);
    TS_SET_OBJECT_ARG(TS_STRING_NEW_STACK(obj->runtime, "tom"));
    TS_SET_INT_ARG(30);
    TS_SET_OBJECT_ARG(TS_STRING_NEW_STACK(obj->runtime, "math"));
    tom = ts_new_object(obj->runtime, &obj->classes[1], TS_ARGUMENTS);
  } while(0);

  do {
    TS_DEF_ARGUMENTS(3);
    TS_SET_OBJECT_ARG(ts_new_string(obj->runtime, "jerry", ts_true));
    TS_SET_INT_ARG(8);
    TS_SET_INT_ARG(3);  // grade
    jerry = ts_new_object(obj->runtime, &obj->classes[2], TS_ARGUMENTS);
  } while(0);

  // call say
  ts_method_call(tom, ts_method_last + 0, NULL, NULL);
  ts_method_call(jerry, ts_method_last + 0, NULL, NULL);
  return 0;
}
// the export module interface
static TS_VTABLE_DEF(_test_class2_vt, 1/*member count*/) = {
  TS_VTABLE_BASE(
    TS_MODULE_SIZE(0, 0, 0, 3, 0),
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

TS_EXTERN ts_module_t* _test_class2_module(ts_runtime_t* runtime) {
  ts_module_t* m = ts_new_module(runtime, &_test_class2_vt.base, 0, 0, 0, 3, 0);

  ts_init_vtable_env(&m->classes[0], &_person_vt.base, m, NULL);
  ts_init_vtable_env(&m->classes[1], &_teacher_vt.base, m, NULL);
  ts_init_vtable_env(&m->classes[2], &_student_vt.base, m, NULL);

  return m;
}
