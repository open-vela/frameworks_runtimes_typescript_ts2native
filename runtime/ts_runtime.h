#ifndef TS_RUNTIME_H_
#define TS_RUNTIME_H_

#include <stdint.h> 
#include <alloca.h>

#include "ts_common.h"
#include "ts_debug.h"
#include "ts_gc.h"

TS_CPP_BEGIN

typedef int ts_boolean_t;
#define ts_true  1
#define ts_false 0

typedef struct _ts_runtime_t  ts_runtime_t;
typedef struct _ts_object_t   ts_object_t;
typedef struct _ts_module_t   ts_module_t;
typedef struct _ts_function_t ts_function_t;
typedef struct _ts_vtable_t   ts_vtable_t;
typedef struct _ts_vtable_env_t   ts_vtable_env_t;
typedef struct _ts_interface_entry_t ts_interface_entry_t;
typedef struct _ts_interface_t ts_interface_t;

typedef union _ts_value_t {
  int32_t  ival;
  int64_t  lval;
  float    fval;
  double   dval;
  ts_object_t* object;
  char*    str;
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
  uint32_t object_offset:16;
  uint32_t member_offset:16;
};

struct _ts_interface_t {
  ts_interface_entry_t* interface_entry;
};

struct _ts_vtable_t {
  ts_interface_entry_t class_interface;
  const char* object_name;
  ts_vtable_t* super;
  uint32_t object_size:24;
  uint32_t interfaces_count:8;
  uint32_t member_count;
  ts_call_t constructor;
  ts_finialize_t destroy;
  ts_to_string_t to_string;
  ts_gc_visit_t  gc_visit;
};

#define TS_VTABLE_DEF(name, N) struct { \
  ts_vtable_t base; \
  ts_member_t members[N]; \
} name

#define TS_VTABLE_THIS_INTERFACE_ENTRY {0, sizeof(ts_vtable_t)}
#define TS_VTABLE_BASE(size, name, intf_count, mem_count, ctr, dstry, to_str, visitor) \
{                                 \
  TS_VTABLE_THIS_INTERFACE_ENTRY, \
  name,                           \
  NULL,                           \
  size,                           \
  intf_count,                     \
  mem_count,                      \
  ctr,                            \
  dstry,                          \
  to_str,                         \
  visitor                         \
}

struct _ts_vtable_env_t {
  ts_interface_entry_t class_interface; // make ts_vtabel_env_t as a interface
  ts_vtable_t* vtable;
  ts_vtable_env_t* super;
  ts_module_t* env;
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
  ts_runtime_t *runtime;
  ts_module_t** imports;
  ts_value_t*  values;
  ts_function_t** functions;
  ts_vtable_env_t*  classes;
  ts_vtable_env_t   _self_env; // save this env
};

#define TS_MODULE_SIZE(imports, values, functions, classes) \
  (sizeof(ts_module_t) + \
   sizeof(ts_module_t*)*(imports) + \
   sizeof(ts_value_t)*(values) + \
   sizeof(ts_function_t)*(functions) + \
   sizeof(ts_vtable_env_t)*(classes))

typedef enum _ts_module_method_index_t {
  ts_module_initialize_index = ts_method_last,
} ts_module_method_index_t;


///////////////////////////////////
// ts_function
struct _ts_function_t {
  ts_object_t base;
};

typedef enum _ts_function_method_index_t {
  ts_function_call_index = ts_method_last,
} ts_function_method_index_t;


//////////////////////////////
// ts_runtime
struct _ts_runtime_t {
  ts_gc_t *gc;
  // new / delete object
  ts_object_t* (* new_object)(ts_gc_t*, ts_vtable_env_t*, ts_argument_t);
  void (* delete_object)(ts_gc_t*, ts_object_t*);

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

  ts_module_t* std_module; // the std_module;
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
  return obj && obj->vtable_env->vtable->to_string ?
	obj->vtable_env->vtable->to_string(obj) : NULL;
}

