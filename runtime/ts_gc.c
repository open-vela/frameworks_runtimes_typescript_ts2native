
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <memory.h>

#include "ts_runtime.h"
#include "ts_gc_internal.h"

#define CLUSTER_SIZE  (512 * 1024)

#define TS_OFFSET_BY_SLOT(p, q, slot_size)  \
	((((char*)(p)) - ((char*)(q)))/(slot_size))

#define TS_OFFSET_IN_CLUSTER(p, cluster) \
	TS_OFFSET_BY_SLOT(p, (cluster)->buffer, (cluster)->slot_size)

#define TS_POINTER_BY_SLOT(Type, start, offset, slot_size) \
	(Type*)(((char*)(start)) + ((offset) * (slot_size)))

#define TS_POINTER_IN_CLUSTER(Type, offset, cluster) \
	TS_POINTER_BY_SLOT(Type, (cluster)->buffer, offset, (cluster)->slot_size)

////////////////////////////////////////////


//////////////////////////////////////////////
#ifndef __LP64__
static uint32_t  _default_slot_sizes[] = {
  CLUSTER_SIZE / 32, // 2^5
  CLUSTER_SIZE / 64, // 2^6
  CLUSTER_SIZE / 128, // 2^7
  CLUSTER_SIZE / 256, // 2^8
  1024 * 2, // 2^9
  1024, // 2^10
};
#else
static uint32_t  _default_slot_sizes[] = {
  CLUSTER_SIZE * 2 / 64, // 2^6
  CLUSTER_SIZE * 4 / 128, // 2^7
  CLUSTER_SIZE * 2 / 256, // 2^8
  CLUSTER_SIZE * 2 / 512, // 2^9
  CLUSTER_SIZE * 4 / 1024, // 2^10,
  CLUSTER_SIZE * 4 / 1024, // 2^11,
  CLUSTER_SIZE * 2 / 1024, // 2^12
};
#endif

static ts_gc_configure_t _default_gc_configure = {
#ifndef __LP64__
    .min_slot_size = 32,
    .max_slot_size = 1024,
    .cluster_count = 5,
#else
    .min_slot_size = 64,
    .max_slot_size = 4096,
    .cluster_count = 6,
#endif
    .cluster_count = 256,
    .def_slot_count = CLUSTER_SIZE / 128,
    .large_table_size = 256,
    .weak_table_size = 256,
    .strong_table_size = 256,
    .slot_sizes = _default_slot_sizes
};

static ts_gc_cluster_entry_t* ts_gc_create_clusters(ts_gc_t* gc, uint32_t min_slot_size, const ts_gc_configure_t* config) {
  ts_gc_cluster_entry_t* entries =
	  (ts_gc_cluster_entry_t*)malloc(gc->cluster_count
			  * sizeof(ts_gc_cluster_entry_t));

  size_t slot_size = min_slot_size;
  uint32_t* config_slot_sizes = config->slot_sizes;
  
  for(size_t i = 0; i < gc->cluster_count; i ++) {
    entries[i].cluster_count = 0;
    entries[i].slot_size = (uint16_t)slot_size;
    entries[i].cluster_index = (uint16_t)i;
    entries[i].slot_count = (uint16_t)
	    (config_slot_sizes && config_slot_sizes[i] > 0 ?
	            config->def_slot_count : config_slot_sizes[i]);
    entries[i].header = NULL;
    slot_size <<= 1;
  }
  return entries;
}

ts_gc_t * ts_gc_create(const ts_gc_configure_t* config) {
  if (config == NULL) {
    config = &_default_gc_configure;
  }

  ts_gc_t* gc = (ts_gc_t*)malloc(sizeof(ts_gc_t));
  gc->min_slot_size = (uint16_t)config->min_slot_size;
  gc->max_slot_size = (uint16_t)config->max_slot_size;
  gc->cluster_count = (uint16_t)config->cluster_count;
  gc->large_table_size = (uint16_t)config->large_table_size;
  gc->weak_table_size = (uint16_t)config->weak_table_size;

  gc->clusters = ts_gc_create_clusters(gc, config->min_slot_size, config);
  gc->weak_table = NULL;
  gc->large_table = NULL;
  gc->strong_table = NULL;

  return gc;
}

