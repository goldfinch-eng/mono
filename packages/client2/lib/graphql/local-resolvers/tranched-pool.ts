import { Resolvers } from "@apollo/client";
import { BigNumber } from "ethers";

import { BORROWER_METADATA, POOL_METADATA } from "@/constants";
import { getContract } from "@/lib/contracts";
import { getProvider } from "@/lib/wallet";

import { TranchedPool } from "../generated";
import {
  collectedPaymentBalance,
  interestOwed,
  isAfterTermEndTime,
  isInDefault,
  isLate,
} from "./credit-line";

export const tranchedPoolResolvers: Resolvers[string] = {
  name(tranchedPool: TranchedPool) {
    return (
      POOL_METADATA[tranchedPool.id as keyof typeof POOL_METADATA]?.name ??
      `Pool ${tranchedPool.id}`
    );
  },
  borrowerName(tranchedPool: TranchedPool) {
    const borrowerId =
      POOL_METADATA[tranchedPool.id as keyof typeof POOL_METADATA]?.borrower;
    if (borrowerId) {
      const borrower =
        BORROWER_METADATA[borrowerId as keyof typeof BORROWER_METADATA];
      if (borrower) {
        return borrower.name;
      }
    }
    return "Borrower";
  },
  borrowerLogo(tranchedPool: TranchedPool) {
    const borrowerId =
      POOL_METADATA[tranchedPool.id as keyof typeof POOL_METADATA]?.borrower;
    if (borrowerId) {
      const borrower =
        BORROWER_METADATA[borrowerId as keyof typeof BORROWER_METADATA];
      if (borrower) {
        return borrower.logo;
      }
    }
    return null;
  },
  async isLate(tranchedPool: TranchedPool): Promise<boolean> {
    // Small optimization if tranchedPool.creditLine is already present in cache
    let creditLineAddress = tranchedPool?.creditLineAddress;
    if (creditLineAddress) {
      return isLate(creditLineAddress);
    }
    const provider = await getProvider();
    const tranchedPoolContract = await getContract({
      name: "TranchedPool",
      provider,
      useSigner: false,
      address: tranchedPool.id,
    });
    creditLineAddress = await tranchedPoolContract.creditLine();
    return isLate(creditLineAddress);
  },
  async collectedPaymentBalance(
    tranchedPool: TranchedPool
  ): Promise<BigNumber> {
    // Small optimization if tranchedPool.creditLine is already present in cache
    let creditLineAddress = tranchedPool?.creditLineAddress;
    if (creditLineAddress) {
      return collectedPaymentBalance(creditLineAddress);
    }
    const provider = await getProvider();
    const tranchedPoolContract = await getContract({
      name: "TranchedPool",
      provider,
      useSigner: false,
      address: tranchedPool.id,
    });
    creditLineAddress = await tranchedPoolContract.creditLine();
    return collectedPaymentBalance(creditLineAddress);
  },
  async isInDefault(tranchedPool: TranchedPool): Promise<boolean> {
    // Small optimization if tranchedPool.creditLine is already present in cache
    let creditLineAddress = tranchedPool?.creditLineAddress;
    if (creditLineAddress) {
      return isInDefault(creditLineAddress);
    }
    const provider = await getProvider();
    const tranchedPoolContract = await getContract({
      name: "TranchedPool",
      provider,
      useSigner: false,
      address: tranchedPool.id,
    });
    creditLineAddress = await tranchedPoolContract.creditLine();
    return isInDefault(creditLineAddress);
  },
  async isAfterTermEndTime(tranchedPool: TranchedPool): Promise<boolean> {
    // Small optimization if tranchedPool.creditLine is already present in cache
    let creditLineAddress = tranchedPool?.creditLineAddress;
    if (creditLineAddress) {
      return isAfterTermEndTime(creditLineAddress);
    }
    const provider = await getProvider();
    const tranchedPoolContract = await getContract({
      name: "TranchedPool",
      provider,
      useSigner: false,
      address: tranchedPool.id,
    });
    creditLineAddress = await tranchedPoolContract.creditLine();
    return isAfterTermEndTime(creditLineAddress);
  },
  async interestOwed(tranchedPool: TranchedPool): Promise<BigNumber> {
    // Small optimization if tranchedPool.creditLine is already present in cache
    let creditLineAddress = tranchedPool?.creditLineAddress;
    if (creditLineAddress) {
      return interestOwed(creditLineAddress);
    }
    const provider = await getProvider();
    const tranchedPoolContract = await getContract({
      name: "TranchedPool",
      provider,
      useSigner: false,
      address: tranchedPool.id,
    });
    creditLineAddress = await tranchedPoolContract.creditLine();
    return interestOwed(creditLineAddress);
  },
};
