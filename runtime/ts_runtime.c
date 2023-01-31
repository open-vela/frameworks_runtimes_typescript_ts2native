
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <memory.h>

#include "ts_runtime.h"
#include "ts_std.h"
#include "ts_gc.h"
#include "ts_gc_internal.h"
#include "ts_debug.h"

static ts_object_t* _new_object(ts_gc_t* gc, ts_vtable_env_t* env_vt, ts_argument_t args) {
  ts_vtable_t* vt = env_vt->vtable;
  void *ptr = ts_gc_alloc(gc, env_vt->vtable->object_size);
  ts_object_t* obj = TS_OFFSET(ts_object_t, ptr, sizeof(ts_interface_t) * (vt->interfaces_count));
  obj->vtable_env = env_vt;

  // init the interfaces
  if (vt->interfaces_count > 0) {
    ts_interface_t* intf = (ts_interface_t*)obj;
    ts_interface_entry_t* entries = (ts_interface_entry_t*)vt;
    for (int32_t i = 0; i < (int)(vt->interfaces_count); i++) {
      intf[-i-1].interface_entry = &entries[-i-1];
    }
  }

  if (env_vt->vtable->constructor) {
    env_vt->vtable->constructor(obj, args, NULL);
  }
  return obj;
}

static void _delete_object(ts_gc_t* gc, ts_object_t* obj) {
  ts_gc_free(gc, obj);
}

ts_runtime_t* ts_runtime_create(int argc, const char* argv[]) {
  ts_runtime_t* rt = (ts_runtime_t*)malloc(sizeof(ts_runtime_t));

  // create and initialize gc
  rt->gc = ts_gc_create(NULL);
  rt->new_object = _new_object;
  rt->delete_object = _delete_object;
  rt->gc_alloc = ts_gc_alloc;
  rt->gc_free = ts_gc_free;
  // strong ref
  //rt->make_strong_ref = 
  //rt->free_strong_ref =
  //rt->get_object_from_strong =
  rt->make_weak_ref = ts_gc_make_weak;
  rt->free_weak_ref = ts_gc_weak_free;
  rt->get_object_from_weak = ts_gc_from_weak;
  rt->do_gc = ts_gc_collect_garbage;

  rt->push_local_scope = ts_gc_push_local_scope;
  rt->pop_local_scope = ts_gc_pop_local_scope;

  rt->std_module = ts_create_std_module(rt);

  return rt;
}

void ts_runtime_destroy(ts_runtime_t* rt) {
  _delete_object(rt->gc, &rt->std_module->base);
  ts_gc_destroy(rt->gc);
  free(rt);
}