void ts_gc_destroy(ts_gc_t* gc) {
  if (gc == NULL) {
    return ;
  }

  if (gc->clusters) {
    for (uint16_t i = 0; i < gc->cluster_count; i ++) {
      ts_gc_cluster_t* cluster = gc->clusters[i].header;
      while (cluster) {
        ts_gc_cluster_t* tmp = cluster;
	cluster = cluster->next;
	free(tmp);
      } 
    }
    free(gc->clusters);
  }

  if (gc->weak_table) {
    for (uint16_t i = 0; i < gc->weak_table_size; i ++) {
      ts_gc_weak_cluster_t* pweak_table = gc->weak_table[i];
      for (uint16_t j = 0; j < pweak_table->hash_count; j ++) {
        ts_gc_weak_entry_t* entry = pweak_table->entries[j];
        while(entry) {
          ts_gc_weak_entry_t* tmp = entry;
	  entry = entry->next;
	  free(tmp);
	}	
      }
    }
    free(gc->weak_table);
  }

  if (gc->large_table) {
    for (uint16_t i = 0; i < gc->large_table_size; i ++) {
      ts_gc_large_entry_t* pentry = gc->large_table[i];
      while (pentry) {
        ts_gc_large_entry_t* tmp = pentry;
	pentry = pentry->next;
	free(tmp);
      }
    }
    free(gc->large_table);
  }

  if (gc->strong_table) {
    // TODO
    free(gc->strong_table);
  }

  free(gc);
}

static ts_gc_cluster_entry_t* ts_gc_get_cluster_entry(ts_gc_t* gc, size_t size) {
  size += sizeof(ts_gc_slot_header_t);
  if (size <= gc->min_slot_size) {
    return &gc->clusters[0];
  }

  if (size > gc->max_slot_size) {
    return NULL;
  }

  size_t slot_size = (gc->min_slot_size) << 1;
  for (size_t i = 1; i < gc->cluster_count; i ++) {
    if (size <= slot_size) {
      return &gc->clusters[i];
    }
    slot_size <<= 1;
  }

  return NULL;
}

static void* ts_gc_alloc_cluster_slot(ts_gc_cluster_t* cluster, size_t size) {
  if (cluster->free_count == 0)
    return NULL;

  ts_gc_free_slot_t* slot = cluster->free_header;
  ts_gc_free_slot_t* next_slot;
  if (slot->free_count > 0) {
    next_slot = TS_OFFSET(ts_gc_free_slot_t, slot, cluster->slot_size);
    next_slot->free_count = slot->free_count - 1;
    next_slot->next_offset = slot->next_offset;
  } else if (slot->next_offset > 0) {
    next_slot = TS_OFFSET(ts_gc_free_slot_t, slot, slot->next_offset);
  } else {
    next_slot = NULL;
  }

  cluster->free_header = next_slot;
  cluster->free_count --;
  cluster->data_count ++; // the data used size

  ts_gc_used_slot_t* used_slot = (ts_gc_used_slot_t*)slot;
  used_slot->gc_slot = 0;
  used_slot->ref_count = 1;

  // insert to used_slot
  uint16_t offset = TS_OFFSET_IN_CLUSTER(used_slot, cluster);
  used_slot->gc_data.prev_offset = offset;
  used_slot->gc_data.next_offset = offset;

  if (cluster->used_header) {
    ts_gc_slot_t  *used_next_slot, *used_prev_slot;
    used_next_slot = TS_POINTER_IN_CLUSTER(ts_gc_slot_t, cluster->used_header->gc_data.next_offset, cluster);
    used_prev_slot = TS_POINTER_IN_CLUSTER(ts_gc_slot_t, cluster->used_header->gc_data.prev_offset, cluster);

    used_slot->gc_data.next_offset = TS_OFFSET_IN_CLUSTER(cluster->used_header, cluster);
    used_slot->gc_data.prev_offset = TS_OFFSET_IN_CLUSTER(used_prev_slot, cluster);
    used_prev_slot->header.used.gc_data.next_offset = offset;
    used_next_slot->header.used.gc_data.prev_offset = offset;
    cluster->used_header = used_slot;
  } else {
    cluster->used_header = used_slot;
  }

  return (void*)(((ts_gc_slot_t*)(slot))->payload);
}

static ts_gc_cluster_t* ts_gc_new_cluster(ts_gc_cluster_entry_t* entry) {
  ts_gc_cluster_t* cluster = (ts_gc_cluster_t*)malloc(sizeof(ts_gc_cluster_t));

  cluster->cluster_size = entry->slot_size * entry->slot_count;
  cluster->buffer = malloc(cluster->cluster_size);
  cluster->slot_size = entry->slot_size;
  cluster->slot_count = entry->slot_count;
  cluster->free_header = (ts_gc_free_slot_t*)(cluster->buffer);
  cluster->next = NULL;
  cluster->data_count = 0;
  cluster->free_count = cluster->slot_count;

  ts_gc_free_slot_t* free_slot = cluster->free_header;
  free_slot->next_offset = 0;
  free_slot->free_count = cluster->slot_count;

  return cluster;
}

