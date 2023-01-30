#include <ts_runtime.h>
#include <ts_std.h>
#include <ts_lang.h>

static int _func_impl_promise_executor1(ts_object_t* self, ts_argument_t args, ts_return_t ret) {
  /*
     console.log("==== create myPromise");
     setTimeout(() => {
      resolve("foo");
     }, 300);
   */

  ts_runtime_t* rt = ts_runtime_from_object(self);

  ts_object_t* resolver = TS_ARG_OBJECT(args, 0);
  ts_object_t* rejector = TS_ARG_OBJECT(args, 1);

  ts_object_release(rejector); // no use

  // console.log("==== create myPromise");
  do {
    TS_DEF_ARGUMENTS(1);
    TS_SET_OBJECT_ARG(TS_STRING_NEW_STACK(rt, "==== create myPromise"));
    ts_std_console_log(rt, TS_ARGUMENTS);
  } while(0);

  // create closure function
  /*
    setTimeout(() => {
      resolve("foo");
     }, 300);
   */
  ts_object_t* TS_NEW_CLOSURE_FUNC_BEGIN(closuer1,
		  ts_module_from_object(self), 1)
    TS_ADD_FUNC_CLOSURE_DATA(ts_object_t*, resolver)
  TS_NEW_CLOSURE_FUNC_END

  //setTimeout 
  do {
    TS_DEF_ARGUMENTS(2);
    TS_SET_OBJECT_ARG(closuer1);
    TS_SET_LONG_ARG(300);
    ts_std_set_timeout_params(rt, TS_ARGUMENTS);
  } while(0);
  return 0;
}

static int _func_impl_promise_resolve(ts_object_t* self, ts_argument_t args, ts_return_t ret) {
  ts_object_t* resolver = *(TS_OFFSET(ts_object_t*, self, sizeof(ts_function_t)));
  ts_runtime_t* rt = ts_runtime_from_object(self);

  /*
    console.log("==== promise resolve");
    resolve("foo");
   */
  do {
    TS_DEF_ARGUMENTS(1);
    TS_SET_OBJECT_ARG(TS_STRING_NEW_STACK(rt, "=== promise resolved"));
    ts_std_console_log(rt, TS_ARGUMENTS);
  } while(0);

  do {
    TS_DEF_ARGUMENTS(1);
    TS_SET_OBJECT_ARG(ts_new_string(rt, "foo", ts_true));
    ts_function_call(resolver, TS_ARGUMENTS, NULL);
  } while(0);

  ts_object_release(resolver);
  return 0;
}

static int _func_impl_promise_then(ts_object_t* self, const char* format, ts_argument_t args, ts_return_t ret) {
  char szbuff[256];
  ts_object_to_c_str(TS_ARG_OBJECT(args, 0), szbuff, sizeof(szbuff));
  ts_object_t* str = ts_new_string_format(
		  ts_runtime_from_object(self),
		  format, szbuff);

  ts_object_release(TS_ARG_OBJECT(args, 0));
  TS_RETURN_OBJECT(ret, str); // return the value
  return 0;
}

static int _func_impl_promise_then1(ts_object_t* self, ts_argument_t args, ts_return_t ret) {
  // (value) => `${value} and bar`
  return _func_impl_promise_then(self, "%s and bar", args, ret);
}

static int _func_impl_promise_then2(ts_object_t* self, ts_argument_t args, ts_return_t ret) {
  // (value) => `${value} and bar again`
  return _func_impl_promise_then(self, "%s and bar again", args, ret);
}

static int _func_impl_promise_then3(ts_object_t* self, ts_argument_t args, ts_return_t ret) {
  // (value) => `${value} and again`
  return _func_impl_promise_then(self, "%s and again", args, ret);
}

static int _func_impl_promise_then4(ts_object_t* self, ts_argument_t args, ts_return_t ret) {
  // console.log(value);
  TS_DEF_ARGUMENTS(1);
  TS_SET_OBJECT_ARG(TS_ARG_OBJECT(args, 0));
  ts_std_console_log(ts_runtime_from_object(self), TS_ARGUMENTS);

  ts_object_release(TS_ARG_OBJECT(args, 0));
  TS_RETURN_INT(ret, 0); // null object
  return 0;
}

