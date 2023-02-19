class Foo {
  a: number;
  constructor(a: number) {
    this.a = a;
  }
  say() { console.log("foo", this.a) }
}

let foo = new Foo(100);
foo.say();
