#ifndef TS_RUNTIME_H_
#define TS_RUNTIME_H_

#include <stdint.h> 
#include <alloca.h>

#include "ts_common.h"
#include "ts_debug.h"
#include "ts_gc.h"

TS_CPP_BEGIN

#define OBJECT_VTABLE(obj)  ((obj)->vtable_env->vtable)


typedef int ts_boolean_t;
#define ts_true  1
#define ts_false 0

typedef struct _ts_try_block_t ts_try_block_t;

typedef struct _ts_runtime_t  ts_runtime_t;
typedef struct _ts_object_t   ts_object_t;
typedef struct _ts_module_t   ts_module_t;
typedef struct _ts_function_t ts_function_t;
typedef struct _ts_vtable_t   ts_vtable_t;
typedef struct _ts_vtable_env_t   ts_vtable_env_t;
typedef struct _ts_interface_entry_t ts_interface_entry_t;
typedef struct _ts_interface_t ts_interface_t;
typedef struct _ts_interface_meta_t ts_interface_meta_t;

typedef enum _ts_value_type_t {
  ts_value_void,
  ts_value_int,
  ts_value_uint,
  ts_value_int64,
  ts_value_uint64,
  ts_value_boolean,
  ts_value_float,
  ts_value_double,
  ts_value_object
} ts_value_type_t;

typedef enum _ts_object_base_type_t {
  ts_object_object,
  ts_object_primitive_begin,
  ts_object_int32,
  ts_object_uint32,
  ts_object_int64,
  ts_object_uint64,
  ts_object_boolean,
  ts_object_float,
  ts_object_double,
  ts_object_primitive_end = ts_object_double,
  ts_object_builtin_begin,
  ts_object_bigint = ts_object_builtin_begin,
  ts_object_string,
  ts_object_array,
  ts_object_map,
  ts_object_set,
  ts_object_builtin_end = ts_object_set,

  ts_object_function,
  ts_object_function_awaiter, // awaiter wrapper of async function
  ts_object_module,
} ts_object_base_type_t;

typedef union _ts_value_t {
  int32_t  ival;
  int64_t  lval;
  float    fval;
  double   dval;
  ts_object_t* object;
  char*    str;
  void*    ptr;
} ts_value_t;
typedef const ts_value_t*  ts_argument_t;
typedef ts_value_t*        ts_return_t;

typedef int (*ts_call_t)(ts_object_t* self, ts_argument_t, ts_return_t);
typedef void (*ts_finialize_t)(ts_object_t* self);
typedef ts_object_t* (*ts_to_string_t)(ts_object_t* self);
typedef void (*ts_object_visitor_t)(ts_object_t* obj, void* user_data);
typedef void (*ts_gc_visit_t)(ts_object_t* self, ts_object_visitor_t visitor, void*  user_data);
typedef ts_module_t* (*ts_module_entry_t)(ts_runtime_t* rt);

typedef union _ts_member_t {
  intptr_t  field; // field offset
  ts_call_t method;
} ts_member_t;

struct _ts_interface_entry_t {
  uint32_t object_offset:16; // by bytes
  uint32_t member_offset:16; // the member count offset by ts_member_t
};

struct _ts_interface_t {
  ts_interface_entry_t* interface_entry;
};

struct _ts_interface_meta_t {
  const char* interface_name;
  uint32_t member_count:16;
  uint32_t supers:16;
};

struct _ts_vtable_t {
  ts_interface_entry_t class_interface;
  const char* object_name;
  ts_vtable_t* super;
  uint32_t object_size:24;
  uint32_t interfaces_count:8;
  uint32_t base_type:8;  // ts_object_base_type_t
  uint32_t function_return_type:8; // ts_value_t, only for function
  uint32_t member_count:16;
  ts_call_t constructor;
  ts_finialize_t destroy;
  ts_to_string_t to_string;
  ts_gc_visit_t  gc_visit;
};

#define TS_VTABLE_DEF(name, N) struct { \
  ts_vtable_t base; \
  ts_member_t members[N]; \
} name

