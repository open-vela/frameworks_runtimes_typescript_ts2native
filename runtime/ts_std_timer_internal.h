#ifndef TS_STD_TIMEOUT_INTERNAL_H_
#define TS_STD_TIMEOUT_INTERNAL_H_

#include "ts_common.h"
#include "ts_runtime.h"

TS_CPP_BEGIN

ts_vtable_t* ts_get_std_timer_vtable();

void ts_init_std_timer_backend(ts_runtime_t* rt);

TS_CPP_END

#endif
