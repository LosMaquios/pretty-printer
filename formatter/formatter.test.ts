import { assert } from "../dev_deps.ts";
import { Formatter } from "./formatter.ts";

Deno.test("should print correctly", () => {
  const formatter = new Formatter({
    indentRoot: false,
    circularId: true,
  });

  class ExtendedSet extends Set {}

  const extendedSet = new ExtendedSet([
    `
test
`,
    "set",
    function a() {
      console.log("B");
    },
    {
      get a() {
        return 1;
      },
    },
  ]);

  extendedSet.add({
    quack: extendedSet,
  });

  console.log(
    Deno.inspect(extendedSet, {
      colors: true,
      getters: true,
    }),
  );

  const test = {
    regex: /a+/gi,
    extendedSet,
    infi: Infinity,
    map: new Map([["hi", ["a", "b"]]]),
    set: new Set([
      {
        key: "value",
        date: new Date(),
      },
    ]),
    arrayLike: {
      0: "Hi",
      length: 1,
    },
    fn: function b() {
      console.log("a");

      if (typeof (window as any).b !== "string") {
        return function c() {
          console.log("c");
        };
      }
    },
    [
      `d
    `
    ]: "a",
    a: "test",
    e2: extendedSet,
  };

  console.log(`\`\n${formatter.format(test)}\n\``);

  assert(true);
});