#define TS_VTABLE_NEMBER_COUNT(name)   (sizeof(name.members) / sizeof(name.members[0]))

#define TS_VTABLE_INTERFACES_DEF(name, MemberN, IntfN) struct { \
  ts_interface_entry_t interfaces[IntfN]; \
  ts_vtable_t base; \
  ts_member_t members[MemberN]; \
  ts_interface_meta_t* interface_metas[IntfN]; \
} name

#define TS_VTABLE_THIS_INTERFACE_ENTRY {0, sizeof(ts_vtable_t)}
#define TS_INTERFACE_ENTRY(index, member_start) { \
	sizeof(ts_interface_t)*((index) + 1), \
	ts_method_last +  member_start \
   }
#define TS_VTABLE_SUPER_BASE(size, name, super, intf_count, mem_count, ctr, dstry, to_str, visitor) \
{                                 \
  TS_VTABLE_THIS_INTERFACE_ENTRY, \
  name,                           \
  super,                          \
  size,                           \
  intf_count,                     \
  ts_object_object,               \
  0,   /*function type*/          \
  mem_count,                      \
  ctr,                            \
  dstry,                          \
  to_str,                         \
  visitor                         \
}

#define TS_BASE_VTABLE_BASE(size, name, base_type, intf_count, mem_count, ctr, dstry, to_str, visitor) \
{                                 \
  TS_VTABLE_THIS_INTERFACE_ENTRY, \
  name,                           \
  NULL,                           \
  size,                           \
  intf_count,                     \
  base_type,                      \
  0, /* function return type*/    \
  mem_count,                      \
  ctr,                            \
  dstry,                          \
  to_str,                         \
  visitor                         \
}

#define TS_MODULE_VTABLE_BASE(size, name, intf_count, mem_count, ctr, dstry, to_str, visitor) \
  TS_BASE_VTABLE_BASE(size, name, ts_object_module, intf_count, mem_count, ctr, dstry, to_str, visitor)

#define TS_VTABLE_BASE(size, name, intf_count, mem_count, ctr, dstry, to_str, visitor) \
  TS_VTABLE_SUPER_BASE(size, name, NULL, intf_count, mem_count, ctr, dstry, to_str, visitor)

#define TS_INTERFACE_DEF(varname, name, member_count) \
  ts_interface_meta_t varname = {name, member_count, 0}

#define TS_INTERFACE_SUPERS_DEF(varname, super_count) \
  struct { \
    ts_interface_meta_t base; \
    ts_interface_meta_t* supers[super_count]; \
  } varname

#define TS_OBJECT_SIZE_WITH_INTERFACES(type, N) (sizeof(type) + sizeof(ts_interface_t) * (N))

struct _ts_vtable_env_t {
  ts_interface_entry_t class_interface; // make ts_vtabel_env_t as a interface
  ts_vtable_t* vtable;
  ts_vtable_env_t* super; // TODO no use class extends only in one module
  ts_module_t* env;
  ts_value_t** static_fields;
};

typedef enum _ts_method_index_t {
  ts_method_constructor = 0,
  ts_method_destroy,
  ts_method_to_string,
  ts_method_gc_visit,
  ts_method_last,
} ts_method_index_t;

/////////////////////////////////////
// ts_object_t
struct _ts_object_t {
  ts_vtable_env_t* vtable_env;
};

//////////////////////////////////
// ts_module
struct _ts_module_t {
  ts_object_t base;
  void* package;
  ts_runtime_t *runtime;
  ts_module_t** imports;
  ts_value_t*  values;
  ts_object_t** functions;
  ts_vtable_env_t*  classes;
  ts_interface_meta_t** interfaces; 
  ts_vtable_env_t   _self_env; // save this env
};

#define TS_MODULE_SIZE(imports, values, functions, classes, interfaces) \
  (sizeof(ts_module_t) + \
   sizeof(ts_module_t*)*(imports) + \
   sizeof(ts_value_t)*(values) + \
   sizeof(ts_function_t)*(functions) + \
   sizeof(ts_vtable_env_t)*(classes)) + \
   sizeof(ts_interface_meta_t*)*(interfaces)

