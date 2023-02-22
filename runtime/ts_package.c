
#include <unistd.h>
#include <string.h>
#include <sys/mman.h>
#include <sys/types.h>
#include <sys/stat.h>
#include <fcntl.h>
#include <sys/stat.h>
#include <dlfcn.h>

#include <stdlib.h>

#include "ts_built_in_modules.h"
#include "ts_package.h"
#include "ts_debug.h"

static void ts_remap_vtable(ts_vtable_pkg_t* vt_pkg) {
  ts_vtable_t* vt = (ts_vtable_t*) vt_pkg;
  if (vt_pkg->object_name) {
    vt->object_name = (const char*)ts_vtable_pkg_offset_to_ptr(vt_pkg, vt_pkg->object_name);
  }
  if (vt_pkg->super_index != 0) {
    // TODO
  }

  ts_offset_t* members = vt_pkg->members;
  for (int i = 0; i < ts_method_last + vt_pkg->member_count; i ++) {
    if (members[i] & 0x80000000) { // field 
      members[i] = (ts_offset_t)ts_vtable_pkg_offset_to_ptr(vt_pkg, members[i] & 0x7fffffff);
    }
  }
}

static void ts_remap_vtables(ts_vtable_pkg_t* mod_pkg_vt) {
  ts_remap_vtable(mod_pkg_vt);
  // remap others
}

/**
 * @brief search the builtin module by url
 * 
 * @param path 
 * @param szPath 
 * @return ts_boolean_t 
 */
ts_boolean_t search_builtin_module(const char* path, char* szPath) {
  for (int i = 0; built_in_modules_table[i].url; i++) {
    if (strncmp(path, built_in_modules_table[i].url, 20) == 0) { // 内置模块名不能超过20个字符
      strncpy(szPath, "built_in_", 9);
      strncpy(szPath + 9, path, 20);
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

static ts_module_t* ts_load_module_from_package(ts_runtime_t* rt, const char* path) {

  int fd = open(path, O_RDONLY);

  if (fd < 0) {
    ts_error_log("cannot open the package \"%s\"", path);
    return NULL; 
  }

  struct stat st;
  fstat(fd, &st);

  void* ptr = mmap(NULL, st.st_size, PROT_WRITE|PROT_READ, MAP_PRIVATE, fd, 0);
  
  ts_package_header_t* header = (ts_package_header_t*)ptr;
  ts_vtable_pkg_t* mod_pkg_vt = ts_vtable_pkg_from_package(header);

  ts_remap_vtables(mod_pkg_vt);

  // update the vtables
  // TODO 
  

  // remap
  mprotect(ptr, st.st_size, PROT_READ|PROT_EXEC);

  // create module
  ts_module_t* module = ts_new_module(rt, (ts_vtable_t*) mod_pkg_vt,
		     0,
		     0,
		     0,
		     0,
		     0);
  module->package = (void*)((uintptr_t)(ptr) | 1);
  close(fd);
  return module;
}

static ts_module_t* ts_load_module_from_library(ts_runtime_t* rt, const char* path) {
  void* handle = dlopen(path, RTLD_LAZY); 

  if (handle == NULL) {
    ts_error_log("try load \"%s\" failed: %s\n", path, dlerror());
    return NULL;
  }

  char szModule[128];
  char module_name[256];
  const char* module = strrchr(path, '/');
  if (module == NULL)
    module = path;
  else
    module += 1;
  if (strncmp(module, "lib", 3) == 0)
    module += 3;
  strcpy(szModule, module);
  module = strrchr(szModule, '.');
  if (module) {
    *((char*)module) = '\0';
  }

  snprintf(module_name, sizeof(module_name), "_%s_module", szModule);
  ts_module_entry_t entry = (ts_module_entry_t)dlsym(handle, module_name);

  if (entry == NULL) {
    ts_error_log("cannot find entry \"%s\" from \"%s\"\n", module_name, path);
    return NULL;
  }

  ts_module_t* m = entry(rt);

  if (m == NULL) {
    ts_error_log("cannot create module with entry \"%s\" from \"%s\"\n",
		    module_name, path);
    return NULL;
  }

  m->package = handle;

  return m;
}

static const char* search_paths[] = {
  "."
};

static ts_boolean_t find_module(const char* path, char* szPath, size_t size, const char* format) {
  char szName[256];
  snprintf(szName, sizeof(szName), format, path);

  for (size_t i = 0; i < sizeof(search_paths)/sizeof(search_paths[0]); i ++) {
    snprintf(szPath, size, "%s/%s", search_paths[i], szName);
    struct stat st;
    if (stat(szPath, &st) == 0) {
      return ts_true;
    }
  }
  return ts_false;
}

static ts_module_package_type_t ts_resolve_module_path(ts_runtime_t* rt, const char* path, char* szPath, size_t size, ts_module_package_type_t package) {
  szPath[0] = '\0';
  if (search_builtin_module(path, szPath)) { //search built_in module, szPath得改一下名字
    return ts_module_built_in;
  }

  if (strchr(path, '/') != NULL) {  // is a path
    int fd = open(path, O_RDONLY);
    if (fd < 0) {
      return ts_module_no_package;
    }
    char szMagic[4];
    read(fd, szMagic, 4);
    if (szMagic[0] == 'M' && szMagic[1] == 'V' && szMagic[2] == 'T' && szMagic[3] == 'P') {
      strncpy(szPath, path, size);
      return ts_module_package;
    } else if (szMagic[0] == 0x7f && szMagic[1] == 'E' && szMagic[2] == 'L' && szMagic[3] == 'F') {
      strncpy(szPath, path, size);
      return ts_module_dynamic_library;
    }
    return ts_module_no_package;
  }

  if (package == ts_module_dynamic_library || package == ts_module_no_package) {
    if (find_module(path, szPath, size, "lib%s.so"))
      return ts_module_dynamic_library;
  }

  if (package == ts_module_package || package == ts_module_no_package) {
    if (find_module(path, szPath, size, "%s.pkg"))
      return ts_module_package;
  }

  return ts_module_no_package;
}

TS_EXPORT ts_module_t* ts_load_module(ts_runtime_t* rt, const char* path, ts_module_package_type_t package) {
  char szPath[TS_STR_FORMAT_SIZE];
  package = ts_resolve_module_path(rt, path, szPath, sizeof(szPath), package);

  if (package == ts_module_no_package) {
    ts_error_log("Unkwon package type of file \"%s\" (resolved path: \"%s\")",
                       path, szPath);
    return NULL;
  }

  if (package == ts_module_built_in) {
    return ts_load_module_from_built_in(rt, szPath);
  }

  if (package == ts_module_package) {
    return ts_load_module_from_package(rt, szPath);
  } else {
    return ts_load_module_from_library(rt, szPath);
  }
}
