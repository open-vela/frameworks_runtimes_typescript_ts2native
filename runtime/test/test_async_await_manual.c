#include <ts_runtime.h>
#include <ts_std.h>
#include <ts_lang.h>

/*
const resolver = (msg, timeout) => new Promise((resolve) => {
    console.log(msg);
    setTimeout(resolve, timeout);
});
*/

static int _func_impl_resolver_executor(ts_object_t* self, ts_argument_t args, ts_return_t ret) {

  ts_runtime_t* rt = ts_runtime_from_object(self);
  // console.log(msg);
  do {
    TS_DEF_ARGUMENTS(1);
    TS_SET_OBJECT_ARG(TS_INT32_NEW_STACK(rt, 
         (*TS_FUNC_CLOSURE_DATA(int32_t, self, 0)) // msg
       ));
    ts_std_console_log(rt, TS_ARGUMENTS);
  } while(0);

  // setTimeout(resolve, timeout);
  ts_std_set_timeout(rt, TS_ARG_OBJECT(args, 0), *TS_FUNC_CLOSURE_DATA(uint32_t, self, sizeof(uint32_t)));

  return 0;
}

static int _func_impl_resolver(ts_object_t* self, ts_argument_t args, ts_return_t ret) {
  // create promise
  ts_runtime_t* rt = ts_runtime_from_object(self);

  ts_object_t*  TS_NEW_CLOSURE_FUNC_BEGIN(closure, ts_module_from_object(self), 0)
    TS_ADD_FUNC_CLOSURE_DATA(int32_t, TS_ARG_INT(args, 0))
    TS_ADD_FUNC_CLOSURE_DATA(uint32_t, TS_ARG_INT(args, 1))
  TS_NEW_CLOSURE_FUNC_END;
  // new Promise
  ts_object_t* promise = ts_std_new_promise(rt, closure);

  TS_RETURN_OBJECT(ret, promise);
  return 0;
}

/*
async function run() {
  let a = 1;
  console.log("==1");
  await resolver(a ++, 500);
  console.log("==2");
  await resolver(a ++, 500);
  console.log("==3");
  await resolver(a ++, 500);
  console.log("==4");
  await resolver(a ++, 500);
  console.log("==5");
  await resolver(a ++, 500);
  console.log("==6");
  await resolver(a ++, 500);
  console.log("==7");
}
*/

