
function add(a: number, b: number) : number {
  let c = a + b;
  c *= 3;
  return c;
}

let a: number = 10;
let b: number = 20;
let c: number = 50;

a = 20;

class Foo {
  say() { console.log("say foo"); }
}

interface Bar {
  say() { console.log("say bar"); }
}


c = a + b * 3 - a / 4;

add(10, 20);
c = add(20, 30);

let f = new Foo();
f.say();

let bar = f;
bar.say();

getFoo().say();

function getFoo() : Foo { return new Foo(); }

if (c > 10) {
  console.log("c>10");
} else {
  console.log("c<=10");
}

let arr = [1, 2, 3, 4];

for (const e of arr) {
  console.log(e);
}

