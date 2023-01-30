test_modules= \
  libtest_hello.so             \
  libtest_class1.so            \
  libtest_class2.so            \
  libtest_function1.so         \
  libtest_function2.so         \
  libtest_interface1.so        \
  libtest_interface2.so        \
  libtest_timeout.so           \
  libtest_promise1.so

all:tsshell  $(test_modules)

runtime_objs =          \
    ts_shell.o          \
    ts_gc.o             \
    ts_lang.o           \
    ts_runtime.o        \
    ts_std.o            \
    ts_std_console.o    \
    ts_std_timer.o      \
    ts_std_promise.o

RT_LDFLAGS =

RT_CFLAGS = -I. -g

tsshell: $(runtime_objs)
	$(CC) -o $@ $^ $(RT_LDFLAGS) -ldl

libtest_hello.so: test/test_hello_manual.o
	$(CC) -fPIC -shared -o $@ $^ $(RT_LDFLAGS)

libtest_class1.so: test/test_class1_manual.o
	$(CC) -fPIC -shared -o $@ $^ $(RT_LDFLAGS)

libtest_class2.so: test/test_class2_manual.o
	$(CC) -fPIC -shared -o $@ $^ $(RT_LDFLAGS)

libtest_function1.so: test/test_function1_manual.o
	$(CC) -fPIC -shared -o $@ $^ $(RT_LDFLAGS)

libtest_function2.so: test/test_function2_manual.o
	$(CC) -fPIC -shared -o $@ $^ $(RT_LDFLAGS)

libtest_interface1.so: test/test_interface1_manual.o
	$(CC) -fPIC -shared -o $@ $^ $(RT_LDFLAGS)

libtest_interface2.so: test/test_interface2_manual.o
	$(CC) -fPIC -shared -o $@ $^ $(RT_LDFLAGS)

libtest_timeout.so: test/test_timeout_manual.o
	$(CC) -fPIC -shared -o $@ $^ $(RT_LDFLAGS)

libtest_promise1.so: test/test_promise1_manual.o
	$(CC) -fPIC -shared -o $@ $^ $(RT_LDFLAGS)
%.o:%.c
	$(CC) -c -o $@ $< $(RT_CFLAGS)

test/%.o:test/%.c
	$(CC) -fPIC -c -o $@ $< $(RT_CFLAGS)

clean:
	rm -f *.o tsshell *.so test/test_*.o