static inline void ts_init_vtable_env(ts_vtable_env_t* vt_env, ts_vtable_t* vt, ts_module_t* own_module, ts_vtable_env_t* super) {
  vt_env->class_interface.object_offset = 0;
  vt_env->class_interface.member_offset = sizeof(ts_vtable_t);
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
    if (-- header->ref_count) {
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
		uint32_t classes) {
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

  m->imports = TS_OFFSET(ts_module_t*, m, sizeof(ts_module_t));
  m->values =  TS_OFFSET(ts_value_t, m->imports, sizeof(ts_module_t*) * imports);
  m->functions = TS_OFFSET(ts_function_t*, m->values, sizeof(ts_value_t) * values);
  m->classes = TS_OFFSET(ts_vtable_env_t, m->functions, sizeof(ts_function_t*) * functions);

  if (imports == 0)
    m->imports = NULL;
  if (values == 0)
    m->values = NULL;

  if (functions == 0)
    m->functions = NULL;

  if (classes == 0)
    m->classes = NULL;

  return m;
}

static inline ts_member_t ts_vtable_member(ts_vtable_t* vtable, uint32_t member_index) {
  ts_debug_check(vtable != NULL, "vtable is NULL");
  ts_debug_check(vtable->member_count < member_index,
	 "member index(%d) out of the vtable(member count: %d) in \"%s\"", \
	 member_index, vtable->member_count, vtable->object_name);
  return *TS_OFFSET(ts_member_t, &vtable->constructor, sizeof(ts_member_t)*member_index);
}

static inline void* ts_field_of(ts_object_t* obj, uint32_t index) {
  ts_debug_check(obj != NULL, "object is NULL");
  ts_member_t member = ts_vtable_member(obj->vtable_env->vtable, index);
  return TS_OFFSET(void, obj, member.field);
}

static inline int ts_method_call(ts_object_t* obj, uint32_t index, ts_argument_t args, ts_return_t ret) {
  ts_debug_check(obj != NULL, "object is NULL");
  ts_member_t member = ts_vtable_member(obj->vtable_env->vtable, index);
  ts_debug_check(member.method != NULL, \
		 "method %d of \"%s\" is NULL", index, obj->vtable_env->vtable->object_name);
  return (member.method)(obj, args, ret);
}


static inline ts_object_t* ts_cast_interface_object(ts_interface_t* self) {
  return TS_OFFSET(ts_object_t, self, self->interface_entry->object_offset);
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

#define TS_OBJECT_MEMBER_OF(Type, obj, offset) \
  TS_OFFSET(Type, obj, sizeof(ts_object_t) + (offset))

///////////////////////////////////////////////
// module method
inline static ts_value_t ts_module_value_of(ts_module_t* module, int index) {
  return module->values[index]; 
}
inline static ts_object_t* ts_module_object_of(ts_module_t* module, int index) {
  return ts_module_value_of(module, index).object;
}

inline static void ts_module_initialize(ts_module_t* module) {
  ts_method_call(&module->base, ts_module_initialize_index, NULL, NULL);
}

/////////////////////////////////////////////////
// function method
inline static int ts_function_call(ts_function_t* self, ts_argument_t args, ts_return_t ret) {
  return ts_method_call(&self->base, ts_function_call_index, args, ret);
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
#define TS_DEF_ARGUMENTS(N)  \
  ts_value_t __arguments[N+1]; \
  __arguments[0].ival = N; \
  ts_value_t* __cur_arg = &__arguments[1]

#define TS_ARGUMENTS  __arguments

#define TS_SET_INT_ARG(arg) \
  (__cur_arg ++)->ival = arg

#define TS_SET_LONG_ARG(arg) \
  (__cur_arg ++)->lval = arg

#define TS_SET_FLOAT_ARG(arg) \
  (__cur_arg ++)->fval = arg

#define TS_SET_DOUBLE_ARG(arg) \
  (__cur_arg ++)->dval = arg

#define TS_SET_OBJECT_ARG(arg) \
  (__cur_arg ++)->object = (ts_object_t*)(arg)

#define TS_SET_STR_ARG(c_str) \
  (__cur_arg ++)->str = (char*)(c_str)

#define TS_ARG_COUNT(args)      (args)[0].ival
#define TS_GET_ARG(args, i)     (args)[(i)+1]
#define TS_ARG_INT(args, i)     (args)[(i)+1].ival
#define TS_ARG_INT64(args, i)   (args)[(i)+1].lval
#define TS_ARG_FLOAT(args, i)   (args)[(i)+1].fval
#define TS_ARG_DOUBLE(args, i)  (args)[(i)+1].dval
#define TS_ARG_OBJECT(args, i)  (args)[(i)+1].object
#define TS_ARG_STR(args, i)     (args)[(i)+1].str

TS_CPP_END

#endif  // TS_RUNTIME_H_
