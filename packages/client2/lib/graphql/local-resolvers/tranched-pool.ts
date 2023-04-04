import { Resolvers } from "@apollo/client";
import { getProvider } from "@wagmi/core";
import { BigNumber } from "ethers";

import { BORROWER_METADATA, POOL_METADATA } from "@/constants";
import { getContract2 } from "@/lib/contracts";

import { LoanDelinquency, TranchedPool } from "../generated";
import {
  collectedPaymentBalance,
  interestOwed,
  isAfterTermEndTime,
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
  async collectedPaymentBalance(
    tranchedPool: TranchedPool
  ): Promise<BigNumber> {
    // Small optimization if tranchedPool.creditLine is already present in cache
    let creditLineAddress = tranchedPool?.creditLineAddress;
    if (creditLineAddress) {
      return collectedPaymentBalance(creditLineAddress);
    }
    const tranchedPoolContract = await getContract2({
      name: "TranchedPool",
      address: tranchedPool.id,
    });
    creditLineAddress = await tranchedPoolContract.creditLine();
    return collectedPaymentBalance(creditLineAddress);
  },
  async delinquency(tranchedPool: TranchedPool): Promise<LoanDelinquency> {
    const secondsPerDay = 60 * 60 * 24;
    const provider = getProvider();
    const tranchedPoolContract = await getContract2({
      name: "TranchedPool",
      address: tranchedPool.id,
    });
    const goldfinchConfigContract = await getContract2({
      name: "GoldfinchConfig",
      address: await tranchedPoolContract.config(),
    });
    const creditLineContract = await getContract2({
      name: "CreditLine",
      address: await tranchedPoolContract.creditLine(),
    });
    const [currentBlock, gracePeriodInDays, lastFullPaymentTime] =
      await Promise.all([
        provider.getBlock("latest"),
        goldfinchConfigContract.getNumber(5),
        creditLineContract.lastFullPaymentTime(),
      ]);

    let isLate = false;
    // Need to handle old creditLines that don't implement .isLate()
    try {
      isLate = await creditLineContract.isLate();
    } catch (e) {
      const paymentPeriodInDays = 30; // This is lazy, but all old CreditLines that don't have `isLate()` implemented have 30 day payment periods
      isLate =
        currentBlock.timestamp >
        lastFullPaymentTime.toNumber() + paymentPeriodInDays * secondsPerDay;
    }
    const gracePeriodInSeconds = gracePeriodInDays.toNumber() * secondsPerDay;
    let isPostBpi = true;
    try {
      await tranchedPoolContract.getVersion();
    } catch (e) {
      // getVersion() doesn't exist on pre-BPI tranched pools
      isPostBpi = false;
    }
    if (!isPostBpi) {
      if (!isLate) {
        return "CURRENT";
      } else if (
        currentBlock.timestamp <
        lastFullPaymentTime.toNumber() + gracePeriodInSeconds
      ) {
        return "GRACE_PERIOD";
      } else {
        return "LATE";
      }
    } else {
      const oldestUnpaidDueTime = await creditLineContract.nextDueTimeAt(
        lastFullPaymentTime
      );
      if (!isLate) {
        return "CURRENT";
      } else if (
        currentBlock.timestamp <
        oldestUnpaidDueTime.toNumber() + gracePeriodInSeconds
      ) {
        return "GRACE_PERIOD";
      } else {
        return "LATE";
      }
    }
  },
  async isAfterTermEndTime(tranchedPool: TranchedPool): Promise<boolean> {
    // Small optimization if tranchedPool.creditLine is already present in cache
    let creditLineAddress = tranchedPool?.creditLineAddress;
    if (creditLineAddress) {
      return isAfterTermEndTime(creditLineAddress);
    }
    const tranchedPoolContract = await getContract2({
      name: "TranchedPool",
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
    const tranchedPoolContract = await getContract2({
      name: "TranchedPool",
      address: tranchedPool.id,
    });
    creditLineAddress = await tranchedPoolContract.creditLine();
    return interestOwed(creditLineAddress);
  },
};