static void* ts_gc_alloc_from_cluster(ts_gc_t* gc, ts_gc_cluster_entry_t* entry, size_t size) {
  if (entry->header == NULL) {
    entry->header = ts_gc_new_cluster(entry);
    entry->cluster_count = 1;
  }

  for (ts_gc_cluster_t* c = entry->header; c != NULL; c = c->next) {
    if (c->free_count > 0) {
      return ts_gc_alloc_cluster_slot(c, size);
    }
  }

  ts_gc_cluster_t* cluster = ts_gc_new_cluster(entry);
  cluster->next = entry->header;
  entry->header = cluster;
  entry->cluster_count ++;

  return ts_gc_alloc_cluster_slot(cluster, size);
}

static void ts_gc_init_large_table_if_need(ts_gc_t* gc) {
  if (gc->large_table == NULL)
    return;

  ts_gc_large_entry_t** table = (ts_gc_large_entry_t**)malloc(
		  sizeof(ts_gc_large_entry_t*) * gc->large_table_size);

  for (uint32_t i = 0; i < gc->large_table_size; i ++) {
    table[i] = NULL;
  }

  gc->large_table = table;
}

static size_t ts_gc_get_large_slot_index(ts_gc_t* gc, uintptr_t ptr) {
  return  (ptr >> 12) & (~(gc->large_table_size - 1));
}

static void* ts_gc_alloc_large(ts_gc_t* gc, size_t size) {
  ts_gc_init_large_table_if_need(gc);

  size_t entry_size = ((size + sizeof(ts_gc_large_entry_t)) + 7) & (~7); // 8 align
  ts_gc_large_entry_t* pentry = (ts_gc_large_entry_t*)malloc(entry_size);

  pentry->slot.header.used.gc_slot = 0;
  pentry->slot.header.used.ref_count = 1;

  size_t index = ts_gc_get_large_slot_index(gc, (uintptr_t)pentry);
  
  pentry->next = gc->large_table[index];
  gc->large_table[index] = pentry;

  return pentry->slot.payload;
}

void* ts_gc_alloc(ts_gc_t* gc, size_t size) {
  ts_gc_cluster_entry_t* entries = ts_gc_get_cluster_entry(gc, size);
  if (entries) {
    return ts_gc_alloc_from_cluster(gc, entries, size);
  }

  return ts_gc_alloc_large(gc, size);
}

static int ts_gc_free_from_cluster(ts_gc_t* gc, void* ptr) {
  ts_gc_cluster_entry_t* pentry = NULL;
  ts_gc_cluster_t*       pprev_cluster = NULL;
  ts_gc_cluster_t*       pcluster = NULL;

  for (uint16_t i = 0; i < gc->cluster_count; i ++) {
    pentry = &gc->clusters[i];
    pprev_cluster = NULL;
    for (pcluster = pentry->header; pcluster; pcluster = pcluster->next) {
      if (pcluster->buffer > ptr && pcluster->cluster_size > (ptr - pcluster->buffer)) {
        break;
      }
      pprev_cluster = pcluster;
    }
  }

  if (pcluster) { // free from cluster
    ts_gc_slot_header_t* pheader = TS_OFFSET(ts_gc_slot_header_t, ptr,
		            - sizeof(ts_gc_slot_header_t));

    pheader->free.next_offset = ((char*)(pcluster->free_header) - (char*)(pcluster->buffer));
    pheader->free.free_count = 1;
    pcluster->free_header = &pheader->free;
    pcluster->free_count ++;
    return 1;
  }
  return 0;
}

static void ts_gc_free_from_large_table(ts_gc_t* gc, void* ptr) {
  if (gc->large_table == NULL)
    return;

  // free from large table
  size_t index = ts_gc_get_large_slot_index(gc, (uintptr_t)ptr);

  ts_gc_large_entry_t* pentry = gc->large_table[index];
  if (!pentry)
    return;

  ts_gc_large_entry_t* prev = NULL;
  for (; pentry; pentry = pentry->next) {
    if (pentry->slot.payload == ptr) {
      // found and free
      break;
    }
    prev = pentry;
  }

  if (!pentry)
    return;

  if (prev) {
    prev->next = pentry->next;
  } else {
    gc->large_table[index] = pentry->next;
  }

  free(pentry);
}

