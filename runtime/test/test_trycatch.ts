
function inner_func() {
  try {
   console.log("=== inner do something ==");
   throw "inner fatal error";
  } catch(e) {
    console.log("inner error = ", e);
    throw "from inner func error";
  } finally {
    console.log("== inner finally ==");
  }
}


function outter_func() {
  try {
   console.log("=== outter do ====");
   inner_func();
  } catch(e) {
    console.log("=== outter catch == ");
    console.log(e);
  } finally {
    console.log("=== outter finally");
  }
}

outter_func();
