declare namespace foo {

class Person {
    protected name: string;
    constructor(name: string);
}
class Employee extends Person {
    private department;
    constructor(name: string, department: string);
    get ElevatorPitch(): string;
}
function foo(a: number, b:string, c:boolean): void;
}

declare namespace foo {
  const haword : Employee;
  const size: number;
  let age: number; 

  interface Company {
    getEmployeeCount(): number;
    isEmployee(name: string): boolean;

    set name(name: string);
    get name() : string;
  }

  interface SearchFunc {
    (a: number, b: number) : boolean;
  }

  interface NewCompay {
    new (a: number, b: string) : Company;
  }
}

export = foo;
