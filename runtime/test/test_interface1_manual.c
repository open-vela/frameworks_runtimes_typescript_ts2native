
#include <ts_runtime.h>
#include <ts_std.h>
#include <ts_lang.h>

static TS_INTERFACE_DEF(_Flyable_meta, "Flyable", 1);
static TS_INTERFACE_DEF(_Swimming_meta, "Swimming", 1);

static int _swan_fly(ts_object_t* self, ts_argument_t args, ts_return_t ret) {
  ts_runtime_t* rt = ts_runtime_from_object(self);
  TS_DEF_ARGUMENTS(1);
  TS_SET_OBJECT_ARG(TS_STRING_NEW_STACK(rt, "I\'m swan, I have wings, I can fly!"));
  ts_std_console_log(rt, TS_ARGUMENTS);
}

static int _swan_swim(ts_object_t* self, ts_argument_t args, ts_return_t ret) {
  ts_runtime_t* rt = ts_runtime_from_object(self);
  TS_DEF_ARGUMENTS(1);
  TS_SET_OBJECT_ARG(TS_STRING_NEW_STACK(rt, "I'm swan, I have feet with webbed toes, I can swim!"));
  ts_std_console_log(rt, TS_ARGUMENTS);
}

static TS_VTABLE_INTERFACES_DEF(_swan_vt, 2, 2) = {
  { // interfaces
    TS_INTERFACE_ENTRY(1, 1), // Swimming
    TS_INTERFACE_ENTRY(0, 0), // Flyable
  },

  TS_VTABLE_BASE(
    TS_OBJECT_SIZE_WITH_INTERFACES(ts_object_t, 2),
    "Swan", // name
    2, // interface count
    2, // member count
    NULL, // constructor
    NULL, // destroy
    NULL, // tostring
    NULL), // visitor
  {
    {.method = _swan_fly},
    {.method = _swan_swim},
  },
  {  // interfaces
    &_Flyable_meta,
    &_Swimming_meta
  }
};

//////////////////////////////////////////////////////////
static int _module_initialize(ts_module_t* m, ts_argument_t args, ts_return_t ret) {
  ts_runtime_t* rt = m->runtime;
  TS_PUSH_LOCAL_SCOPE(rt, 1);
  // new Swan
  ts_object_t* swan = ts_new_object(rt, &m->classes[0], NULL);
  TS_SET_LOCAL_OBJECT(0, swan);

  ts_interface_t* pflyable = ts_interface_from_object(swan, m->interfaces[0]);
  ts_interface_t* pswiming = ts_interface_from_object(swan, m->interfaces[1]);

  ts_interface_method_call(pflyable, 0, NULL, NULL);
  ts_interface_method_call(pswiming, 0, NULL, NULL);


  TS_POP_LOCAL_SCOPE(rt);
  ts_object_release(swan); // remove swan
}

// the export module interface
static TS_VTABLE_DEF(_test_interface1_vt, 1/*member count*/) = {
  TS_VTABLE_BASE(
    TS_MODULE_SIZE(0, 0/*values*/, 0/*functions*/, 1/*classes of functions*/, 2/*interface count*/),
    "test_interface1",
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

TS_EXTERN ts_module_t* _test_interface1_module(ts_runtime_t* runtime) {
  ts_module_t* m = ts_new_module(runtime, &_test_interface1_vt.base, 0, 0, 0, 1, 2);

  ts_init_vtable_env(&m->classes[0], &_swan_vt.base, m, NULL);

  m->interfaces[0] = &_Flyable_meta;
  m->interfaces[1] = &_Swimming_meta;

  return m;
}

