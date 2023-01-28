
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

class Teacher extends Person {
  course: string;

  constructor(name: string, age: _int, course: string) {
    super(name, age);
    this.course = course;
  }

  say() {
    super.say();
    console.log(`I teach ${this.course}`);
  }
}

class Student extends Person {
  grade: _int;

  constructor(name, string, age: _int, grade: _int) {
    super(name, age);
    this.grade = grade;
  }

  say() {
    super.say();
    console.log(`I'm in grade ${this.grade}`);
  }
}

let tom = new Teacher('tom', 30, 'math');
let jerry = new Student('jerry', 8, 3);

tom.say();
jerry.say();
