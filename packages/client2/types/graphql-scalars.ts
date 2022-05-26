import { BigNumber, FixedNumber } from "ethers";

declare global {
  export type TheGraph_BigInt = BigNumber;
  export type TheGraph_BigDecimal = FixedNumber;
}
