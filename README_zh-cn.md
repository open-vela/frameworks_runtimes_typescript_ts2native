# 介绍

[简体中文|[English](./README.md)]

openvela 中用于将 TypeScript 转化为 native 代码的框架。

## 项目结构

```tree
├── lib
│   └── std.d.ts
├── package.json
├── README.md
├── README_zh-cn.md
├── src
│   ├── compiler.ts
│   ├── cwriter.ts
│   ├── debug.ts
│   ├── index.ts
│   └── resolver.ts
├── test
│   ├── any.ts
│   ├── array.ts
│   ├── binaryops.ts
│   ├── class.d.ts
│   ├── class.ts
│   ├── closure.ts
│   ├── console.ts
│   ├── enum.ts
│   ├── for.ts
│   ├── func.ts
│   ├── generic-object.ts
│   ├── hello.ts
│   ├── if.ts
│   ├── interface1.ts
│   ├── interface.ts
│   ├── literal_object.ts
│   ├── map.ts
│   ├── out
│   │   └── foo_native.cc
│   ├── primitive.ts
│   ├── set.ts
│   ├── t.d.ts
│   ├── template.ts
│   ├── test.ts
│   ├── tuple.ts
│   ├── types.ts
│   └── while.ts
└── tsconfig.json
```

* `src`: 项目核心代码。
* `test`: 一些常用的测试程序，用于测试 TypeScript 转为 native 后性能和内存的变化。

## 使用

### 项目编译

```
npm run build
```

### 将Hello转换为native的方式

```
gcc -fPIC -shared -I<runtime-path> -o libhello.so out/hello.c
./runtime/tsshell hello
```