void ts_gc_free(ts_gc_t* gc, void* ptr) {
  if (!ts_gc_free_from_cluster(gc, ptr))
    ts_gc_free_from_large_table(gc, ptr);
}

//////////////////////////////////////////////////////////////////

static void ts_gc_mark_cluster_slots(ts_gc_cluster_entry_t* cluster_entry) {
  for (ts_gc_cluster_t* cluster = cluster_entry->header;
		  cluster; cluster = cluster->next) {
    ts_gc_used_slot_t* slot = cluster->used_header;
    uint16_t offset = TS_OFFSET_IN_CLUSTER(cluster->used_header, cluster);

    do {
      slot->gc_data.marked = 1;
      slot = TS_POINTER_IN_CLUSTER(ts_gc_used_slot_t, slot->gc_data.next_offset, cluster);
    } while (slot->gc_data.next_offset != offset);
  }
}

static void ts_gc_mark_large_slots(ts_gc_large_entry_t* large_table) {
  for (; large_table; large_table = large_table->next) {
    large_table->slot.header.used.gc_data.marked = 1;
  }
}

static void ts_gc_mark_all_slots(ts_gc_t* gc) {
  // mark all the slots
  for (uint32_t i = 0; i < gc->cluster_count; i ++) {
    ts_gc_mark_cluster_slots(&gc->clusters[i]);
  }

  for (uint32_t i = 0; i < gc->large_table_size; i ++) {
    ts_gc_mark_large_slots(gc->large_table[i]);
  }
}

static void ts_gc_visit_reference_children(ts_object_t* ptr, ts_object_visitor_t visitor) {
  if (ptr && OBJECT_VTABLE(ptr)->gc_visit)
    OBJECT_VTABLE(ptr)->gc_visit(ptr, visitor, NULL);
}

static void ts_gc_visit_reference(ts_object_t* ptr, ts_object_visitor_t visitor) {
  visitor(ptr, NULL);
  ts_gc_visit_reference_children(ptr, visitor);
}

static void ts_gc_unmark(ts_object_t* ptr, void* data) {
  ts_gc_used_slot_t* slot = TS_OFFSET(ts_gc_used_slot_t, ptr, sizeof(ts_gc_used_slot_t));
  if (slot->gc_data.marked) {
    slot->gc_data.marked  = 0;
    ts_gc_visit_reference_children(ptr, ts_gc_unmark);
  }
}

static void ts_gc_collect_slots(ts_gc_t* gc) {
  // start from global table
  for (uint32_t i = 0; i < gc->strong_table_size; i ++) {
    for (ts_gc_strong_table_t*  table = gc->strong_table[i];
            table; table = table->next) {
      uint32_t used_count = table->entry_count - table->free_count;
      for(uint32_t j = 0, idx = 0;
		   idx < used_count && j < table->entry_count; j ++) {
        ts_gc_strong_entry_t* entry = &table->entries[j];
	if (entry->reference) {
	  idx ++;
	  ts_gc_unmark((ts_object_t*)(entry->reference), NULL);
	}
      }
    }
  }

  // start from local scope
  for (ts_gc_local_scope_t* local = gc->local_scope; local; local = local->prev) {
    for (int i = 0; local->objects[i]; i++) {
      ts_gc_visit_reference(local->objects[i], ts_gc_unmark);
    }
  }
}

static void ts_gc_destroy_slot(ts_gc_t* gc, ts_gc_used_slot_t* slot) {
  ts_object_t* obj = TS_OFFSET(ts_object_t, slot, sizeof(ts_gc_used_slot_t));
  if (OBJECT_VTABLE(obj)->destroy) {
    OBJECT_VTABLE(obj)->destroy(obj);
  }
  if (slot->gc_data.has_weak) {
    ts_gc_weak_clear(gc, obj);
  }
}


