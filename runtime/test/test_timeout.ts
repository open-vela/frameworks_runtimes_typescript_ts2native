import {_int, _int64} from './lang';

let count: _int = 10;

function test_timeout(n: _int) {
  if (n >= count)
    return;

  console.log(`==== n: ${n}`);
  setTimeout(test_timeout, 500, n+1);
}

console.log("=== start timeout");
test_timeout(0);

let interval: _int = 0;
let intervalId: _int64 = 0;
function test_interval() {
  if (interval >= count) {
    clearInterval(intervalId);
    return;
  }

  console.log(` intervalId ==== n: ${interval}`);
  interval = interval+1;
}
intervalId = setInterval(test_interval, 1000);
