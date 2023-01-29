#ifndef TS_LNAG_H_
#define TS_LNAG_H_

#include <stdarg.h>
#include <string.h>
#include <alloca.h>

#include "ts_common.h"
#include "ts_runtime.h"

TS_CPP_BEGIN

typedef struct _ts_primitive_object_t ts_primitive_object_t;
typedef struct _ts_string_t ts_string_t;
typedef struct _ts_array_t  ts_array_t;


#define TS_PRIMITIVE_DEFINES(V) \
  V(int32, int32_t)             \
  V(uint32, uint32_t)           \
  V(int64, int64_t)             \
  V(uint64, uint64_t)           \
  V(boolean, ts_boolean_t)      \
  V(float, float)               \
  V(double, double)


#define TS_PRIMITIVE_OBJECT_DEF(Type, Type_t) \
  typedef struct _ts_##Type##_object_t { \
    ts_object_t base; \
    Type_t value; \
  } ts_##Type##_object_t;

TS_PRIMITIVE_DEFINES(TS_PRIMITIVE_OBJECT_DEF)

#undef TS_PRIMITIVE_OBJECT_DEF

typedef struct _ts_string_t {
  ts_object_t base;
  uint32_t is_utf16:1;
  uint32_t is_const:1;
  uint32_t length:30;
  uint8_t* buffer;
} ts_string_t;

typedef enum _ts_lang_classes_t {
  lang_class_int32,
  lang_class_uint32,
  lang_class_int64,
  lang_class_uint64,
  lang_class_boolean,
  lang_class_float,
  lang_class_double,
  lang_class_string,
  lang_class_bigint,
  lang_class_array,
  lang_class_map,
  lang_class_set,

  lang_class_max
} ts_lang_classes_t;


static inline ts_object_t* ts_new_string(ts_runtime_t* rt, const char* str, ts_boolean_t is_const) {
  TS_DEF_ARGUMENTS(2);
  TS_SET_INT_ARG(is_const);
  TS_SET_STR_ARG(str);

  return ts_new_object(rt,
	&(rt->std_module->classes[lang_class_string]), TS_ARGUMENTS);
}

static inline ts_object_t* ts_new_string_format(ts_runtime_t* rt, const char* format, ...) {
  char buffer[TS_STR_FORMAT_SIZE];
  va_list vargs;
  va_start(vargs, format);
  vsnprintf(buffer, sizeof(buffer), format, vargs); 
  va_end(vargs);
  return ts_new_string(rt, buffer, ts_false);
}

static inline int ts_string_length(ts_object_t* self) {
  return self ? ((ts_string_t*)self)->length : 0; 
}

static inline const char* ts_string_get_utf8(ts_object_t* self) {
  return self && ((ts_string_t*)self)->is_utf16 == 0 ?
	 (const char*)(((ts_string_t*)self)->buffer) : NULL;
}

static inline int ts_object_get_lang_class_index(ts_object_t* self) {
  if (!self) return -1;

  ts_runtime_t* rt = ts_runtime_from_object(self);
  if (rt->std_module == ts_module_from_object(self)) {
    ts_vtable_env_t* vt_start = &rt->std_module->classes[0];
    ts_vtable_env_t* vt_end   = &rt->std_module->classes[lang_class_max];
    if (self->vtable_env >= vt_start && self->vtable_env < vt_end)
      return self->vtable_env - vt_start;
  }
  return -1;
}

