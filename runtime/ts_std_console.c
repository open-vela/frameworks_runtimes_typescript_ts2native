
#include "ts_std.h"
#include "ts_lang.h"
#include "ts_std_console_internal.h"

typedef struct _ts_std_console_t {
  ts_object_t base;
} ts_std_console_t;

typedef enum _ts_std_console_level_t {
  std_console_level_info,
  std_console_level_log,
  std_console_level_debug,
  std_console_level_warn,
  std_console_level_error,
} ts_std_console_level_t;

static const char* _std_console_level_str[] = {
  "INFO",
  "LOG",
  "DEBUG",
  "WARN",
  "ERROR"
};

static int _ts_console_output(ts_object_t* self, ts_std_console_level_t level, ts_argument_t args, ts_return_t ret) {
  char buffer[TS_STR_FORMAT_SIZE];
  int len = snprintf(buffer, sizeof(buffer), "[TS %s]",
		  _std_console_level_str[level]);

  if (args == NULL)
    return 0;

  int argc = TS_ARG_COUNT(args);

  for (int i = 0; i < argc && len < sizeof(buffer); i ++) {
    ts_object_t* obj = TS_ARG_OBJECT(args, i); 
    switch(ts_object_get_lang_class_index(obj)) {
      case lang_class_int32:
        len += snprintf(buffer + len, sizeof(buffer) - len, "%d",
	           ((ts_int32_object_t*)(obj))->value);
	break;
      case lang_class_uint32:
        len += snprintf(buffer + len, sizeof(buffer) - len, "%u",
	           ((ts_uint32_object_t*)(obj))->value);
	break;
      case lang_class_int64:
        len += snprintf(buffer + len, sizeof(buffer) - len, "%ld",
	           ((ts_int64_object_t*)(obj))->value);
	break;
      case lang_class_uint64:
        len += snprintf(buffer + len, sizeof(buffer) - len, "%lu",
	           ((ts_uint64_object_t*)(obj))->value);
	break;
      case lang_class_boolean:
        len += snprintf(buffer + len, sizeof(buffer) - len, "%s",
	           ((ts_boolean_object_t*)(obj))->value ? "true" : "false");
	break;
      case lang_class_float:
        len += snprintf(buffer + len, sizeof(buffer) - len, "%f",
	           ((ts_float_object_t*)(obj))->value);
	break;
      case lang_class_double:
        len += snprintf(buffer + len, sizeof(buffer) - len, "%f",
	           ((ts_double_object_t*)(obj))->value);
	break;
      case lang_class_string:
        len += snprintf(buffer + len, sizeof(buffer) - len, "%s",
	           ts_string_get_utf8(obj));
	break;
      case lang_class_bigint:
      case lang_class_array:
      case lang_class_map:
      case lang_class_set:
      default: {
        ts_object_t* str = ts_object_to_string(obj);
	len += snprintf(buffer + len, sizeof(buffer) - len, "%s", ts_string_get_utf8(str));
	ts_object_release(str);
	break;
      }
    }
  }
  buffer[len] = '\0';
  printf("%s\n", buffer);
  return 0;
}

#define TS_CONSOLE_OUTPUT_DEF(level) \
static int _ts_console_##level(ts_object_t* self, ts_argument_t args, ts_return_t ret) { \
  return _ts_console_output(self, std_console_level_##level, args, ret); \
}

TS_CONSOLE_OUTPUT_DEF(info)
TS_CONSOLE_OUTPUT_DEF(log)
TS_CONSOLE_OUTPUT_DEF(debug)
TS_CONSOLE_OUTPUT_DEF(warn)
TS_CONSOLE_OUTPUT_DEF(error)

static TS_VTABLE_DEF(_console_vt, 5) = {
  TS_VTABLE_BASE(
    sizeof(ts_std_console_t),
    "console",
    0, // interface count
    4, // member count,
    NULL,  // consructor
    NULL,  // destroy
    NULL,  // to string
    NULL  // visitor
  ),
  {
    {.method = _ts_console_info},
    {.method = _ts_console_log},
    {.method = _ts_console_debug},
    {.method = _ts_console_warn},
    {.method = _ts_console_error},
  }
};

ts_vtable_t* ts_get_std_console_vtable() {
  return &_console_vt.base;
}
