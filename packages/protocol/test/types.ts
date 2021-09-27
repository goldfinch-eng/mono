// eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-namespace
declare namespace Chai {
  export interface Assertion {
    bignumber: BigNumberAssertion
  }

  export type BigNumberAssertion = Omit<Assertion, "closeTo" | "gt" | "lt"> & {
    closeTo: BigNumberCloseTo
    gt: BigNumberCompare
    lt: BigNumberCompare
  }

  export interface BigNumberCloseTo {
    (expected: BN | string, delta: BN | string, message?: string): Assertion
  }

  export interface BigNumberCompare {
    (value: BN | number, message?: string): Assertion
  }
}