// define the functions
static TS_FUNCTION_VTABLE_DEF(promise_executor1, _func_impl_promise_executor1, ts_value_void);
static TS_FUNCTION_CLOSURE_VTABLE_DEF(
	   promise_resolve,
	   _func_impl_promise_resolve,
	   ts_value_void,
	   sizeof(ts_object_t*),
	   NULL,
	   ts_closure_one_object_destroy,
	   ts_closuer_one_object_gc_visit);
static TS_FUNCTION_VTABLE_DEF(promise_then1, _func_impl_promise_then1, ts_value_object);
static TS_FUNCTION_VTABLE_DEF(promise_then2, _func_impl_promise_then2, ts_value_object);
static TS_FUNCTION_VTABLE_DEF(promise_then3, _func_impl_promise_then3, ts_value_object);
static TS_FUNCTION_VTABLE_DEF(promise_then4, _func_impl_promise_then4, ts_value_void);

static int _module_initialize(ts_module_t* obj, ts_argument_t args, ts_return_t ret) {
  ts_runtime_t* rt = obj->runtime;

  TS_PUSH_LOCAL_SCOPE(rt, 1);
  ts_object_t* promise;
  // new promise

  /*
  const myPromise = new Promise((resolve, reject) => {
  console.log("==== create myPromise");
  setTimeout(() => {
    resolve("foo");
  }, 300);
  }); */
  TS_LOCAL_OBJECT(0) = promise = ts_std_new_promise(rt, 
		  ts_new_object(rt, ts_module_class_of(obj, 0), NULL));

  // console.log("==== myPromise created!");
  do {
    TS_DEF_ARGUMENTS(1);
    TS_SET_OBJECT_ARG(TS_STRING_NEW_STACK(rt, "==== myPromise created!"));
    ts_std_console_log(rt, TS_ARGUMENTS);
  } while(0);

  // myPromise .then((value) => `${value} and bar`)
  promise = ts_std_promise_then(promise,
		  ts_new_object(rt, ts_module_class_of(obj, 2), NULL), NULL); // then1
  
  // .then((value) => `${value} and bar again`)
  promise = ts_std_promise_then(promise,
		  ts_new_object(rt, ts_module_class_of(obj, 3), NULL), NULL); // then 2

  // .then((value) => `${value} and again`)
  promise = ts_std_promise_then(promise,
		  ts_new_object(rt, ts_module_class_of(obj, 4), NULL), NULL); // then 4

  // .then((value) => `${value} and again`)
  promise = ts_std_promise_then(promise,
		  ts_new_object(rt, ts_module_class_of(obj, 4), NULL), NULL); // then 4

  // .then((value) => { console.log(value); })
  promise = ts_std_promise_then(promise,
		  ts_new_object(rt, ts_module_class_of(obj, 5), NULL), NULL); // then 5

  TS_POP_LOCAL_SCOPE(rt);
  return 0;
}

// the export module interface
static TS_VTABLE_DEF(_test_promise1_vt, 1/*member count*/) = {
  TS_MODULE_VTABLE_BASE(
    TS_MODULE_SIZE(0, 0, 0, 6, 0),
    "test_promise1",
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

TS_EXTERN ts_module_t* _test_promise1_module(ts_runtime_t* runtime) {
  ts_module_t* m = (ts_module_t*)ts_new_module(runtime, &_test_promise1_vt.base, 0, 0, 0, 6, 0);

  ts_init_vtable_env(&m->classes[0], &_promise_executor1_vt.base, m, NULL);
  ts_init_vtable_env(&m->classes[1], &_promise_resolve_vt.base, m, NULL);
  ts_init_vtable_env(&m->classes[2], &_promise_then1_vt.base, m, NULL);
  ts_init_vtable_env(&m->classes[3], &_promise_then2_vt.base, m, NULL);
  ts_init_vtable_env(&m->classes[4], &_promise_then3_vt.base, m, NULL);
  ts_init_vtable_env(&m->classes[5], &_promise_then4_vt.base, m, NULL);

  return m;
}
