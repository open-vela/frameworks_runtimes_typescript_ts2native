type int = number;

interface Foo {}
interface Goo {}

type A = Foo | Goo;
type B = Foo & Goo;

