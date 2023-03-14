interface Foo {
  a: number;
  b: string;

  say() : void;
}


let foo: Foo = {
  a: 20,
  b: "hello",
  say() : void {
    console.log(`say: ${this.a}, ${this.b}`);
  }
}

foo.say();
