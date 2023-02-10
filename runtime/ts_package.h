#ifndef TS_PACKAGE_RUNTIME_H_
#define TS_PACKAGE_RUNTIME_H_

#include <stdint.h> 
#include "ts_common.h"
#include "ts_debug.h"

#include "ts_runtime.h"

TS_CPP_BEGIN

#define TS_MAGIC "MVTP"

typedef struct _ts_package_header_t ts_package_header_t;
typedef struct _ts_vtable_pkg_t ts_vtable_pkg_t;

typedef intptr_t ts_offset_t;

struct _ts_package_header_t {
  uint8_t magic[4];
  uint32_t size;
};

struct _ts_package_t {
  ts_package_header_t* header; // the package map
  ts_module_t* module; // the module
};

struct _ts_vtable_pkg_t {
  ts_interface_entry_t class_interface;
  ts_offset_t object_name;
  ts_offset_t super_index;
  uint32_t object_size: 24;
  uint32_t interfaces_count: 8;
  uint32_t base_type: 8;
  uint32_t function_return_type: 8;
  uint32_t member_count: 16;
  ts_offset_t members[4];
};

static inline ts_vtable_pkg_t* ts_vtable_pkg_from_package(ts_package_header_t* header) {
  return TS_OFFSET(ts_vtable_pkg_t, header, sizeof(ts_package_header_t));
}

static inline void* ts_vtable_pkg_offset_to_ptr(ts_vtable_pkg_t* vt_pkg, ts_offset_t offset) {
  return TS_OFFSET(void, vt_pkg, offset);
}

TS_EXPORT ts_module_t* ts_load_module(ts_runtime_t* rt, const char* path, ts_module_package_type_t package_type);


#if 0
/////////////////////////////////
static inline const char* ts_vtable_object_name_pkg(ts_vtable_t* vtable) {
  return vtable
	  ? (const char*)(TS_OFFSET(char, vtable, ((ts_vtable_pkg_t*)(vtable))->object_name))
	  : NULL;
}

static inline uint32_t ts_vtable_member_pkg(ts_vtable_t* vtable, uint32_t member_index) {
  ts_debug_check(vtable != NULL, "vtable is NULL");

  register ts_vtable_pkg_t* vt_pkg = (ts_vtable_pkg_t*)vtable;
  ts_debug_check((vt_pkg->member_count + ts_method_last) > member_index,
	"member index(%d) out of the vtable(member count: %d) in \"%s\"",
	member_index, vt_pkg->member_count + ts_method_last,
	ts_vtable_object_name_pkg(vtable));

  return vt_pkg->members[member_index];
}

static inline uint32_t ts_vtable_field_pkg(ts_vtable_t* vtable, uint32_t member_index) {
  return ts_vtable_member_pkg(vtable, member_index);
}

static inline ts_call_t ts_vtable_method_pkg(ts_vtable_t* vtable, uint32_t member_index) {
  return *TS_OFFSET(ts_call_t, vtable, ts_vtable_member_pkg(vtable, member_index));
}

static inline void* ts_field_of_pkg(ts_object_t* obj, uint32_t index) {
  ts_debug_check(obj != NULL, "object is NULL");
  return TS_OFFSET(void, obj, ts_vtable_field_pkg(OBJECT_VTABLE(obj), index));
}

static inline int ts_method_call_pkg(ts_object_t* obj, uint32_t index, ts_argument_t args, ts_return_t ret) {
  ts_debug_check(obj != NULL, "object is NULL");
  ts_call_t call = ts_vtable_method_pkg(OBJECT_VTABLE(obj), index);
  return call(obj, args, ret);
}

#endif

TS_CPP_END

#endif
