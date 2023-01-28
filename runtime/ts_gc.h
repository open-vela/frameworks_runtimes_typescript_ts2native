#ifndef TS_GC_H_
#define TS_GC_H_

#include "ts_common.h"

TS_CPP_BEGIN

typedef struct _ts_object_t ts_object_t;

typedef struct _ts_gc_t ts_gc_t;
typedef struct _ts_gc_local_scope_t ts_gc_local_scope_t;
typedef struct _ts_gc_data_header_t ts_gc_data_header_t;
struct _ts_gc_weak_entry_t;
typedef struct _ts_gc_weak_entry_t*   ts_gc_weak_ptr_t;
typedef struct _ts_gc_strong_entry_t* ts_gc_strong_ptr_t;


typedef enum _ts_gc_level_t {
  ts_gc_level_minimal,
  ts_gc_level_middle,
  ts_gc_level_all,
} ts_gc_level_t;

struct _ts_gc_local_scope_t {
  ts_gc_local_scope_t* prev;
  ts_object_t* objects[0];  // the list of local objects
};

struct _ts_gc_data_header_t {
  uint32_t gc_data;
  uint32_t ref_count;
};

// make the local_scope

TS_CPP_END

#endif  // TS_GC_H_