typedef enum _ts_module_package_type_t {
  ts_module_no_package,
  ts_module_dynamic_library,
  ts_module_package
} ts_module_package_type_t;

typedef enum _ts_module_method_index_t {
  ts_module_initialize_index = ts_method_last,
} ts_module_method_index_t;

static inline ts_module_package_type_t ts_module_package_type(ts_module_t* m) {
  return !m || !m->package ? ts_module_no_package
	  : ((((uintptr_t)m->package) & 1) == 1 
			  ? ts_module_package : ts_module_dynamic_library);
}

///////////////////////////////////
// ts_function
struct _ts_function_t {
  ts_object_t base;
};

typedef enum _ts_function_method_index_t {
  ts_function_call_index = ts_method_last,
} ts_function_method_index_t;

//////////////////////////////
//
typedef void* ts_std_task_t;
typedef struct _ts_std_backend_t {
  // support by std module
  void (*on_timeout)(ts_runtime_t* rt, uint64_t timeout);
  void (*on_root_exception)(ts_runtime_t* rt);

  // support by the external
  void* backend_data;
  uint64_t (*get_current_timeout)(void* data);
  void (*set_next_timeout)(uint64_t timeout, void* data);
  ts_std_task_t (*create_task)(void(*task_impl)(void*), void* data, void(*free_data)(void*), void* backend_data);
  void (*post_task_delay)(ts_std_task_t task, uint32_t delayms, void* data);
} ts_std_backend_t;

// ts_runtime
struct _ts_runtime_t {
  ts_gc_t *gc;
  // new / delete object
  ts_object_t* (* new_object)(ts_gc_t*, ts_vtable_env_t*, ts_argument_t);
  void (* delete_object)(ts_gc_t*, ts_object_t*);
  void* (*gc_alloc)(ts_gc_t*, size_t size);
  void  (*gc_free)(ts_gc_t*, void*);

  // strong reference
  ts_gc_strong_ptr_t (*make_strong_ref)(ts_gc_t*, void* ptr);
  void (*free_strong_ref)(ts_gc_t*, ts_gc_strong_ptr_t strong_ref);
  ts_object_t* (*get_object_from_strong)(ts_gc_t*, ts_gc_weak_ptr_t);

  // weak reference
  ts_gc_weak_ptr_t (*make_weak_ref)(ts_gc_t*, void* ptr);
  void (*free_weak_ref)(ts_gc_t*, ts_gc_weak_ptr_t weak_ref);
  ts_object_t* (*get_object_from_weak)(ts_gc_t*, ts_gc_weak_ptr_t);

  void (*do_gc)(ts_gc_t* gc, ts_gc_level_t level);

  // local reference
  void (*push_local_scope)(ts_gc_t* gc, ts_gc_local_scope_t* scope);
  void (*pop_local_scope)(ts_gc_t* gc, ts_gc_local_scope_t* scope);
  ts_gc_local_scope_t* (*get_top_local_scope)(ts_gc_t* gc);

  ts_try_block_t* try_block;
  ts_object_t*    exception_value;

  ts_module_t* std_module; // the std_module;
  ts_std_backend_t std_backend;
};

ts_runtime_t* ts_runtime_create(int argc, const char* argv[]);
void ts_runtime_destroy(ts_runtime_t*);


/////////////////////////////////////////////
static inline ts_object_t* ts_new_object(ts_runtime_t* rt, ts_vtable_env_t* vt_env, ts_argument_t args) {
  return rt->new_object(rt->gc, vt_env, args);
}

static inline void ts_object_init(ts_object_t* self, ts_vtable_env_t* vt_env, ts_argument_t args) {
  self->vtable_env = vt_env;
  if (vt_env->vtable->constructor) {
    vt_env->vtable->constructor(self, args, NULL);
  }
}

