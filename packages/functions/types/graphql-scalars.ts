import {BigNumber, FixedNumber} from "ethers"

declare global {
  // eslint-disable-next-line
  export type TheGraph_BigInt = BigNumber
  // eslint-disable-next-line
  export type TheGraph_BigDecimal = FixedNumber
}
