const resolver = (msg, timeout) => new Promise((resolve) => {
    console.log(msg);
    setTimeout(resolve, timeout);
});
/*resolver('First', 500)
    .then(() => resolver('Second', 500))
    .then(() => resolver('Third', 1000))
    .then(() => resolver('Fourth', 500));
   */

async function run() {
  let a = 1;
  console.log("==1");
  await resolver(a ++, 500);
  console.log("==2");
  await resolver(a ++, 500);
  console.log("==3");
  await resolver(a ++, 500);
  console.log("==4");
  await resolver(a ++, 500);
  console.log("==5");
  await resolver(a ++, 500);
  console.log("==6");
  await resolver(a ++, 500);
  console.log("==7");
}

run();