static void ts_gc_free_cluster_garbage(ts_gc_t* gc, ts_gc_cluster_t* cluster) {
  if (!cluster->used_header) {
    return;
  }

  uint16_t offset = TS_OFFSET_IN_CLUSTER(cluster->used_header, cluster);
  ts_gc_used_slot_t *slot = cluster->used_header;

  do {
    uint16_t next_offset = slot->gc_data.next_offset;
    ts_gc_used_slot_t* next = TS_POINTER_IN_CLUSTER(ts_gc_used_slot_t, next_offset, cluster);
    if (slot->gc_data.marked) {
      // free the garbage
      if (slot->ref_count > 0) {
        ts_gc_destroy_slot(gc, slot);
      }

      // free the data
      if (next_offset == TS_OFFSET_IN_CLUSTER(slot, cluster)) { // all is free
        cluster->used_header = NULL;
	ts_gc_free_slot_t* free_slot = (ts_gc_free_slot_t*)cluster->buffer;
	free_slot->next_offset = 0;
	free_slot->free_count = cluster->slot_count;
	cluster->free_count = cluster->slot_count;
	cluster->free_header = free_slot;
	break;
      }

      // free the slot
      ts_gc_used_slot_t* prev = TS_POINTER_IN_CLUSTER(ts_gc_used_slot_t, slot->gc_data.prev_offset, cluster);
      prev->gc_data.next_offset = slot->gc_data.next_offset;
      next->gc_data.prev_offset = slot->gc_data.prev_offset;
      if (slot == cluster->used_header) {
        cluster->used_header = slot;
	offset = next_offset;
      }
      if (slot->ref_count > 0) {
        ts_gc_destroy_slot(gc, slot);
      }

      ts_gc_free_slot_t* free_slot = (ts_gc_free_slot_t*)slot;
      free_slot->next_offset = (char*)(cluster->free_header) - (char*)(cluster->buffer);
      free_slot->free_count = 1;
      cluster->free_count ++;
    }
    slot = next;
  } while(slot->gc_data.next_offset != offset);

}

static void ts_gc_free_cluster_entry_garbage(ts_gc_t* gc, ts_gc_cluster_entry_t* entry) {
  for (ts_gc_cluster_t* cluster = entry->header; cluster; cluster = cluster->next) {
    ts_gc_free_cluster_garbage(gc, cluster);
  }
}

static void ts_gc_free_large_garbage(ts_gc_t* gc, ts_gc_large_entry_t** entry) {

  ts_gc_large_entry_t* large = *entry;
  ts_gc_large_entry_t* prev = NULL;
  while(large) {
    if (large->slot.header.used.gc_data.marked) {
      // free it
      ts_gc_large_entry_t* tmp = large;
      large = large->next;

      if (tmp->slot.header.used.ref_count > 0) {
        ts_gc_destroy_slot(gc, &(tmp->slot.header.used));
      }
      free(tmp);
      if (prev) {
        prev->next = large;
      } else {
        *entry = large;
      }
    } else {
      prev = large;
      large = large->next;
    }
  }
}	

static void ts_gc_free_garbage(ts_gc_t* gc) {
  for (uint32_t i = 0; i < gc->cluster_count; i ++) {
    ts_gc_free_cluster_entry_garbage(gc, &gc->clusters[i]);
  }

  for (uint32_t i = 0; i < gc->large_table_size; i ++) {
    ts_gc_free_large_garbage(gc, &gc->large_table[i]);
  }
}

static void ts_gc_collect_garbage_all(ts_gc_t* gc) {
  ts_gc_mark_all_slots(gc);
  ts_gc_collect_slots(gc);
  ts_gc_free_garbage(gc);
}

void ts_gc_collect_garbage(ts_gc_t* gc, ts_gc_level_t level) {
  ts_gc_collect_garbage_all(gc);
}

// reference
void* ts_gc_add_ref(ts_gc_t* gc, void* ptr) {
  if (!ptr) return NULL;

  ts_gc_used_slot_t* slot = TS_OFFSET(ts_gc_used_slot_t, ptr, - sizeof(ts_gc_used_slot_t));

  slot->ref_count ++;
  return ptr;
}

void ts_gc_release(ts_gc_t* gc, void* ptr) {
  if (!ptr) return;

  ts_gc_used_slot_t* slot = TS_OFFSET(ts_gc_used_slot_t, ptr, - sizeof(ts_gc_used_slot_t));

  if (-- slot->ref_count == 0) {
    ts_gc_destroy_slot(gc, slot);
  }

  return;
}


const uint32_t ts_gc_weak_entry_size = 256;

static size_t ts_gc_get_weak_cluster_index(ts_gc_t* gc, uintptr_t ptr) {
  return (ptr >> 16) & (~(gc->weak_table_size - 1));
}

static size_t ts_gc_get_weak_entry_index(ts_gc_t* gc, uintptr_t ptr) {
  return ((ptr & 0xffff) >> 8) & (~(ts_gc_weak_entry_size - 1));
}

