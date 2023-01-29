
#include "ts_runtime.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <dlfcn.h>

static ts_module_t* load_module(const char* module, ts_runtime_t* rt) {
  // load the module
  char module_path[512];
  char module_name[256];
  snprintf(module_path, sizeof(module_path), "./lib%s.so", module);
  void* handle = dlopen(module_path, RTLD_LAZY); 

  if (handle == NULL) {
    printf("try load \"%s\"(from \"%s\") failed: %s\n", module, module_path, dlerror());
    return NULL;
  }

  snprintf(module_name, sizeof(module_name), "_%s_module", module);
  ts_module_entry_t entry = (ts_module_entry_t)dlsym(handle, module_name);

  if (entry == NULL) {
    printf("cannot find entry \"%s\" from \"%s\"\n", module_name, module_path);
    return NULL;
  }
  ts_module_t* m = entry(rt);
  if (m == NULL) {
    printf("cannot create module with entry \"%s\" from \"%s\"\n",
		    module_name, module_path);
    return NULL;
  }
  return m;
}

int main(int argc, const char* argv[]) {
  if (argc <= 1) {
    printf("useage: %s <ts-module>\n", argv[0]);
    return 0;
  }


  ts_runtime_t* rt = ts_runtime_create(argc, argv);

  ts_module_t* m = load_module(argv[1], rt);
  if (m) {
    TS_PUSH_LOCAL_SCOPE(rt, 1);
    TS_SET_LOCAL_OBJECT(0, m);

    // call initialize
    ts_module_initialize(m);

    TS_POP_LOCAL_SCOPE(rt);
  }

  ts_runtime_destroy(rt);
}
