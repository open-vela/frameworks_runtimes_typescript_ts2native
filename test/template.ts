
function foo<T> (v: T) : T { return v; }

interface Foo {
  a: number;
}

interface Goo<T, V extends Foo> {
   f: V;
   a: T;
};


foo(10);

let a = 100;

let x : Goo<number, Foo> = {
  f : { a: 10 },
  a : a
}