static inline ts_object_t* ts_object_to_string(ts_object_t* obj) {
  return obj && OBJECT_VTABLE(obj)->to_string ?
	OBJECT_VTABLE(obj)->to_string(obj) : NULL;
}

static inline void ts_init_vtable_env(ts_vtable_env_t* vt_env, ts_vtable_t* vt, ts_module_t* own_module, ts_vtable_env_t* super) {
  vt_env->class_interface.object_offset = 0;
  vt_env->class_interface.member_offset = ts_method_last;
  vt_env->vtable = vt;
  vt_env->super = super;
  vt_env->env = own_module;
}

static inline ts_module_t* ts_module_from_object(ts_object_t* obj) {
  return obj ? obj->vtable_env->env : NULL;
}

static inline ts_runtime_t* ts_runtime_from_object(ts_object_t* obj) {
  return obj ? ts_module_from_object(obj)->runtime : NULL;
}

static inline ts_object_t* ts_object_add_ref(ts_object_t* obj) {
  if (obj) {
    ts_gc_data_header_t* header = TS_OFFSET(ts_gc_data_header_t, obj, -sizeof(ts_gc_data_header_t));
    header->ref_count ++;
    return obj;
  }
}
static inline void ts_object_release(ts_object_t* obj) {
  if (obj) {
    ts_gc_data_header_t* header = TS_OFFSET(ts_gc_data_header_t, obj, -sizeof(ts_gc_data_header_t));
    if (-- header->ref_count == 0) {
      ts_runtime_t* rt = ts_runtime_from_object(obj);
      rt->delete_object(rt->gc, obj);
    }
  }
}

static inline ts_module_t* ts_new_module(ts_runtime_t* rt,
		ts_vtable_t* vt,
		uint32_t imports,
		uint32_t values,
		uint32_t functions,
		uint32_t classes,
		uint32_t interfaces) {
  ts_vtable_env_t module_vt = {
    TS_VTABLE_THIS_INTERFACE_ENTRY,
    vt,
    NULL,
    NULL,
  };
  ts_module_t* m = (ts_module_t*)(rt->new_object(rt->gc, &module_vt, NULL));
  m->runtime = rt;

  ts_init_vtable_env(&m->_self_env, vt, m, NULL);
  m->base.vtable_env = &m->_self_env;

  m->package = NULL;

  m->imports = TS_OFFSET(ts_module_t*, m, sizeof(ts_module_t));
  m->values =  TS_OFFSET(ts_value_t, m->imports, sizeof(ts_module_t*) * imports);
  m->functions = TS_OFFSET(ts_object_t*, m->values, sizeof(ts_value_t) * values);
  m->classes = TS_OFFSET(ts_vtable_env_t, m->functions, sizeof(ts_function_t*) * functions);
  m->interfaces = TS_OFFSET(ts_interface_meta_t*, m->classes, sizeof(ts_vtable_env_t) * classes);

  if (imports == 0)
    m->imports = NULL;
  if (values == 0)
    m->values = NULL;

  if (functions == 0)
    m->functions = NULL;

  if (classes == 0)
    m->classes = NULL;

  if (interfaces == 0)
    m->interfaces = NULL;

  return m;
}

static inline ts_member_t ts_vtable_member(ts_vtable_t* vtable, uint32_t member_index) {
  ts_debug_check(vtable != NULL, "vtable is NULL");
  ts_debug_check((vtable->member_count + ts_method_last) > member_index,
	 "member index(%d) out of the vtable(member count: %d) in \"%s\"", \
	 member_index, vtable->member_count + ts_method_last, vtable->object_name);
  return *TS_OFFSET(ts_member_t, &vtable->constructor, sizeof(ts_member_t)*member_index);
}

static inline void* ts_field_of(ts_object_t* obj, uint32_t index) {
  ts_debug_check(obj != NULL, "object is NULL");
  ts_member_t member = ts_vtable_member(OBJECT_VTABLE(obj), index);
  return TS_OFFSET(void, obj, member.field);
}

#define TS_GET_FIELD(type, self, index) \
   (*((type*)ts_field_of(self, (index))))

