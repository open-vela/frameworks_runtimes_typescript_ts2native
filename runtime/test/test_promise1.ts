const myPromise = new Promise((resolve, reject) => {
  console.log("==== create myPromise");
  setTimeout(() => {
    resolve("foo");
  }, 300);
});

console.log("==== myPromise created!");
myPromise
  .then((value) => `${value} and bar`)
  .then((value) => `${value} and bar again`)
  .then((value) => `${value} and again`)
  .then((value) => `${value} and again`)
  .then((value) => {
    console.log(value);
  })
  .catch((err) => {
    console.error(err);
  });
