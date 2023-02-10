function foo(a: number) {
  return function (b: string) {
    return function (c: boolean) {
      console.log(a, b, c)
    }
  }
}

