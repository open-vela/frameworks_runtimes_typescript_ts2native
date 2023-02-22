#ifndef TS_BUILT_IN_MODULES_H_
#define TS_BUILT_IN_MODULES_H_

#include "ts_common.h"
#include "ts_runtime.h"

#define V(url) \
    TS_EXTERN ts_module_t* _##url##_module(ts_runtime_t* runtime);

//V(test_class2)
//V(test_async_await)
//V(test_class1)
//V(test_class2)
//V(test_function1)
//V(test_function2)
V(test_hello)
//V(test_interface1)
//V(test_interface2)
//V(test_promise1)
//V(test_timeout)
//V(test_trycatch)
//V(test_union1)
#undef V

#define BUILT_IN_MSIZE 20
#define V(url) {#url, "built_in_" #url, _##url##_module }

typedef ts_module_t* (*ts_register_func)(ts_runtime_t*);
typedef struct {
  char* url;
  char* module_name;
  ts_register_func module_register;
} ts_built_in_module_t;

ts_built_in_module_t built_in_modules_table[BUILT_IN_MSIZE] = {
//  V(test_class2),
//  V(test_async_await),
//  V(test_class1),
//  V(test_class2),
//  V(test_function1),
//  V(test_function2),
V(test_hello),
//  V(test_interface1),
//  V(test_interface2),
//  V(test_promise1),
//  V(test_timeout),
//  V(test_trycatch),
//  V(test_union1),
  0
};
#undef V

#endif  // TS_COMMON_H_
