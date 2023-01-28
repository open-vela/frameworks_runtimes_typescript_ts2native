#ifndef TS_LANG_INTERNAL_H_
#define TS_LANG_INTERNAL_H_

#include "ts_common.h"
#include "ts_runtime.h"

#include "ts_lang.h"

TS_CPP_BEGIN

ts_vtable_t* ts_get_lang_vtable(ts_lang_classes_t class_index);

TS_CPP_END

#endif
