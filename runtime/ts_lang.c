
#include <stdlib.h>
#include <string.h>

#include "ts_lang.h"

#define TS_PRIMITIVE_CTR_DEF(name) \
static int _##name##_constructor(ts_object_t* self, ts_argument_t args, ts_return_t ret) { \
  if (args != NULL) { \
    ts_##name##_object_t* obj = (ts_##name##_object_t*)self; \
    obj->value = *((typeof(obj->value)*)(&args[0]));  \
  } \
  return 0; \
}

#define TS_PRIMITIVE_TO_STR_DEF(name) \
static ts_object_t* _##name##_to_string(ts_object_t* self) { \
  /* TODO */ \
  return NULL; \
}

#define TS_PRIMITVE_VTABLE_NAME(name)  _##name##_vt
#define TS_PRIMITVE_VTABLE_DEF(name) \
  TS_PRIMITIVE_CTR_DEF(name) \
  TS_PRIMITIVE_TO_STR_DEF(name) \
  TS_VTABLE_DEF(TS_PRIMITVE_VTABLE_NAME(name), 0) = { \
    TS_BASE_VTABLE_BASE(                  \
      sizeof(ts_##name##_object_t),  \
      #name,                         \
      ts_object_##name,              \
      0, /* interface count*/        \
      0, /* member count*/           \
      _##name##_constructor,         \
      /*_primitive_destroy*/NULL,    \
      _##name##_to_string,           \
      NULL /* visitory */            \
   ) }

TS_PRIMITVE_VTABLE_DEF(int32);
TS_PRIMITVE_VTABLE_DEF(uint32);
TS_PRIMITVE_VTABLE_DEF(boolean);
TS_PRIMITVE_VTABLE_DEF(float);
TS_PRIMITVE_VTABLE_DEF(double);
TS_PRIMITVE_VTABLE_DEF(int64);
TS_PRIMITVE_VTABLE_DEF(uint64);

////////////////////////////////////////////////
// string
static int _string_constructor(ts_object_t* self, ts_argument_t args, ts_return_t ret) {
  ts_string_t* str = (ts_string_t*)self;
  str->is_utf16 = 0; // TODO support utf16
  str->length = 0;
  str->buffer = NULL;

  if (args) {
    str->is_const = (TS_ARG_INT(args, 0) != 0);
    if (TS_ARG_STR(args, 1)) {
      if (str->is_const)
        str->buffer = (uint8_t*)TS_ARG_STR(args, 1);
      else
        str->buffer = (uint8_t*)strdup(TS_ARG_STR(args, 1));
      str->length = strlen((char*)(str->buffer));
    }
  }
  return 0;
}

static void _string_destroy(ts_object_t* self) {
  ts_string_t* str = (ts_string_t*)self;
  if (str->is_const == 0 && str->buffer) {
    free(str->buffer);
  }
}

static ts_object_t* _string_to_string(ts_object_t* self) {
  ts_string_t* str = (ts_string_t*)self;
  return (ts_object_t*)ts_new_string_format(
	   ts_runtime_from_object(self), "[string](%s %s \"%s\")",
	      str->is_utf16 ? "utf16": "utf8",
	      str->is_const ? "const": "dynamic",
	      str->buffer ? (const char*)(str->buffer) : "");
}

static TS_VTABLE_DEF(_string_vt, 0/*member count*/) = {
  TS_BASE_VTABLE_BASE(
    sizeof(ts_string_t),
    "string",
    ts_object_string,
    0,
    0,
    _string_constructor,
    _string_destroy,
    _string_to_string,
    NULL // visitor
  ),
};

//////////////////////////////////////////////
// array

////////////////////////////////////////////
// map

///////////////////////////////////////////
// set


//////////////////////////////////////////
static ts_vtable_t* _ts_lang_vtables[] = {
  &TS_PRIMITVE_VTABLE_NAME(int32).base,
  &TS_PRIMITVE_VTABLE_NAME(uint32).base,
  &TS_PRIMITVE_VTABLE_NAME(int64).base,
  &TS_PRIMITVE_VTABLE_NAME(uint64).base,
  &TS_PRIMITVE_VTABLE_NAME(boolean).base,
  &TS_PRIMITVE_VTABLE_NAME(float).base,
  &TS_PRIMITVE_VTABLE_NAME(double).base,
  &_string_vt.base,
  NULL, // lang_class_bigint
  NULL, // lang_class_aray
  NULL, // lang_class_map
  NULL, // lang_class_set
};

ts_vtable_t* ts_get_lang_vtable(ts_lang_classes_t class_index) {
  if (class_index >= lang_class_max) {
    return NULL;
  }
  return _ts_lang_vtables[class_index];
}
