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

////////// configs
#ifndef TS_STR_FORMAT_SIZE
#define TS_STR_FORMAT_SIZE  4096
#endif

#endif  // TS_COMMON_H_
