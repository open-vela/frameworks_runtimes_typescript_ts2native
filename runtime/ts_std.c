
#include "ts_std.h"
#include "ts_lang.h"
#include "ts_lang_internal.h"
#include "ts_std_console_internal.h"

#define VALUES 1 // console

static ts_object_t* _module_to_string(ts_object_t* self) {
  // TODO
  return NULL;
}

static void _module_visit(ts_object_t* self, ts_object_visitor_t visitor, void* user_data) {
  ts_module_t* module = (ts_module_t*)self;

  if (module->imports) {
    // NO imports
  }
  if (module->values) {
    visitor(module->values[0].object, user_data);
  }

  // functions
  // NO functions

}

static int _std_module_init(ts_object_t* self, ts_argument_t args, ts_return_t ret) {
  return 0; // TODO init std module
}

TS_VTABLE_DEF(_std_module_vt, 1/*member count*/) = {
  TS_VTABLE_BASE(
	TS_MODULE_SIZE(0, VALUES, 0, lang_class_max + 1, 0), // console_class
	"std",
	0,
	1,
	NULL,
	NULL,
	_module_to_string,
	_module_visit
    ),
  {
    {.method = _std_module_init }
  }
};

ts_module_t* ts_create_std_module(ts_runtime_t* rt) {
  ts_module_t* m = ts_new_module(rt, &_std_module_vt.base,
		  0,   // imports
		  1,   // values,
		  0,   // functions,
		  lang_class_max, // classes
		  0); // interfaces

  // init classes
  for (int i = 0; i < lang_class_max; i++) {
    ts_init_vtable_env(&m->classes[i], ts_get_lang_vtable(i), m, NULL);
  }

  // init console class
  ts_init_vtable_env(&m->classes[lang_class_max + 0], ts_get_std_console_vtable(), m, NULL);

  // init values
  m->values[0].object = ts_new_object(rt, &m->classes[lang_class_max + 0], NULL);

  return m;
}
