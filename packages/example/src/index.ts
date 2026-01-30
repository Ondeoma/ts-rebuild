import typia from "typia";

function generics$macro$<T>(value: unknown): value is T {
  return typia.is<T>(value);
}

const value = {
  a: 1,
  b: "str",
};
type Obj = {
  a: number;
  b: string;
};

console.log(generics$macro$<Obj>(value));
console.log(generics$macro$<Obj>(false));
console.log(generics$macro$<boolean>(value));
