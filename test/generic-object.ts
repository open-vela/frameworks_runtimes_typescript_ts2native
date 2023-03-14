let obj = {
  a: 10,
  b: "hello",
  say() { console.log(this.a, this.b); }
}

obj.say();

obj.a = 20;
obj.b = "world";
obj.say();

obj.c = true;
console.log(obj.c);

console.log(obj);
