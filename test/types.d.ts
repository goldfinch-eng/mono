declare namespace Chai {
  interface Assertion {
    bignumber: BigNumberAssertion
  }

  type BigNumberAssertion = Omit<Assertion, "closeTo" | "gt" | "lt"> & {
    closeTo: BigNumberCloseTo
    gt: BigNumberCompare
    lt: BigNumberCompare
  }

  interface BigNumberCloseTo {
    (expected: BN | string, delta: BN | string, message?: string): Assertion
  }

  interface BigNumberCompare {
    (value: BN | number, message?: string): Assertion
  }
}
