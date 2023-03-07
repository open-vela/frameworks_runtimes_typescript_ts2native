#ifndef TS_EXCEPTION_H_
#define TS_EXCEPTION_H_

#ifndef TS_NO_EXCEPTION
#define TS_EXCEPTION_SUPPORT
#endif

#ifdef TS_EXCEPTION_SUPPORT


#include <alloca.h>

#include "ts_common.h"
#include "ts_runtime.h"
#include "ts_std.h"

#ifdef TOWASM
//添加std::function头文件
#include <functional>
//定义在ts_exception.cpp里，id自增
extern uint32_t global_index;
//声明在wamr里实现的函数
extern "C" void setjmp_inwamr (int runtime,int blockid);
extern "C" int  longjmp_inwamr (int blockid,int flag);
#else
#include <setjmp.h>
#endif


TS_CPP_BEGIN

typedef struct _ts_try_block_t ts_try_block_t;

typedef enum _ts_try_state_t {
  ts_try_state_pending,
  ts_try_state_throwed,
  ts_try_state_catched,
  ts_try_state_raise_finally, // need raise to finally and then raise
} ts_try_state_t;

struct _ts_try_block_t {
  ts_try_block_t* prev;
#ifdef TOWASM
  int block_id;
  //异常触发时的回调函数
  void (*callbackExp)(ts_runtime_t*,int);
  //tryblock的回调函数，之所以要添加这个函数，是为了保证setjmp不返回，保留栈信息,用std::function捕获try block外的变量
  std::function<void()> callbackTry;
#else
  jmp_buf jmp_env;
#endif
  ts_gc_local_scope_t* local_scope;
  uint32_t state;
};

static inline void ts_exception_drop(ts_runtime_t* rt, ts_try_block_t* block) {
  if (!block || rt->try_block != block)
    return;

  // restore the local_scope
  ts_gc_local_scope_t* scope = rt->get_top_local_scope(rt->gc);
  while(scope && scope != block->local_scope) {
    rt->pop_local_scope(rt->gc, scope);
    scope = rt->get_top_local_scope(rt->gc); 
  }

  if (scope) {
    rt->pop_local_scope(rt->gc, scope);
  }


  rt->try_block = block->prev;
  if (rt->try_block) {
    rt->try_block->state = ts_try_state_pending; // reset the state
  }
}

static inline void ts_exception_jump_catch(ts_runtime_t* rt) {
  if (rt->try_block) {
    rt->try_block->state = ts_try_state_throwed;
    #ifdef TOWASM
    longjmp_inwamr(rt->try_block->block_id, 1);
    #else
    longjmp(rt->try_block->jmp_env, 1);
    #endif
  }
}

static inline void ts_exception_jump_finally(ts_runtime_t* rt) {
  if (rt->try_block) {
    rt->try_block->state = ts_try_state_raise_finally;
    #ifdef TOWASM
    longjmp_inwamr(rt->try_block->block_id, 2);
    #else
    longjmp(rt->try_block->jmp_env, 2);
    #endif
  }
}


static inline void ts_exception_try_begin(ts_runtime_t* rt, ts_try_block_t* block) {
  block->state = ts_try_state_pending;
  block->local_scope = rt->get_top_local_scope(rt->gc);
  block->prev = rt->try_block;

  rt->try_block = block;

  // return setjmp(block->jmp_env); must call directly
}

static inline ts_object_t* ts_runtime_get_exception(ts_runtime_t* rt) {
  return rt->exception_value;
}

static inline void ts_exception_try_end(ts_runtime_t* rt) {
  ts_try_block_t* block = rt->try_block;
  if (block == NULL)
    return ;

  switch(block->state) {
    case ts_try_state_pending: // no exception
    case ts_try_state_catched: // catched, no finally or finallyed
      ts_exception_drop(rt, block);
      ts_object_release(rt->exception_value);
      return;
    case ts_try_state_throwed: // no catch, or rethrow and finallyed
    case ts_try_state_raise_finally: // catched, by rethrow, but no finally
      ts_exception_drop(rt, block);
      ts_exception_jump_catch(rt);
      return ;  // raise the exception to outter try-block
  }
}

static inline void ts_exception_throw(ts_runtime_t* rt, ts_object_t* err_obj) {
  ts_try_block_t* block = rt->try_block;
  ts_reset_object(&rt->exception_value, err_obj);

  if (block) {
    if (block->state == ts_try_state_pending) {
      ts_exception_jump_catch(rt); // jump to do catch
    } else if (block->state == ts_try_state_catched) {
      ts_exception_jump_finally(rt);
    }
  }
}