#define TS_SET_FIELD(type, self, index, value) do{ \
   (*((type*)ts_field_of(self, (index)))) = (value); \
 } while(0)

static inline int ts_method_call(ts_object_t* obj, uint32_t index, ts_argument_t args, ts_return_t ret) {
  ts_debug_check(obj != NULL, "object is NULL");
  ts_member_t member = ts_vtable_member(OBJECT_VTABLE(obj), index);
  ts_debug_check(member.method != NULL, \
		 "method %d of \"%s\" is NULL", index, OBJECT_VTABLE(obj)->object_name);
  return (member.method)(obj, args, ret);
}

static inline ts_value_t ts_method_call_return(ts_object_t* obj, uint32_t index, ts_argument_t args) {
  ts_value_t ret;
  ts_method_call(obj, index, args, &ret);
  return ret;
}

static inline int ts_super_call(ts_object_t* obj, uint32_t index, ts_argument_t args, ts_return_t ret) {
  ts_debug_check(obj != NULL, "object is NULL");
  ts_debug_check(OBJECT_VTABLE(obj)->super != NULL,
		  "object %p(\"%s\") \'s super is NULL", obj, OBJECT_VTABLE(obj)->object_name);
  ts_member_t member = ts_vtable_member(OBJECT_VTABLE(obj)->super, index);
  return (member.method)(obj, args, ret);
}

static inline ts_value_t ts_super_call_return(ts_object_t* obj, uint32_t index, ts_argument_t args) {
  ts_value_t ret;
  ts_super_call(obj, index, args, &ret);
  return ret;
}

static inline void ts_super_destroy(ts_object_t* obj) {
  if (OBJECT_VTABLE(obj)->super->destroy) {
    OBJECT_VTABLE(obj)->super->destroy(obj);
  }
}

static inline void ts_super_visit(ts_object_t* obj, ts_object_visitor_t visitor, void* user_data) {
  if (OBJECT_VTABLE(obj)->super->gc_visit) {
    OBJECT_VTABLE(obj)->super->gc_visit(obj, visitor, user_data);
  }
}

static inline ts_object_t* ts_cast_interface_object(ts_interface_t* self) {
  return TS_OFFSET(ts_object_t, self, (self->interface_entry->object_offset));
}

static inline ts_interface_meta_t** ts_interface_meta_from_vtable(ts_vtable_t* v) {
  return TS_OFFSET(ts_interface_meta_t*, v,
		  sizeof(ts_vtable_t) + sizeof(ts_member_t) * (v->member_count));
}

static inline ts_interface_t* ts_interface_from_object(ts_object_t* obj, ts_interface_meta_t* intf_meta) {
  ts_vtable_t* vt = OBJECT_VTABLE(obj);
  ts_interface_meta_t** meta = ts_interface_meta_from_vtable(vt);
  for (uint32_t i = 0; i < vt->interfaces_count; i++) {
    if (meta[i] == intf_meta) {
      return TS_OFFSET(ts_interface_t, obj, - sizeof(ts_interface_t) * (i + 1));
    }
  }

  return NULL;
}

static inline void* ts_interface_field(ts_interface_t* self, uint32_t index) {
  ts_debug_check(self != NULL, "interface pointer is NULL");

  ts_object_t* obj  = ts_cast_interface_object(self);

  return ts_field_of(obj, self->interface_entry->member_offset + index);
}

static inline int ts_interface_method_call(ts_interface_t* self, uint32_t index, ts_argument_t args, ts_return_t ret) {
  ts_debug_check(self != NULL, "interface pointer is NULL");

  ts_object_t* obj  = ts_cast_interface_object(self);

  return ts_method_call(obj, self->interface_entry->member_offset + index, args, ret);
}

static inline ts_value_t ts_interface_method_call_return(ts_interface_t* self, uint32_t index, ts_argument_t args) {
  ts_value_t ret;
  ts_interface_method_call(self, index, args, &ret);
  return ret;
}

#define TS_OBJECT_MEMBER_OF(Type, obj, offset) \
  TS_OFFSET(Type, obj, sizeof(ts_object_t) + (offset))