static int _func_impl_async_run(ts_object_t* self, ts_argument_t args, ts_return_t ret) {
  ts_runtime_t* rt = ts_runtime_from_object(self);
  if (!ts_object_is_function_awaiter(self)) {
    // the run function
    // create and return a promise

    // create awaiter data
    ts_std_awaiter_t* awaiter = ts_std_new_awaiter(rt, sizeof(uint32_t), 0);
    // create awaiter function
    ts_object_t* awaiter_func = ts_std_create_awaiter_function(rt,
		 ts_module_class_of(ts_module_from_object(self), 3), awaiter);
	
    TS_STD_AWAITER_SET_LABLE(awaiter, _BEGIN); // goto awaiter
    // make awaiter function as executor
    ts_object_t* promise = ts_std_new_promise_awaiter(rt, awaiter_func);
    TS_RETURN_OBJECT(ret, promise);
    return 0;
  }

  // here is the waiter function implements
  ts_std_awaiter_t* awaiter = ts_std_awaiter_of(self); 

  TS_STD_AWAITER_GOTO_RETRUN(awaiter, 0);  // goto special label or return

_BEGIN:
  do {
    ts_object_t* resolver = TS_ARG_OBJECT(args, 0);
    ts_object_t* rejector = TS_ARG_OBJECT(args, 1);
    awaiter->promise = ts_std_promise_from(resolver);
  } while(0);
  // let a = 1;
  *TS_STD_AWAITER_DATA(awaiter, int32_t, 0) = 1;
  // console.log("==1");
  do {
    TS_DEF_ARGUMENTS(1);
    TS_SET_OBJECT_ARG(TS_STRING_NEW_STACK(rt, "==1"));
    ts_std_console_log(rt, TS_ARGUMENTS);
  } while(0);
  
  // await resolver(a++, 500);
  do {
    // promise = resolver(...);
    ts_value_t ret;
    TS_DEF_ARGUMENTS(2);
    TS_SET_INT_ARG(*TS_STD_AWAITER_DATA(awaiter, int32_t, 0));
    TS_SET_INT_ARG(500);
    ts_function_call(ts_module_function_of(ts_module_from_object(self), 0),
		    TS_ARGUMENTS, &ret);
    (*TS_STD_AWAITER_DATA(awaiter, int32_t, 0)) ++; // a++

    // insert the awaiter promise into current promise
    ts_std_promise_then_promise(ret.object, awaiter->promise);
    TS_STD_AWAITER_SET_LABLE(awaiter, _2);
  } while(0);
  return 0;

_2:
  // console.log("==2");
  do {
    TS_DEF_ARGUMENTS(1);
    TS_SET_OBJECT_ARG(TS_STRING_NEW_STACK(rt, "==2"));
    ts_std_console_log(rt, TS_ARGUMENTS);
  } while(0);
  
  // await resolver(a++, 500);
  do {
    // promise = resolver(...);
    ts_value_t ret;
    TS_DEF_ARGUMENTS(2);
    TS_SET_INT_ARG(*TS_STD_AWAITER_DATA(awaiter, int32_t, 0));
    TS_SET_INT_ARG(500);
    ts_function_call(ts_module_function_of(ts_module_from_object(self), 0),
		    TS_ARGUMENTS, &ret);
    (*TS_STD_AWAITER_DATA(awaiter, int32_t, 0)) ++; // a++

    // insert the awaiter promise into current promise
    ts_std_promise_then_promise(ret.object, awaiter->promise);
    TS_STD_AWAITER_SET_LABLE(awaiter, _3);
  } while(0);
  return 0;

_3:
  // console.log("==3");
  do {
    TS_DEF_ARGUMENTS(1);
    TS_SET_OBJECT_ARG(TS_STRING_NEW_STACK(rt, "==3"));
    ts_std_console_log(rt, TS_ARGUMENTS);
  } while(0);
  
  // await resolver(a++, 500);
  do {
    // promise = resolver(...);
    ts_value_t ret;
    TS_DEF_ARGUMENTS(2);
    TS_SET_INT_ARG(*TS_STD_AWAITER_DATA(awaiter, int32_t, 0));
    TS_SET_INT_ARG(500);
    ts_function_call(ts_module_function_of(ts_module_from_object(self), 0),
		    TS_ARGUMENTS, &ret);
    (*TS_STD_AWAITER_DATA(awaiter, int32_t, 0)) ++; // a++

    // insert the awaiter promise into current promise
    ts_std_promise_then_promise(ret.object, awaiter->promise);
    TS_STD_AWAITER_SET_LABLE(awaiter, _4);
  } while(0);
  return 0;
_4:
  // console.log("==4");
  do {
    TS_DEF_ARGUMENTS(1);
    TS_SET_OBJECT_ARG(TS_STRING_NEW_STACK(rt, "==4"));
    ts_std_console_log(rt, TS_ARGUMENTS);
  } while(0);
  
  // await resolver(a++, 500);
  do {
    // promise = resolver(...);
    ts_value_t ret;
    TS_DEF_ARGUMENTS(2);
    TS_SET_INT_ARG(*TS_STD_AWAITER_DATA(awaiter, int32_t, 0));
    TS_SET_INT_ARG(500);
    ts_function_call(ts_module_function_of(ts_module_from_object(self), 0),
		    TS_ARGUMENTS, &ret);
    (*TS_STD_AWAITER_DATA(awaiter, int32_t, 0)) ++; // a++

    // insert the awaiter promise into current promise
    ts_std_promise_then_promise(ret.object, awaiter->promise);
    TS_STD_AWAITER_SET_LABLE(awaiter, _5);
  } while(0);
  return 0;
_5:
  // console.log("==5");
  do {
    TS_DEF_ARGUMENTS(1);
    TS_SET_OBJECT_ARG(TS_STRING_NEW_STACK(rt, "==5"));
    ts_std_console_log(rt, TS_ARGUMENTS);
  } while(0);
  
  // await resolver(a++, 500);
  do {
    // promise = resolver(...);
    ts_value_t ret;
    TS_DEF_ARGUMENTS(2);
    TS_SET_INT_ARG(*TS_STD_AWAITER_DATA(awaiter, int32_t, 0));
    TS_SET_INT_ARG(500);
    ts_function_call(ts_module_function_of(ts_module_from_object(self), 0),
		    TS_ARGUMENTS, &ret);
    (*TS_STD_AWAITER_DATA(awaiter, int32_t, 0)) ++; // a++

    // insert the awaiter promise into current promise
    ts_std_promise_then_promise(ret.object, awaiter->promise);
    TS_STD_AWAITER_SET_LABLE(awaiter, _6);
  } while(0);
  return 0;
_6:
  // console.log("==6");
  do {
    TS_DEF_ARGUMENTS(1);
    TS_SET_OBJECT_ARG(TS_STRING_NEW_STACK(rt, "==6"));
    ts_std_console_log(rt, TS_ARGUMENTS);
  } while(0);
  
  // await resolver(a++, 500);
  do {
    // promise = resolver(...);
    ts_value_t ret;
    TS_DEF_ARGUMENTS(2);
    TS_SET_INT_ARG(*TS_STD_AWAITER_DATA(awaiter, int32_t, 0));
    TS_SET_INT_ARG(500);
    ts_function_call(ts_module_function_of(ts_module_from_object(self), 0),
		    TS_ARGUMENTS, &ret);
    (*TS_STD_AWAITER_DATA(awaiter, int32_t, 0)) ++; // a++

    // insert the awaiter promise into current promise
    ts_std_promise_then_promise(ret.object, awaiter->promise);
    TS_STD_AWAITER_SET_LABLE(awaiter, _7);
  } while(0);
  return 0;
_7:
  // console.log("==7");
  do {
    TS_DEF_ARGUMENTS(1);
    TS_SET_OBJECT_ARG(TS_STRING_NEW_STACK(rt, "==7"));
    ts_std_console_log(rt, TS_ARGUMENTS);
  } while(0);
  
  // await resolver(a++, 500);
  do {
    // promise = resolver(...);
    ts_value_t ret;
    TS_DEF_ARGUMENTS(2);
    TS_SET_INT_ARG(*TS_STD_AWAITER_DATA(awaiter, int32_t, 0));
    TS_SET_INT_ARG(500);
    ts_function_call(ts_module_function_of(ts_module_from_object(self), 0),
		    TS_ARGUMENTS, &ret);
    (*TS_STD_AWAITER_DATA(awaiter, int32_t, 0)) ++; // a++

    // insert the awaiter promise into current promise
    ts_std_promise_then_promise(ret.object, awaiter->promise);
    TS_STD_AWAITER_SET_END(awaiter);
  } while(0);

  // delete the await function
  ts_object_release(self);
  return 0;
}

