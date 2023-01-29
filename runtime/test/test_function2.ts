// closure
import {_int} from './lang';

function foo(value: _int) {
  return function(a: _int) {
    return a + value;
  }
}

let f = foo(10);

console.log(f(20));
console.log(f(30));
