#ifndef TS_DEBUG_H_
#define TS_DEBUG_H_

#include <assert.h>
#include <stdio.h>
#include "ts_common.h"

TS_CPP_BEGIN

#ifndef NODEBUG
#define ts_debug_check(express, message, ...) do { \
  int __ret = (express); \
  if (!__ret) fprintf(stderr, message "\n", ##__VA_ARGS__); \
  assert(__ret); \
} while(0)

#define ts_debug_log(format, ...) fprintf(stderr, format, #__VA_ARGS__)
#else
#define ts_debug_check
#define ts_debug_log
#endif

TS_CPP_END

#endif // TS_DEBUG_H_
