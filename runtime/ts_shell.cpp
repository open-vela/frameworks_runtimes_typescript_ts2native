
#include "ts_runtime.h"
#include "ts_package.h"
#include "ts_exception.hpp"
#include "ts_std.h"

#ifdef TEST
#include "test/ts_built_in_modules.h"
#endif

#include <stdio.h>
#include <unistd.h>
#include <stdlib.h>
#include <string.h>
#ifndef TOWASM
#include <dlfcn.h>
#include <sys/timerfd.h>
#endif
#include <time.h>
#include <poll.h>

#ifdef TOWASM
#include "ts_built_in_modules.h"
extern "C" int timerfd_create_inwamr();
extern "C" int timerfd_settime_inwamr(int fd,uint64_t min_timeout);
#endif

///////////////////////////////////////////////////////////////////////////
#define TASK_BUFFER  256

typedef struct _task_t task_t;
struct _task_t {
  task_t* next;
  void (*call)(void* data);
  void (*free)(void* data);
  void* data;
  uint64_t timeout; //us
};

typedef struct _message_loop_t {
  int loop_fd;
  ts_runtime_t* runtime;
  uint64_t last_timeout;
  uint64_t timer_timeout;
  task_t*  task_header;

  task_t*  free_task;
  task_t task_buffer[TASK_BUFFER];
} message_loop_t;