#define TS_OBJECT_SIZE(obj)  (OBJECT_VTABLE(obj)->object_size)
#define TS_OBJECT_SUPER_SIZE(obj) (OBJECT_VTABLE(obj)->super->object_size)

/////////////////////////////////////////////
// object functions
inline static ts_object_t* ts_reset_object(ts_object_t** dst, ts_object_t* src) {
  ts_object_release(*dst);
  *dst = src;
  return *dst;
}

inline static ts_object_t* ts_reset_object_add_ref(ts_object_t** dst, ts_object_t* src) {
  return ts_object_add_ref(ts_reset_object(dst, src));
}

inline static ts_object_base_type_t ts_object_base_type(ts_object_t* obj) {
  return OBJECT_VTABLE(obj)->base_type;
}

inline static ts_boolean_t ts_object_is_module(ts_object_t* obj) {
  return ts_object_base_type(obj) == ts_object_module;
}

inline static ts_boolean_t ts_object_is_function(ts_object_t* obj) {
  return ts_object_base_type(obj) == ts_object_function;
}

inline static ts_boolean_t ts_object_is_function_awaiter(ts_object_t* obj) {
  return ts_object_base_type(obj) == ts_object_function_awaiter;
}

inline static ts_boolean_t ts_object_is_primitive(ts_object_t* obj) {
  return ts_object_base_type(obj) >= ts_object_primitive_begin
	  && ts_object_base_type(obj) <= ts_object_primitive_end;
}

inline static ts_boolean_t ts_object_is_string(ts_object_t* obj) {
  return ts_object_base_type(obj) == ts_object_string;
}

inline static ts_boolean_t ts_object_is_normal(ts_object_t* obj) {
  return ts_object_base_type(obj) == ts_object_object;
}

inline static ts_boolean_t ts_object_instance_of(ts_object_t* obj, ts_vtable_env_t* vt_env) {
  ts_vtable_env_t* obj_env = obj->vtable_env;
  while (obj_env) {
    if (obj_env == vt_env) return ts_true;
    obj_env = obj_env->super;
  }
  return ts_false;
}

///////////////////////////////////////////////
// module method
inline static ts_value_t* ts_module_value_of(ts_module_t* module, int index) {
  return &module->values[index]; 
}

inline static ts_object_t* ts_module_object_of(ts_module_t* module, int index) {
  return ts_module_value_of(module, index)->object;
}

inline static ts_object_t* ts_module_function_of(ts_module_t* module, int index) {
  return module->functions[index];
}

inline static ts_vtable_env_t* ts_module_class_of(ts_module_t* module, int index) {
  return &module->classes[index];
}

inline static int ts_module_call_function(ts_module_t* module, int index, ts_argument_t args, ts_return_t ret) {
  return ts_method_call(ts_module_function_of(module, index),
	   ts_function_call_index, args, ret);
}

inline static void ts_module_initialize(ts_module_t* module) {
  ts_method_call(&module->base, ts_module_initialize_index, NULL, NULL);
}

/////////////////////////////////////////////////
// function method
inline static int ts_function_call(ts_object_t* self, ts_argument_t args, ts_return_t ret) {
  return ts_method_call(self, ts_function_call_index, args, ret);
}

inline static ts_value_type_t ts_function_return_type(ts_object_t* self) {
  return self ? OBJECT_VTABLE(self)->function_return_type : ts_value_void;
}
//////////////////////////////////////////
// GC Functions
inline static ts_gc_local_scope_t* ts_gc_make_local_scope(ts_runtime_t* r, void* buffer, size_t max_objects) {
  ts_gc_local_scope_t* scope = (ts_gc_local_scope_t*)(buffer);
  scope->objects[max_objects - 1] = NULL;

  r->push_local_scope(r->gc, scope);
  return scope;
}

