import { BigNumber, FixedNumber } from "ethers";

import { SupportedCrypto } from "@/lib/graphql/generated";

// These types must be defined globally so that the generated GraphQL types (located in lib/graphql/generated) have them in scope. Otherwise that file will fail TypeScript validation.
declare global {
  export type TheGraph_BigInt = BigNumber;
  export type TheGraph_BigDecimal = FixedNumber;
  export type CryptoAmount<T extends SupportedCrypto = SupportedCrypto> = {
    token: T;
    amount: BigNumber;
  };
}
