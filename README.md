# Introduction

[English|[简体中文](./README_zh-cn.md)]

A framework in openvela for converting TypeScript to native code.

## Project Structure

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

* `src`: Core project code.
* `test`: Common test programs used to test the performance and memory changes after converting TypeScript to native code.

## Usage

### Project Compilation

```
npm run build
```

### Converting Hello to Native Code

```
gcc -fPIC -shared -I<runtime-path> -o libhello.so out/hello.c
./runtime/tsshell hello
```
