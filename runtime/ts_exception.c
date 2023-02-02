#include <stdlib.h>
#include <alloca.h>

#include "ts_std.h"
#include "ts_lang.h"

#include "ts_exception.h"

typedef struct _ts_exception_error_t {
  ts_object_t base;
  const char* name;
  char* message;
  const char* filename;
  ts_object_t* cause;
  int lineNo;
  int colNo;
} ts_exception_error_t;

static ts_exception_error_t* ts_to_exception_error(ts_object_t* obj) {
  return (ts_exception_error_t*)(obj);
}

static int _exception_error_constructor(ts_object_t* self, ts_argument_t args, ts_return_t ret) {
  ts_exception_error_t* thiz = ts_to_exception_error(self);

  thiz->name = "TS Error";
  thiz->message = TS_ARG_STR(args, 0) ? strdup(TS_ARG_STR(args, 0)) : NULL;
  thiz->cause = TS_ARG_OBJECT(args, 1);
  thiz->filename = TS_ARG_STR(args, 2);
  thiz->lineNo = TS_ARG_INT(args, 3);
  thiz->colNo = TS_ARG_INT(args, 4);

  return 0;
}

static void _exception_error_destroy(ts_object_t* self) {
  ts_exception_error_t* thiz = ts_to_exception_error(self);
  if (thiz->message)
    free(thiz->message);

  ts_object_release(thiz->cause);
}

static void _exception_error_gc_visitor(ts_object_t* self, ts_object_visitor_t visit, void* user_data) {
  ts_exception_error_t* thiz = ts_to_exception_error(self);
  if (thiz->cause)
    visit(thiz->cause, user_data);
}

static ts_object_t*  _exception_error_to_string(ts_object_t* self) {
  char szbuf[TS_STR_FORMAT_SIZE];
  ts_exception_error_t* thiz = ts_to_exception_error(self);

  return ts_new_string_format(ts_runtime_from_object(self),   
	"[%s] message:[%s] cause:[%p], filename:\"%s\":%d-%d",
          thiz->name, thiz->message ? thiz->message : "Unknown Error",
          thiz->cause, thiz->filename, thiz->lineNo, thiz->colNo, ts_false);
}

static TS_VTABLE_DEF(_exception_error_vt, 0) = {
  TS_VTABLE_BASE(
    sizeof(ts_exception_error_t),
    "exception_error",
    0, // interface count,
    0, // member count
    _exception_error_constructor,
    _exception_error_destroy,
    _exception_error_to_string,
    _exception_error_gc_visitor)
};

void ts_init_exception_error_classes(ts_module_t* m) {
  ts_init_vtable_env(&m->classes[lang_class_max + ts_std_exception_error_index], &_exception_error_vt.base, m, NULL);
}
