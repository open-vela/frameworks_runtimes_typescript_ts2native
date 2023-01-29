import {_int} from './lang';

let count: _int = 10;

function test_timeout(n: _int) {
  if (n >= count)
    return;

  console.log(`==== n: ${n}`);
  setTimeout(test_timeout, 500, n+1);
}

console.log("=== start timeout");
test_timeout(0);
