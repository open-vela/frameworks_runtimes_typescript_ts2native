
let name: string = 'Sun Wukong';

function set_new_name(n: string) : void {
  name = n;
}

function show_name() : void {
  console.log(`==== the name is ${name}`);
}

show_name();
set_new_name('Zhu Bajie');
show_name();
