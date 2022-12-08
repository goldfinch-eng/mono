import { BigNumber, FixedNumber } from "ethers";

import { SupportedCrypto } from "@/lib/graphql/generated";

declare global {
  export type TheGraph_BigInt = BigNumber;
  export type TheGraph_BigDecimal = FixedNumber;
  export type CryptoAmount = { token: SupportedCrypto; amount: BigNumber };
}
