# "tswasm-lib" introduction
将该目录拷贝到wamr1.1.2/samples目录下

mkdir build && cd build

cmake ..

make

编译出结果iwasm,libiwasm.so以及libts_wasm.so

 运行

 ./iwasm --native-lib=./libts_wasm.so /xxx/tsshell.wasm test_trycatch
 
 即可看到执行结果