////////////////////////////////////////////////
// define the stack object
#define TS_PRIMITIVE_OBJECT_INIT_FUNC(Type, Type_t) \
static inline ts_object_t* ts_##Type##_object_init(ts_runtime_t* rt, ts_object_t* obj, Type_t init_value) { \
  obj->vtable_env = &(rt)->std_module->classes[lang_class_##Type]; \
  ts_##Type##_object_t* _primitive = (ts_##Type##_object_t*)(obj); \
  _primitive->value = init_value; \
  return obj; \
} \
static inline ts_object_t* ts_##Type##_object_new(ts_runtime_t* rt, Type_t init_value) { \
  TS_DEF_ARGUMENTS(1); \
  *((Type_t*)(&TS_GET_ARG(TS_ARGUMENTS, 0))) = init_value; \
  return ts_new_object(rt, &rt->std_module->classes[lang_class_##Type], TS_ARGUMENTS); \
}

TS_PRIMITIVE_DEFINES(TS_PRIMITIVE_OBJECT_INIT_FUNC)

#define TS_PRIMITIVE_OBJECT_STACK_INIT(rt, Type, init_value) \
  ts_##Type##_object_init(rt, (ts_object_t*)alloca(sizeof(ts_##Type##_object_t)), init_value)

#define TS_INT32_NEW_STACK(rt, init_value) \
	TS_PRIMITIVE_OBJECT_STACK_INIT(rt, int32, init_value)

#define TS_UINT32_NEW_STACK(rt, init_value) \
	TS_PRIMITIVE_OBJECT_STACK_INIT(rt, uint32, init_value)

#define TS_INT64_NEW_STACK(rt, init_value) \
	TS_PRIMITIVE_OBJECT_STACK_INIT(rt, int64, init_value)

#define TS_UINT64_NEW_STACK(rt, init_value) \
	TS_PRIMITIVE_OBJECT_STACK_INIT(rt, uint64, init_value)

#define TS_BOOLEAN_NEW_STACK(rt, init_value) \
	TS_PRIMITIVE_OBJECT_STACK_INIT(rt, boolean, init_value)

#define TS_FLOAT_NEW_STACK(rt, init_value) \
	TS_PRIMITIVE_OBJECT_STACK_INIT(rt, float, init_value)

#define TS_DOUBLE_NEW_STACK(rt, init_value) \
	TS_PRIMITIVE_OBJECT_STACK_INIT(rt, double, init_value)

static inline ts_object_t* ts_string_init(ts_runtime_t* rt, ts_object_t* obj, const char* init_value) {
  obj->vtable_env = &(rt->std_module->classes[lang_class_string]);
  ts_string_t* str = (ts_string_t*)obj;
  str->is_utf16 = 0;
  str->is_const = 1;
  if (init_value) {
    str->length = strlen(init_value);
    str->buffer = (uint8_t*)(init_value);
  } else {
    str->length = 0;
    str->buffer = NULL;
  }
  return obj;
}

static inline ts_object_t* ts_string_dup(ts_object_t* obj) {
  if (!obj) return NULL;
  ts_debug_check(ts_object_get_lang_class_index(obj) == lang_class_string,
		"object %p(%s) is not string", obj, OBJECT_VTABLE(obj)->object_name);

  ts_string_t* str = (ts_string_t*)obj;
  return ts_new_string(ts_runtime_from_object(obj), (const char*)str->buffer, str->is_const);
}

#define TS_STRING_NEW_STACK(rt, c_str) \
  ts_string_init(rt, (ts_object_t*)(alloca(sizeof(ts_string_t))), c_str)


////////////////////////////////////////////////////////////
// function utils
static inline ts_object_t* _ts_function_to_string(ts_object_t* self) {
  return ts_new_string_format(ts_runtime_from_object(self),
		  "TS Function %s (%p)", OBJECT_VTABLE(self)->object_name, self);
}

#define TS_FUNCTION_CLOSURE_VTABLE_DEF(name, func_impl, closure_data_size) \
  TS_VTABLE_DEF(_##name##_vt, 1) = { \
    TS_VTABLE_BASE( \
	sizeof(ts_function_t) + (closure_data_size), \
        #name, \
	0, \
	1, \
	NULL, \
	NULL, \
        _ts_function_to_string, \
	NULL), \
   { \
      {.method = (ts_call_t)(func_impl)} \
   } \
  }

#define TS_FUNCTION_VTABLE_DEF(name, func_impl) \
    TS_FUNCTION_CLOSURE_VTABLE_DEF(name, func_impl, 0)

#define TS_NEW_CLOSURE_FUNC_BEGIN(varname, m, index) \
    varname = ts_new_object((m)->runtime, &((m)->classes[index]), NULL); do { \
      uint8_t* __func_closure_data__ptr__ = TS_OFFSET(uint8_t, (varname), sizeof(ts_function_t));
	

#define TS_ADD_FUNC_CLOSURE_DATA(type, value) \
      *((type*)(__func_closure_data__ptr__)) = (value); \
      __func_closure_data__ptr__ += sizeof(type);

#define TS_NEW_CLOSURE_FUNC_END }while(0);

#define TS_FUNC_CLOSURE_DATA(type, func, offset) \
  TS_OFFSET(type, func, sizeof(ts_function_t) + (offset))

TS_CPP_END

#endif  // TS_LNAG_H_