static TS_FUNCTION_CLOSURE_VTABLE_DEF(
		resolver_executor,
		_func_impl_resolver_executor,
		ts_value_void,
		sizeof(uint32_t) + sizeof(uint32_t),
		NULL,
		NULL,
		NULL);
static TS_FUNCTION_VTABLE_DEF(resolver, _func_impl_resolver, ts_value_object);
static TS_FUNCTION_VTABLE_DEF(async_run, _func_impl_async_run, ts_value_object);
static TS_FUNCTION_AWAITER_VTABLE_DEF(async_run, _func_impl_async_run);

static int _module_initialize(ts_module_t* obj, ts_argument_t args, ts_return_t ret) {
  ts_runtime_t* rt = obj->runtime;

  // call run
  ts_module_call_function(obj, 1, NULL, NULL);
  return 0;
}

// the export module interface
static TS_VTABLE_DEF(_test_async_await_vt, 1/*member count*/) = {
  TS_MODULE_VTABLE_BASE(
    TS_MODULE_SIZE(0, 0, 2, 4, 0),
    "test_async_await",
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

TS_EXTERN ts_module_t* _test_async_await_module(ts_runtime_t* runtime) {
  ts_module_t* m = (ts_module_t*)ts_new_module(runtime, &_test_async_await_vt.base, 0, 0, 2, 4, 0);

  ts_init_vtable_env(&m->classes[0], &_resolver_executor_vt.base, m, NULL);
  ts_init_vtable_env(&m->classes[1], &_resolver_vt.base, m, NULL);
  ts_init_vtable_env(&m->classes[2], &_async_run_vt.base, m, NULL);
  ts_init_vtable_env(&m->classes[3], &_async_run_awaiter_vt.base, m, NULL);

  // init functions
  m->functions[0] = ts_new_object(runtime, &m->classes[1], NULL);
  m->functions[1] = ts_new_object(runtime, &m->classes[2], NULL);

  return m;
}