extern "C"
{

static uint64_t get_now_us() {
  struct timespec ts;
  clock_gettime(CLOCK_MONOTONIC, &ts);
  return ts.tv_sec * 1000000 + ts.tv_nsec / 1000;
}

void free_messasge_loop(message_loop_t* loop) {
  if (loop->loop_fd) {
    close(loop->loop_fd);
  }

  free(loop);
}

static task_t* get_free_task(message_loop_t* loop) {
  if (loop->free_task == NULL) {
    return (task_t*)(malloc(sizeof(task_t)));
  }
  task_t* task = loop->free_task;
  loop->free_task = task->next;
  return task;
}

static void free_task(message_loop_t* loop, task_t* task) {
  if (task >= loop->task_buffer && task < (loop->task_buffer + TASK_BUFFER)) {
    task->next = loop->free_task;
    loop->free_task = task;
  } else {
    free(task);
  }
}

static void update_loop_timeout(message_loop_t* loop) {
  uint64_t min_timeout = loop->last_timeout;
  if (min_timeout > loop->timer_timeout)
    min_timeout = loop->timer_timeout;

  if (loop->task_header && min_timeout > loop->task_header->timeout)
    min_timeout = loop->task_header->timeout;

  if (min_timeout < loop->last_timeout) {
    loop->last_timeout = min_timeout;
    #ifdef TOWASM
    timerfd_settime_inwamr(loop->loop_fd, min_timeout);
    #else
    struct itimerspec spec = {};
    spec.it_value.tv_sec = min_timeout / 1000000;
    spec.it_value.tv_nsec = (min_timeout % 1000000) * 1000;
    timerfd_settime(loop->loop_fd, TFD_TIMER_ABSTIME, &spec, NULL);
    #endif
  }
}

static task_t* create_task(message_loop_t* loop, void(*call)(void*), void* data, void (*free_data)(void*)) {
  task_t* task = get_free_task(loop);
  task->next = NULL;
  task->call = call;
  task->data = data;
  task->free = free_data;
  task->timeout = 0;

  return task;
}

static void post_task_delay(message_loop_t* loop, task_t* task, uint64_t delayus) {
  // insert the task
  task->timeout = get_now_us() + delayus;

  task_t* head = loop->task_header;
  task_t* prev = NULL;
  while (head && head->timeout <= task->timeout) {
    prev = head;
    head = head->next;
  }

  if (prev) {
    task->next = prev->next;
    prev->next = task;
  } else {
    task->next = loop->task_header;
    loop->task_header = task;
  }

  update_loop_timeout(loop);
}

static void post_task(message_loop_t* loop, task_t* task) {
  post_task_delay(loop, task, 0);
}

static void run_loop_task(message_loop_t* loop) {
  uint64_t now = get_now_us();

  if (now >= loop->timer_timeout) {
    loop->timer_timeout = (uint64_t)-1;
    loop->runtime->std_backend.on_timeout(loop->runtime, now);
  }

  while(loop->task_header && loop->task_header->timeout <= now) {
    task_t* task = loop->task_header;
    loop->task_header = task->next;
    if (task->call) {
      task->call(task->data);
    }
    if (task->free) {
      task->free(task->data);
    }

    free_task(loop, task);
  }

  update_loop_timeout(loop);
}

static int run_loop(message_loop_t* loop) {
   struct pollfd fds[16]; // max fds

   fds[0].fd = loop->loop_fd;
   fds[0].events = POLLIN | POLLERR;
   fds[0].revents = 0;

   int max_fds = 1;

   int ret = poll(fds, max_fds, -1);

   if (ret < 0) {
     return -1;
   }

   int process_count = 0;
   for (int i = 0; i < max_fds; i++) {
     if (fds[i].fd == loop->loop_fd) {
       run_loop_task(loop);
       process_count ++;
     }
   }

   return process_count;
}

static int message_loop_has_more(message_loop_t* loop) {
  return loop->timer_timeout != (uint64_t)-1 || loop->task_header != NULL;
}

static uint64_t get_loop_current_timeout_ms(void* data) {
  return get_now_us() / 1000;  // ms
}

static ts_std_task_t loop_create_task(void(*task_impl)(void*), void* data, void(*free_data)(void*), void* backend_data) {
  return (ts_std_task_t)(create_task((message_loop_t*)backend_data, task_impl, data, free_data));
}
static void ts_post_task_delay(ts_std_task_t task, uint32_t delayms, void* data) {
  post_task_delay((message_loop_t*)data, (task_t*)task, delayms * 1000);
}

static void set_loop_next_timeout(uint64_t timeout_ms, void* data) {
  message_loop_t* loop = (message_loop_t*)data;
  loop->timer_timeout = timeout_ms * 1000;
  update_loop_timeout(loop);
}

message_loop_t* create_message_loop(ts_runtime_t* rt) {
  message_loop_t* loop = (message_loop_t*)malloc(sizeof(message_loop_t));
#ifdef TOWASM
  loop->loop_fd = timerfd_create_inwamr();
#else
  loop->loop_fd = timerfd_create(CLOCK_MONOTONIC, TFD_NONBLOCK | TFD_CLOEXEC);
#endif

  loop->runtime = rt;
  loop->last_timeout = (uint64_t)-1;
  loop->timer_timeout = (uint64_t)-1;
  loop->task_header = NULL;
  loop->free_task = loop->task_buffer;

  rt->std_backend.backend_data = loop;
  rt->std_backend.get_current_timeout = get_loop_current_timeout_ms;
  rt->std_backend.set_next_timeout = set_loop_next_timeout;
  rt->std_backend.create_task = loop_create_task;
  rt->std_backend.post_task_delay = ts_post_task_delay;
  
  for(size_t i = 0; i < sizeof(loop->task_buffer) / sizeof(loop->task_buffer[0]) - 1; i ++) {
    loop->task_buffer[i].next = &(loop->task_buffer[i+1]);
  }
  loop->task_buffer[sizeof(loop->task_buffer) / sizeof(loop->task_buffer[0]) - 1].next = NULL;
  return loop;
}

///////////////////////////////////////////////////////////////////////////
int main(int argc, const char* argv[]) {
  if (argc <= 1) {
    printf("useage: %s <ts-module>\n", argv[0]);
    return 0;
  }


  ts_runtime_t* rt = ts_runtime_create(argc, argv);
#ifdef TOWASM
  TS_TRY_BEGIN(rt)
  TS_CATCH(rt,err)
    TS_DEF_ARGUMENTS(2);
    TS_SET_OBJECT_ARG(TS_STRING_NEW_STACK(rt, "TS Error:"));
    TS_SET_OBJECT_ARG(err);
    ts_std_console_log(rt, TS_ARGUMENTS);
  TS_TRY_END
  ts_module_t* m = ts_try_load_module_from_built_in(rt, argv[1]);
  if (m) {
    TS_PUSH_LOCAL_SCOPE(rt, 1);
    TS_SET_LOCAL_OBJECT(0, m);

    message_loop_t* loop = create_message_loop(rt);

    // call initialize
    ts_module_initialize(m);
    while(message_loop_has_more(loop)) {
      run_loop(loop);
    }

    free_messasge_loop(loop);
    TS_POP_LOCAL_SCOPE(rt);
  }
  TS_TRY_REAL_END

#else 

  TS_TRY_BEGIN(rt)
    ts_module_t* m = ts_load_module(rt, argv[1], ts_module_no_package);
#ifdef TEST
    if (!m) {
      m = ts_try_load_module_from_built_in(rt, argv[1]);
    }
#endif
    if (m) {
      TS_PUSH_LOCAL_SCOPE(rt, 1);
      TS_SET_LOCAL_OBJECT(0, m);

      message_loop_t* loop = create_message_loop(rt);

      // call initialize
      ts_module_initialize(m);
      while(message_loop_has_more(loop)) {
        run_loop(loop);
      }

      free_messasge_loop(loop);
      TS_POP_LOCAL_SCOPE(rt);
    }
  TS_CATCH(err)
    TS_DEF_ARGUMENTS(2);
    TS_SET_OBJECT_ARG(TS_STRING_NEW_STACK(rt, "TS Error:"));
    TS_SET_OBJECT_ARG(err);
    ts_std_console_log(rt, TS_ARGUMENTS);
  TS_TRY_END
#endif
  ts_runtime_destroy(rt);
}

}