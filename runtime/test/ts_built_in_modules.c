#include "ts_built_in_modules.h"

#define V(url) {#url, "built_in_" #url, _##url##_module }

static ts_built_in_module_t built_in_modules_table[] = {
  V(test_async_await),
  V(test_class1),
  V(test_class2),
  V(test_function1),
  V(test_function2),
  V(test_hello),
  V(test_interface1),
  V(test_interface2),
  V(test_promise1),
  V(test_timeout),
  V(test_trycatch),
  V(test_union1),
  {0}
};
#undef V

/**
 * @brief search the builtin module by url
 * 
 * @param path 
 * @param szPath 
 * @return ts_boolean_t 
 */
ts_boolean_t search_builtin_module(const char* path, char* szPath) {
  for (int i = 0; built_in_modules_table[i].url; i++) {
    if (strncmp(path, built_in_modules_table[i].url, BUILT_IN_MAXNAMESIZE) == 0) {
      strncpy(szPath, "built_in_", 10);
      strncpy(szPath + 9, path, BUILT_IN_MAXNAMESIZE);
      return 1;
    }
  }
  return 0;
}

/**
 * @brief return the builtin module info
 * 
 * @param path 
 * @return ts_built_in_module_t* 
 */
ts_built_in_module_t* find_built_in_module(const char* path) {
  ts_built_in_module_t *p = built_in_modules_table;
  for (;p->module_name; p++) {
    if (strncmp(p->module_name, path, 20) == 0) {
      return p;
    }
  }
  return NULL;
}

/**
 * @brief load buildin modules into runtime
 * 
 * @param rt 
 * @param path 
 * @return ts_module_t* 
 */
static ts_module_t* ts_load_module_from_built_in(ts_runtime_t* rt, const char* path) {
  ts_built_in_module_t* module_info = find_built_in_module(path);
  if (!module_info) {
    ts_error_log("cannot create module with entry from \"%s\"\n",
		    path);
    return NULL;
  }
  ts_module_t* m = module_info->module_register(rt);
  if (m == NULL) {
    ts_error_log("cannot create module with entry \"%s\" from \"%s\"\n",
		    module_info->module_name, path);
    return NULL;
  }

  m->package = module_info;

  return m;
}

ts_module_t* ts_try_load_module_from_built_in(ts_runtime_t* rt, const char* path) {
  char szPath[TS_STR_FORMAT_SIZE] = {0};
  if (!search_builtin_module(path, szPath)) { //search built_in module, szPath得改一下名字
    return NULL;
  }
  return ts_load_module_from_built_in(rt, szPath);
}