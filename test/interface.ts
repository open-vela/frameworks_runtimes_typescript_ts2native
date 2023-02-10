interface Foo {
  a: number;
  say() : void;
}

interface Callback {
  (a: number):string;
}

interface Constructor {
  new (a: number): Foo;
}

interface Goo extends Foo, Callback {
}

