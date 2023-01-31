# runtime
这是TS的运行时.

test目录下, 以 *_manual.c结尾的文件, 都是对应的ts代码, 手写成C代码的结果.
手写成C代码的目的, 是为了说明TS AOT编译器应该生成什么样的代码和结构.

## 编译
```
make
```
## 运行

### 运行全部test
```
make run_tests
```

### 运行单个例子
./tsshell <module_name>
如
```
./tsshell test_hello
./tsshell test_class1
```
参数是模块名. 现在, 用最简单的方法, 将模块名拼接为 `./lib<module_name>.so` 来加载.
