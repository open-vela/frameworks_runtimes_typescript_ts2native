
#include "ts_runtime.h"
#include <stdio.h>
#include <unistd.h>
#include <stdlib.h>
#include <string.h>
#include <dlfcn.h>
#include <sys/timerfd.h>
#include <time.h>
#include <poll.h>

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
    struct itimerspec spec = {};
    spec.it_value.tv_sec = min_timeout / 1000000;
    spec.it_value.tv_nsec = (min_timeout % 1000000) * 1000;
    timerfd_settime(loop->loop_fd, TFD_TIMER_ABSTIME, &spec, NULL);
  }
}

static void post_task_delay_data(message_loop_t* loop, void(*call)(void*), uint32_t delayus, void* data, void (*free_data)(void*)) {
  task_t* task = get_free_task(loop);
  task->next = NULL;
  task->call = call;
  task->data = data;
  task->free = free_data;
  task->timeout = get_now_us() + delayus;

  // insert the task
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

static void post_task_data(message_loop_t* loop, void(*call)(void*), void* data, void(*free_data)(void*)) {
  post_task_delay_data(loop, call, 0, data, free_data);
}

static void post_task(message_loop_t* loop, void(*call)(void*)) {
  post_task_data(loop, call, NULL, NULL);
}

static void post_task_delay(message_loop_t* loop, void(*call)(void*), uint32_t delayus) {
  post_task_delay_data(loop, call, delayus, NULL, NULL);
}

static void run_loop_task(message_loop_t* loop) {
  uint64_t now = get_now_us();

  if (now >= loop->timer_timeout) {
    loop->timer_timeout = (uint64_t)-1;
    loop->runtime->std_backend.on_timeout(loop->runtime, now);
  }

  task_t* task = loop->task_header;
  while(task && task->timeout >= now) {
    if (task->call) {
      task->call(task->data);
    }
    if (task->free) {
      task->free(task->data);
    }

    task_t* tmp = task;
    task = task->next;
    free_task(loop, tmp);
  }

  loop->task_header = task;
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

static void set_loop_next_timeout(uint64_t timeout_ms, void* data) {
  message_loop_t* loop = (message_loop_t*)data;
  loop->timer_timeout = timeout_ms * 1000;
  update_loop_timeout(loop);
}

message_loop_t* create_message_loop(ts_runtime_t* rt) {
  message_loop_t* loop = (message_loop_t*)malloc(sizeof(message_loop_t));
  loop->loop_fd = timerfd_create(CLOCK_MONOTONIC, TFD_NONBLOCK | TFD_CLOEXEC);

  loop->runtime = rt;
  loop->last_timeout = (uint64_t)-1;
  loop->timer_timeout = (uint64_t)-1;
  loop->task_header = NULL;
  loop->free_task = loop->task_buffer;

  rt->std_backend.backend_data = loop;
  rt->std_backend.get_current_timeout = get_loop_current_timeout_ms;
  rt->std_backend.set_next_timeout = set_loop_next_timeout;
  
  for(size_t i = 0; i < sizeof(loop->task_buffer) / sizeof(loop->task_buffer[0]) - 1; i ++) {
    loop->task_buffer[i].next = &(loop->task_buffer[i+1]);
  }
  loop->task_buffer[sizeof(loop->task_buffer) / sizeof(loop->task_buffer[0]) - 1].next = NULL;
  return loop;
}

///////////////////////////////////////////////////////////////////////////
static ts_module_t* load_module(const char* module, ts_runtime_t* rt) {
  // load the module
  char module_path[512];
  char module_name[256];
  snprintf(module_path, sizeof(module_path), "./lib%s.so", module);
  void* handle = dlopen(module_path, RTLD_LAZY); 

  if (handle == NULL) {
    printf("try load \"%s\"(from \"%s\") failed: %s\n", module, module_path, dlerror());
    return NULL;
  }

  snprintf(module_name, sizeof(module_name), "_%s_module", module);
  ts_module_entry_t entry = (ts_module_entry_t)dlsym(handle, module_name);

  if (entry == NULL) {
    printf("cannot find entry \"%s\" from \"%s\"\n", module_name, module_path);
    return NULL;
  }
  ts_module_t* m = entry(rt);
  if (m == NULL) {
    printf("cannot create module with entry \"%s\" from \"%s\"\n",
		    module_name, module_path);
    return NULL;
  }
  return m;
}

int main(int argc, const char* argv[]) {
  if (argc <= 1) {
    printf("useage: %s <ts-module>\n", argv[0]);
    return 0;
  }


  ts_runtime_t* rt = ts_runtime_create(argc, argv);

  ts_module_t* m = load_module(argv[1], rt);
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

  ts_runtime_destroy(rt);
}
