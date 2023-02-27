#ifdef CONFIG_SCHED_BACKTRACE
#include <execinfo.h>
#endif
#include <stdlib.h>
#include "ts_std.h"
#include "ts_lang.h"
#include "ts_std_console_internal.h"

typedef struct _ts_std_console_t {
  ts_object_t base;
} ts_std_console_t;

typedef enum _ts_std_console_level_t {
  std_console_level_info,
  std_console_level_log,
  std_console_level_debug,
  std_console_level_warn,
  std_console_level_error,
} ts_std_console_level_t;

static const char* _std_console_level_str[] = {
  "INFO",
  "LOG",
  "DEBUG",
  "WARN",
  "ERROR"
};

static int _ts_console_output(ts_object_t* self, ts_std_console_level_t level, ts_argument_t args, ts_return_t ret) {
  char buffer[TS_STR_FORMAT_SIZE];
  int len = snprintf(buffer, sizeof(buffer), "[TS %s] ",
		  _std_console_level_str[level]);

  if (args == NULL)
    return 0;

  int argc = TS_ARG_COUNT(args);

  for (int i = 0; i < argc && len < sizeof(buffer); i ++) {
    ts_object_t* obj = TS_ARG_OBJECT(args, i); 
    len += ts_object_to_c_str(obj, buffer + len, sizeof(buffer) - len);
  }
  buffer[len] = '\0';
  printf("%s\n", buffer);
  return 0;
}

#define TS_CONSOLE_OUTPUT_DEF(level) \
static int _ts_console_##level(ts_object_t* self, ts_argument_t args, ts_return_t ret) { \
  return _ts_console_output(self, std_console_level_##level, args, ret); \
}

TS_CONSOLE_OUTPUT_DEF(info)
TS_CONSOLE_OUTPUT_DEF(log)
TS_CONSOLE_OUTPUT_DEF(debug)
TS_CONSOLE_OUTPUT_DEF(warn)
TS_CONSOLE_OUTPUT_DEF(error)

static int _ts_console_trace(ts_object_t* self, ts_argument_t args, ts_return_t ret) {
#ifdef CONFIG_SCHED_BACKTRACE
  void *buffer[100];
  char **symbols;

  int num = backtrace(buffer, 100);
  printf("\nbacktrace() returned %d addresses\n", num);

  symbols = backtrace_symbols(buffer, num);
  if (symbols == NULL) {
    perror("backtrace_symbols");
  }

  for (int j = 0; j < num; j++)
    printf("  %s\n", symbols[j]);

  printf("\n");
  free(symbols);
#else
  printf("Please define CONFIG_SCHED_BACKTRACE \n");
#endif
  return 0;
}

static TS_VTABLE_DEF(_console_vt, 6) = {
  TS_VTABLE_BASE(
    sizeof(ts_std_console_t),
    "console",
    0, // interface count
    TS_VTABLE_NEMBER_COUNT(_console_vt),
    NULL,  // consructor
    NULL,  // destroy
    NULL,  // to string
    NULL  // visitor
  ),
  {
    {.method = _ts_console_info},
    {.method = _ts_console_log},
    {.method = _ts_console_debug},
    {.method = _ts_console_warn},
    {.method = _ts_console_error},
    {.method = _ts_console_trace},
  }
};

ts_vtable_t* ts_get_std_console_vtable() {
  return &_console_vt.base;
}
