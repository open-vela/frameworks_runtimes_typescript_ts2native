#ifndef TS_GC_INTERNAL_H_
#define TS_GC_INTERNAL_H_

#include <stdint.h>

#include "ts_common.h"
#include "ts_gc.h"

TS_CPP_BEGIN

typedef struct _ts_gc_cluster_t ts_gc_cluster_t;
typedef struct _ts_gc_cluster_entry_t ts_gc_cluster_entry_t;
typedef struct _ts_gc_slot_t    ts_gc_slot_t;

typedef struct _ts_gc_free_slot_t ts_gc_free_slot_t;
typedef struct _ts_gc_used_slot_t ts_gc_used_slot_t;

typedef struct _ts_gc_data_t ts_gc_data_t;

typedef struct _ts_gc_weak_entry_t   ts_gc_weak_entry_t;
typedef struct _ts_gc_weak_cluster_t ts_gc_weak_cluster_t;

typedef struct _ts_gc_large_table_t  ts_gc_large_table_t;
typedef struct _ts_gc_large_entry_t  ts_gc_large_entry_t;

typedef struct _ts_gc_strong_entry_t ts_gc_strong_entry_t;
typedef struct _ts_gc_strong_table_t ts_gc_strong_table_t;

struct _ts_gc_free_slot_t {
  uint32_t next_offset;
  uint32_t free_count;
};

struct _ts_gc_data_t {
  uint32_t prev_offset: 14;
  uint32_t next_offset: 14;
  uint32_t marked: 1;
  uint32_t dirty: 1; // playload changed;
  uint32_t has_weak: 1;
};

struct _ts_gc_used_slot_t {
  union {
    ts_gc_data_t gc_data;
    uint32_t     gc_slot;
  };
  uint32_t     ref_count;
};

typedef union _ts_gc_slot_header_t {
  ts_gc_used_slot_t used;
  ts_gc_free_slot_t free;
} ts_gc_slot_header_t;

struct _ts_gc_slot_t {
  ts_gc_slot_header_t header;
  uint32_t payload[1]; // has  bytes at last of all slot
};

struct _ts_gc_weak_entry_t {
  ts_gc_weak_entry_t* next; // hash next
  uintptr_t reference;
  uint32_t  weak_ref_count;
};

struct _ts_gc_weak_cluster_t {
  uint32_t hash_count:16;
  uint32_t free_count:16;

  ts_gc_weak_entry_t* entries[0];
};

struct _ts_gc_strong_entry_t {
  union {
    void* reference;
    ts_gc_strong_entry_t* next_free;
  };
};

struct _ts_gc_strong_table_t {
  ts_gc_strong_entry_t* entries;
  ts_gc_strong_table_t* next;
  uint32_t entry_count:16;
  uint32_t free_count:16;
};

struct _ts_gc_cluster_t {
  uint32_t cluster_size;
  uint32_t slot_size: 16;  // slot_size by byte
  uint32_t slot_count: 16;
  uint32_t data_count: 16;  // data count by slot
  uint32_t free_count: 16;  // free count by slot
  void* buffer;
  ts_gc_free_slot_t* free_header;
  ts_gc_used_slot_t* used_header;
  ts_gc_cluster_t *next;
};

struct _ts_gc_cluster_entry_t {
  uint32_t cluster_count:16;
  uint32_t slot_size: 16;
  uint32_t cluster_index:16;
  uint32_t slot_count: 16;
  ts_gc_cluster_t* header;
};

struct _ts_gc_large_entry_t {
  ts_gc_large_entry_t*  next;
  ts_gc_slot_t slot;
};

struct _ts_gc_t {
  uint32_t  min_slot_size:16;
  uint32_t  max_slot_size:16;
  uint32_t  cluster_count:16;
  uint32_t  large_table_size:16;
  uint32_t  weak_table_size:16;
  uint32_t  strong_table_size:16;
  ts_gc_cluster_entry_t* clusters;
  ts_gc_weak_cluster_t** weak_table;
  ts_gc_large_entry_t** large_table;

  // references
  ts_gc_strong_table_t** strong_table;
  ts_gc_local_scope_t*   local_scope;
};


///////////////////////////////////////////////////
// create gc
typedef struct _ts_gc_configure_t {
  uint32_t min_slot_size;
  uint32_t max_slot_size;
  uint32_t cluster_count;
  uint32_t def_slot_count;
  uint32_t large_table_size;
  uint32_t weak_table_size;
  uint32_t slot_size_count;
  uint32_t strong_table_size;
  uint32_t *slot_sizes;
} ts_gc_configure_t;

ts_gc_t * ts_gc_create(const ts_gc_configure_t* config);
void ts_gc_destroy(ts_gc_t* gc);

void* ts_gc_alloc(ts_gc_t* gc, size_t size);
void ts_gc_free(ts_gc_t* gc, void* ptr);

void ts_gc_collect_garbage(ts_gc_t* gc, ts_gc_level_t level);

// reference
void* ts_gc_add_ref(ts_gc_t* gc, void* ptr);
void  ts_gc_release(ts_gc_t* gc, void* ptr);
ts_gc_weak_ptr_t ts_gc_make_weak(ts_gc_t* gc, void* ptr);
void* ts_gc_weak_get_ptr(ts_gc_t* gc, ts_gc_weak_ptr_t weak_ptr);
ts_object_t* ts_gc_from_weak(ts_gc_t* gc, ts_gc_weak_ptr_t weak_ptr);
void  ts_gc_weak_free(ts_gc_t* gc, ts_gc_weak_ptr_t weak_ptr);
void  ts_gc_weak_clear(ts_gc_t* gc, void* ptr);

void ts_gc_push_local_scope(ts_gc_t* gc, ts_gc_local_scope_t* scope);
void ts_gc_pop_local_scope(ts_gc_t* gc, ts_gc_local_scope_t* scope);

TS_CPP_END

#endif  // TS_GC_INTERNAL_H_
