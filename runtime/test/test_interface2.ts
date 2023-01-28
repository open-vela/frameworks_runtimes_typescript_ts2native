
interface Flyable {
  say() : void;
  fly() : void;
};

interface Swimming {
  say()  : void; 
  swim() : void;
}

class Swan implements Flyable, Swimming {
  say() {
    console.log("honk! honk!");
  }

  fly() {
    console.log("I'm swan, I have wings, I can fly!");
  }

  swim() {
    console.log("I'm swan, I have feet with webbed toes, I can swim!");
  }
}

let swan = new Swan();
let flyable: Flyable = swan;
let swimming: Swimming = swan;
flyable.say();
flyable.fly();

swimming.say();
swimming.swim();
