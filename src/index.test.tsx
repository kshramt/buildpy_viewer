import { sum, cumsum, multinomial } from "./index";

it("sum", () => {
  expect(sum([1, 2, 3])).toEqual(6);
});

it("cumsum", () => {
  expect(cumsum([1, 2, 3])).toEqual([0, 1, 3, 6]);
});

it("multinomial", () => {
  {
    const rng = multinomial([9, 8, 7], [1, 2, 3]);
    const ns = [];
    for (let i = 0; i < 100000; i++) {
      ns.push(rng.next().value);
    }
    const _9 = ns.filter(x => x === 9);
    const _8 = ns.filter(x => x === 8);
    const _7 = ns.filter(x => x === 7);
    expect(
      1.95 <= _8.length / _9.length && _8.length / _9.length <= 2.05,
    ).toBeTruthy();
    expect(
      2.95 <= _7.length / _9.length && _7.length / _9.length <= 3.05,
    ).toBeTruthy();
  }
  {
    const rng = multinomial([9], [1]);
    for (let i = 0; i < 10; i++) {
      expect(rng.next().value).toEqual(9);
    }
  }
  {
    const rng = multinomial([9, 8], [1, 1]);
    const ns = [];
    for (let i = 0; i < 100000; i++) {
      ns.push(rng.next().value);
    }
    const _9 = ns.filter(x => x === 9);
    const _8 = ns.filter(x => x === 8);
    expect(
      0.95 <= _8.length / _9.length && _8.length / _9.length <= 1.05,
    ).toBeTruthy();
  }
});
