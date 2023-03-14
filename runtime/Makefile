#BUILD_32BIT=-m32

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
  test_trycatch			 \
  test_date

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
    ts_std_date.o       \
    ts_exception.o      \
    ts_package.o

builtin_objs = 						          \
	test/ts_built_in_modules.o           \
    test/test_async_await_manual.o  \
    test/test_class1_manual.o       \
    test/test_class2_manual.o       \
    test/test_function1_manual.o    \
    test/test_function2_manual.o    \
    test/test_hello_manual.o        \
    test/test_interface1_manual.o   \
    test/test_interface2_manual.o   \
    test/test_promise1_manual.o     \
    test/test_timeout_manual.o      \
    test/test_trycatch_manual.o     \
    test/test_union1_manual.o

RT_LDFLAGS = $(BUILD_32BIT)

RT_CFLAGS = $(BUILD_32BIT) -I. -g
CXXFLAGS = $(BUILD_32BIT) -fPIC -I. -g

vela: RT_LDFLAGS += -p -fsanitize=address -fsanitize-recover=address -DTEST
vela: RT_CFLAGS += -p -fsanitize=address -fsanitize-recover=address -DTEST
vela: CXXFLAGS += -p -fsanitize=address -fsanitize-recover=address -DTEST
vela: $(runtime_objs) $(builtin_objs)
	$(CC) -o tsshell_vela $^ $(RT_LDFLAGS) -ldl -lm

runtime_srcs =                     \
    ts_shell.cpp                   \
    ts_gc.c                        \
    ts_lang.c                      \
    ts_runtime.c                   \
    ts_std.c                       \
    ts_std_console.c               \
    ts_std_timer.c                 \
    ts_std_promise.c               \
    ts_exception.cpp               \
    ts_package.c                   \
    ts_std_date.c                  \
    test/ts_built_in_modules.c     \
    test/test_class2_manual.c      \
    test/test_async_await_manual.c \
    test/test_class1_manual.c      \
    test/test_class2_manual.c      \
    test/test_function1_manual.c   \
    test/test_function2_manual.c   \
    test/test_hello_manual.c       \
    test/test_interface1_manual.c  \
    test/test_interface2_manual.c  \
    test/test_promise1_manual.c    \
    test/test_timeout_manual.c     \
    test/test_trycatch_manual.cpp  \
    test/test_union1_manual.c

#运行make wasm之前，采用wasi-sdk19版本，在环境变量中指定export CC="${WASI_SDK_PATH}/bin/clang --sysroot=${WASI_SDK_PATH}/share/wasi-sysroot"
wasm: $(runtime_srcs)
	$(CC) -fpermissive -I. -o tsshell.wasm $^ -Wl,--strip-all -Wl,--export=jmpCallbackExp -Wl,--export=jmpCallbackTry -Wl,--export=__main_argc_argv -Wl,--allow-undefined -DTOWASM

tsshell: $(runtime_objs)
	$(CC) -o $@ $^ $(RT_LDFLAGS) -ldl -lm

libtest_%.so: test/test_%_manual.o
	$(CC) -fPIC -shared -o $@ $^ $(RT_LDFLAGS)

%.o:%.c
	$(CC) -c -o $@ $< $(RT_CFLAGS)

test/%.o:test/%.c
	$(CC) -fPIC -c -o $@ $< $(RT_CFLAGS)

clean:
	rm -f *.o tsshell tsshell_vela *.so test/test_*.o

run_tests:tsshell $(test_module_targets)
	$(run_test_modules) echo "============ END =============="