static ts_gc_weak_entry_t* ts_gc_new_weak_entry(void* ptr, ts_gc_weak_entry_t* next) {
  ts_gc_weak_entry_t* entry = (ts_gc_weak_entry_t*)malloc(sizeof(ts_gc_weak_entry_t));
  entry->next = next;
  entry->reference = (uintptr_t)ptr;
  entry->weak_ref_count = 0;
  return entry;
}

ts_gc_weak_ptr_t ts_gc_make_weak(ts_gc_t* gc, void* ptr) {
  if (!ptr) return NULL;
  // find & check the weak
  size_t index = ts_gc_get_weak_cluster_index(gc, (uintptr_t)ptr);

  if (gc->weak_table == NULL) {
    gc->weak_table = (ts_gc_weak_cluster_t**)(malloc(gc->weak_table_size * sizeof(ts_gc_weak_cluster_t*)));
    memset(gc->weak_table, 0, gc->weak_table_size * sizeof(ts_gc_weak_cluster_t*));
  }

  ts_gc_weak_cluster_t** ptable = &gc->weak_table[index];

  if (*ptable == NULL) {
    *ptable = (ts_gc_weak_cluster_t*) malloc(sizeof(ts_gc_weak_cluster_t) + 
		    ts_gc_weak_entry_size * sizeof(ts_gc_weak_entry_t*));
    (*ptable)->hash_count = ts_gc_weak_entry_size;
    (*ptable)->free_count = (*ptable)->hash_count;
    memset((*ptable)->entries, 0, (*ptable)->hash_count * sizeof(ts_gc_weak_entry_t*));
  }

  size_t entry_index = ts_gc_get_weak_entry_index(gc, (uintptr_t)ptr);

  ts_gc_weak_entry_t** pentry = &((*ptable)->entries[entry_index]);

  if (*pentry == NULL) {
    *pentry = ts_gc_new_weak_entry(ptr, NULL);
  } else {
    // find the entry if exits
    for (ts_gc_weak_entry_t* entry = *pentry; entry; entry = entry->next) {
      if (entry->reference == (uintptr_t)ptr) {
        entry->weak_ref_count ++;
	return entry;
      }
    }
    *pentry = ts_gc_new_weak_entry(ptr, *pentry);
    return *pentry;
  }
}

void* ts_gc_weak_get_ptr(ts_gc_t* gc, ts_gc_weak_ptr_t weak_ptr) {
  return weak_ptr ? (void*)(weak_ptr->reference) : NULL;
}

ts_object_t* ts_gc_from_weak(ts_gc_t* gc, ts_gc_weak_ptr_t weak_ptr) {
  if (!weak_ptr) return NULL;
  return (ts_object_t*)(weak_ptr->reference);
}

void  ts_gc_weak_free(ts_gc_t* gc, ts_gc_weak_ptr_t weak_ptr) {
  if (!weak_ptr) return;

  if (--weak_ptr->weak_ref_count == 0) {
    ts_gc_weak_clear(gc, (void*)weak_ptr->reference);
  }
}

void  ts_gc_weak_clear(ts_gc_t* gc, void* ptr) {
  // remove from table
  if (gc->weak_table == NULL) return;

  size_t index = ts_gc_get_weak_cluster_index(gc, (uintptr_t)ptr);
  ts_gc_weak_cluster_t* ptable = gc->weak_table[index];
  if (!ptable) return;

  size_t entry_index = ts_gc_get_weak_entry_index(gc, (uintptr_t)ptr);
  ts_gc_weak_entry_t* pentry = ptable->entries[entry_index];
  ts_gc_weak_entry_t* prev = NULL;
  while (pentry && pentry->reference != (uintptr_t)ptr) {
    prev = pentry;
    pentry = pentry->next;
  }
  if (pentry) {
    if (prev)
      prev->next = pentry->next;
    else
      ptable->entries[entry_index] = pentry->next;
    free(pentry);
  }
}

void ts_gc_push_local_scope(ts_gc_t* gc, ts_gc_local_scope_t* scope) {
  scope->prev = gc->local_scope;
  gc->local_scope = scope; 
}

void ts_gc_pop_local_scope(ts_gc_t* gc, ts_gc_local_scope_t* scope) {
  if (gc->local_scope == scope) {
    gc->local_scope = scope->prev;
  }
}

ts_gc_local_scope_t* ts_gc_get_local_scope(ts_gc_t* gc) {
  return gc->local_scope;
}
