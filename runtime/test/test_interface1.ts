
interface Flyable {
  fly() : void;
};

interface Swimming {
  swim() : void;
}

class Swan implements Flyable, Swimming {
  fly() {
    console.log("I'm swan, I have wings, I can fly!");
  }

  swim() {
    console.log("I'm swan, I have feet with webbed toes, I can swim!");
  }
}


let swan = new Swan();
let flyable: Flyable = swan;
let swiming: Swimming = swan;
flyable.fly();
swiming.swim();
