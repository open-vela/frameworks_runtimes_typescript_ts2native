#ifndef TS_COMMON_H_
#define TS_COMMON_H_

#ifdef __cplusplus
#define TS_CPP_BEGIN extern "C" {
#define TS_CPP_END   }

#define TS_EXTERN extern "C"

#else
#define TS_CPP_BEGIN
#define TS_CPP_END
#define TS_EXTERN extern
#endif

#define TS_OFFSET(T, p, offset) ((T*)((uint8_t*)(p) + (offset)))

#define TS_EXPORT

////////// configs
#ifndef TS_STR_FORMAT_SIZE
#define TS_STR_FORMAT_SIZE  4096
#endif

////////////////
#ifdef TS_NO_STD_LIBC
#include <stdint.h>
#include <stddef.h>
static size_t strlen(const char* s) {
  if (s == NULL) return 0;
  size_t n = 0;
  while(s[n]) ++n;
  return n;
}

#endif

#endif  // TS_COMMON_H_