#define TS_PUSH_LOCAL_SCOPE(runtime, N) \
  ts_gc_local_scope_t* __ts_local_scope__ = \
      ts_gc_make_local_scope((runtime), \
		   alloca(sizeof(ts_gc_local_scope_t) + sizeof(ts_object_t*) * ((N)+1)), \
		   (N) + 1)

#define TS_POP_LOCAL_SCOPE(runtime) \
      (runtime)->pop_local_scope((runtime)->gc, __ts_local_scope__)

#define TS_LOCAL_OBJECT(I) (__ts_local_scope__->objects[I])
#define TS_SET_LOCAL_OBJECT(I, obj)  TS_LOCAL_OBJECT(I) = (ts_object_t*)(obj)

///////////////////////////////////////////////////////////////
// ts arguments
#define TS_DEF_ARGUMENTS(N)               \
  ts_value_t __arguments[((N) & 0xff)+1]; \
  __arguments[0].lval = ((N) & 0xff);     \
  ts_value_t* __cur_arg = &__arguments[1]

#define TS_ARGUMENTS  __arguments

#define TS_SET_INT_ARG(arg) \
  (__cur_arg ++)->ival = arg

#define TS_SET_INT64_ARG(arg) \
  (__cur_arg ++)->lval = arg

#define TS_SET_FLOAT_ARG(arg) \
  (__cur_arg ++)->fval = arg

#define TS_SET_DOUBLE_ARG(arg) \
  (__cur_arg ++)->dval = arg

#define TS_SET_OBJECT_ARG(arg) do { \
  __arguments[0].lval |= (1l << ((__cur_arg - __arguments) + 8 - 1)); \
  (__cur_arg ++)->object = (ts_object_t*)(arg); \
} while(0)

#define TS_SET_STR_ARG(c_str) \
  (__cur_arg ++)->str = (char*)(c_str)

#define TS_SET_PTR_ARG(ptr) \
  (__cur_arg ++)->otr = (void*)(ptr)

#define TS_CHECK_ARG_IS_OBJECT(lval, i)  (((lval) & (1 << (i + 8))) != 0)
#define TS_GET_ARG_COUNT(lval)  ((lval) & 0xff)
#define TS_CHECK_ARG_HAS_OBJECTS(lval)   (((lval) >> 8) != 0)

#define TS_ARG_COUNT(args)      TS_GET_ARG_COUNT((args)[0].lval)
#define TS_ARG_IS_OBJECT(args, i) TS_CHECK_ARG_IS_OBJECT((args)[0].lval, i)
#define TS_ARG_HAS_OBJECTS(args) TS_CHECK_ARG_HAS_OBJECTS((args)[0].lval)
#define TS_GET_ARG(args, i)     (args)[(i)+1]
#define TS_ARG_INT(args, i)     (args)[(i)+1].ival
#define TS_ARG_INT64(args, i)   (args)[(i)+1].lval
#define TS_ARG_FLOAT(args, i)   (args)[(i)+1].fval
#define TS_ARG_DOUBLE(args, i)  (args)[(i)+1].dval
#define TS_ARG_OBJECT(args, i)  (args)[(i)+1].object
#define TS_ARG_STR(args, i)     (args)[(i)+1].str
#define TS_ARG_PTR(args, i)     (args)[(i)+1].ptr

#define TS_RETURN_INT(ret, i)     do{if((ret))(ret)->ival = (i);}while(0)
#define TS_RETURN_INT64(ret, i)   do{if((ret))(ret)->lval = (i);}while(0)
#define TS_RETURN_FLOAT(ret, f)   do{if((ret))(ret)->fval = (f);}while(0)
#define TS_RETURN_DOUBLE(ret, f)  do{if((ret))(ret)->dval = (f);}while(0)
#define TS_RETURN_OBJECT(ret, o)  do{if((ret))(ret)->object = (ts_object_t*)(o);}while(0)
#define TS_RETURN_STR(ret, s)     do{if((ret))(ret)->str = (s);}while(0)
#define TS_RETURN_PTR(ret, p)     do{if((ret))(ret)->ptr = (p);}while(0)

TS_CPP_END

#endif  // TS_RUNTIME_H_
