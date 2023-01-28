
import {_int} from './lang';

class Person {
  name: string;
  age:  _int; 

  constructor(name: string, age: _int) {
    this.name = name;
    this.age = age;
  }

  say() {
    console.log(`hello my name is ${this.name}, I'm ${this.age} old`);
  }
}

let tom = new Person('tom', 10);
let jerry = new Person('jerry', 8);

tom.say();
jerry.say();