static inline int ts_exception_check_catch(ts_runtime_t* rt) {
  ts_try_block_t* block = rt->try_block;
  if (block && block->state == ts_try_state_throwed) {
    block-> state = ts_try_state_catched;
    return 1;
  }

  return 0;
}

static inline int ts_exception_check_finally(ts_runtime_t* rt) {
  ts_try_block_t* block = rt->try_block;
  if (block) {
    if (block->state == ts_try_state_pending     // no exception raised
	|| block->state == ts_try_state_catched  // exception has catched
     ) {
      return 1; // need do finaly
    }

    if (block->state == ts_try_state_throwed   // no catch block
	|| block->state == ts_try_state_raise_finally) // catched but rethrow
    {
      block->state = ts_try_state_throwed; // throw
      return 1; // do finally
    }
  }
  return 0;
}

static inline ts_object_t* ts_exception_new_error(ts_runtime_t* rt, const char* message, ts_object_t* cause, const char* filename, int lineNo, int colNo) {
  TS_DEF_ARGUMENTS(5);
  TS_SET_STR_ARG(message);
  TS_SET_OBJECT_ARG(cause);
  TS_SET_STR_ARG(filename);
  TS_SET_INT_ARG(lineNo);
  TS_SET_INT_ARG(colNo);
  return ts_new_object(rt,
	   ts_module_class_of(rt->std_module, lang_class_max + ts_std_exception_error_index), TS_ARGUMENTS);
}

#define TS_THORW_ERROR(rt, message) \
  ts_exception_throw(rt, ts_exception_new_error(rt, \
		message,                            \
		NULL,                               \
                __FILE__,                           \
		__LINE__,                           \
		0))

#ifdef TOWASM
#define TS_TRY_BEGIN(rt) do {                                   \
  ts_runtime_t* ___rt___ = (rt);                                \
  ts_exception_try_begin(___rt___,                              \
    (ts_try_block_t*)(alloca(sizeof(ts_try_block_t))));         \
  rt->try_block->block_id = global_index++;                     \
  rt->try_block->callbackTry = [&](){    
#else
#define TS_TRY_BEGIN(rt) do {                                   \
  ts_runtime_t* ___rt___ = (rt);                                \
  ts_exception_try_begin(___rt___,                              \
	  (ts_try_block_t*)(alloca(sizeof(ts_try_block_t))));   \
  int __try_ret__ = setjmp(rt->try_block->jmp_env);             \
  if (__try_ret__ == 0) {
#endif


#define TS_TRY_RETURN(return_expr, ret_val) do {                \
  (return_expr);                                                \
  ts_exception_try_end(___rt___);                               \
  return (ret_val);                                             \
} while(0)

#ifdef TOWASM
#define TS_CATCH(rt,err)                                        \
   rt->try_block->callbackExp = [](ts_runtime_t*rt ,int val) ->void      \
   {  do{                                                       \
    ts_runtime_t* ___rt___ = (rt);                              \
    if (val == 1                                                \
   && ts_exception_check_catch(___rt___)) {                     \
    ts_object_t* err = ts_runtime_get_exception(___rt___);
#else
#define TS_CATCH(err)                                           \
  } else if (__try_ret__ == 1                                   \
	 && ts_exception_check_catch(___rt___)) {                     \
    ts_object_t* err = ts_runtime_get_exception(___rt___);
#endif

#define TS_FINALLY                                              \
  } if(ts_exception_check_finally(___rt___)) {                  \

#ifdef TOWASM
#define TS_TRY_END                                              \
    } ts_exception_try_end(___rt___);                           \
  } while(0); };   
#else
#define TS_TRY_END                                              \
  } ts_exception_try_end(___rt___);                             \
} while(0); 
#endif

#ifdef TOWASM
//增加TS_TRY_REAL_END宏，把try block都包到回调函数里
#define TS_TRY_REAL_END                                         \
  };                                                            \
  setjmp_inwamr((uint32_t)___rt___,rt->try_block->block_id);    \
}while(0);
#endif

TS_CPP_END

#else  // TS_EXCEPTION_SUPPORT

#define TS_TRY_BEGIN(rt)

#define TS_TRY_RETURN(return_expr, ret_value) do {            \
  (return_expr);                                              \
  return (ret_val);                                           \
} while(0)

#define TS_CATCH(err)

#define TS_FINALLY

#define TS_TRY_END

#endif

#endif
