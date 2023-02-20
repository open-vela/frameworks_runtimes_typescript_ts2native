# use the gen source

```
npm run build
node out/index.js test/hello.ts out
gcc -fPIC -shared -Iruntime -o libhello.so out/hello.c
./runtime/tsshell hello
```
