test_modules= \
  test_hello             \
  test_class1            \
  test_class2            \
  test_function1         \
  test_function2         \
  test_interface1        \
  test_interface2        \
  test_timeout           \
  test_promise1          \
  test_async_await       \
  test_union1            \
  test_trycatch

test_module_targets=$(foreach m, $(test_modules), lib$(m).so)
run_test_modules=$(foreach m, $(test_modules), echo "\n\n== RUN \"./tsshell $(m)\" ===" && ./tsshell $(m) &&)

all:tsshell  $(test_module_targets)

runtime_objs =          \
    ts_shell.o          \
    ts_gc.o             \
    ts_lang.o           \
    ts_runtime.o        \
    ts_std.o            \
    ts_std_console.o    \
    ts_std_timer.o      \
    ts_std_promise.o    \
    ts_exception.o

RT_LDFLAGS =

RT_CFLAGS = -I. -g

tsshell: $(runtime_objs)
	$(CC) -o $@ $^ $(RT_LDFLAGS) -ldl

libtest_%.so: test/test_%_manual.o
	$(CC) -fPIC -shared -o $@ $^ $(RT_LDFLAGS)

%.o:%.c
	$(CC) -c -o $@ $< $(RT_CFLAGS)

test/%.o:test/%.c
	$(CC) -fPIC -c -o $@ $< $(RT_CFLAGS)

clean:
	rm -f *.o tsshell *.so test/test_*.o

run_tests:tsshell $(test_module_targets)
	$(run_test_modules) echo "============ END =============="
