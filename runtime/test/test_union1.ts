
class Foo {
  a: number;
  b: number;

  constructor(a: number, b: number) {
    this.a = a;
    this.b = b;
  }

  say() : void {
    console.log(`Foo say: a: ${this.a}, b: ${this.b}`);
  }
};

class Goo {
  c: boolean;
  say(): void {
    console.log(`Goo say: a: ${this.a}, c: ${this.c}`);
  }
  a: number;

  constructor(a: number, c: boolean) {
    this.a = a;
    this.c = c;
  }
};

function test(v: Foo|Goo) {
  console.log(`test a: ${v.a}`);
  v.say();
}

test(new Foo(10, 20));
test(new Goo(200, true));
