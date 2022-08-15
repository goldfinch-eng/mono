import { gql } from "@apollo/client";
import { BigNumber, FixedNumber, utils } from "ethers";

import { IconNameType } from "@/components/design-system";
import { FIDU_DECIMALS, USDC_DECIMALS } from "@/constants";
import { API_BASE_URL } from "@/constants";
import {
  SupportedCrypto,
  TranchedPoolStatusFieldsFragment,
  UserEligibilityFieldsFragment,
  UidType,
  TransactionCategory,
} from "@/lib/graphql/generated";
import { Erc20 } from "@/types/ethers-contracts";

import { toastTransaction } from "../toast";

/**
 * Include this graphQL fragment on a query for TranchedPool to ensure it has the correct fields for computing PoolStatus
 */
export const TRANCHED_POOL_STATUS_FIELDS = gql`
  fragment TranchedPoolStatusFields on TranchedPool {
    id
    isPaused
    remainingCapacity
    fundableAt
    creditLine {
      id
      balance
      termEndTime
    }
  }
`;

export enum PoolStatus {
  Paused,
  Repaid,
  Full,
  ComingSoon,
  Open,
}

/**
 * Get the current status of the tranched pool
 * @param pool TranchedPool to get the status for. Use the TranchedPoolStatusFields fragment to guarantee your query has the right fields for this computation.
 * @returns the status of the pool
 */
export function getTranchedPoolStatus(pool: TranchedPoolStatusFieldsFragment) {
  if (pool.isPaused) {
    return PoolStatus.Paused;
  } else if (
    pool.creditLine.balance.isZero() &&
    pool.creditLine.termEndTime.gt(0)
  ) {
    return PoolStatus.Repaid;
  } else if (pool.remainingCapacity.isZero()) {
    return PoolStatus.Full;
  } else if (
    pool.creditLine.termEndTime.isZero() &&
    Date.now() / 1000 < parseInt(pool.fundableAt.toString())
  ) {
    return PoolStatus.ComingSoon;
  } else {
    return PoolStatus.Open;
  }
}

export function computeApyFromGfiInFiat(
  apyFromGfiRaw: FixedNumber,
  fiatPerGfi: number
): FixedNumber {
  return apyFromGfiRaw.mulUnsafe(FixedNumber.fromString(fiatPerGfi.toString()));
}

const usdcMantissa = BigNumber.from(10).pow(USDC_DECIMALS);
const fiduMantissa = BigNumber.from(10).pow(FIDU_DECIMALS);
const sharePriceMantissa = fiduMantissa;

/**
 * A utility function for converting senior pool shares to a USDC amount
 * @param numShares Number of shares. This could be staked or unstaked FIDU balance, for example.
 * @param sharePrice `sharePrice` as it is reported from the Senior Pool contract
 * @returns a `CryptoAmount` in USDC
 */
export function sharesToUsdc(numShares: BigNumber, sharePrice: BigNumber) {
  const amount = numShares
    .mul(sharePrice)
    .div(fiduMantissa)
    .div(sharePriceMantissa.div(usdcMantissa));
  return { token: SupportedCrypto.Usdc, amount };
}

/**
 * A utility function for converting an amount of USDC to an amount of FIDU in the senior pool.
 * @param usdcAmount USDC amount
 * @param sharePrice `sharePrice` as it reported from the Senior Pool contract
 * @returns a `CryptoAmount` in FIDU
 */
export function usdcToShares(usdcAmount: BigNumber, sharePrice: BigNumber) {
  const numShares = usdcAmount
    .mul(fiduMantissa)
    .div(usdcMantissa)
    .mul(sharePriceMantissa)
    .div(sharePrice);
  return { token: SupportedCrypto.Fidu, amount: numShares };
}

export const USER_ELIGIBILITY_FIELDS = gql`
  fragment UserEligibilityFields on User {
    id
    isUsEntity
    isNonUsEntity
    isUsAccreditedIndividual
    isUsNonAccreditedIndividual
    isNonUsIndividual
    isGoListed
  }
`;

export function canUserParticipateInPool(
  poolAllowedUids: UidType[],
  user: UserEligibilityFieldsFragment
): boolean {
  if (user.isGoListed) {
    return true;
  }
  if (
    user.isNonUsIndividual &&
    poolAllowedUids.includes(UidType.NonUsIndividual)
  ) {
    return true;
  }
  if (
    user.isUsAccreditedIndividual &&
    poolAllowedUids.includes(UidType.UsAccreditedIndividual)
  ) {
    return true;
  }
  if (
    user.isUsNonAccreditedIndividual &&
    poolAllowedUids.includes(UidType.UsNonAccreditedIndividual)
  ) {
    return true;
  }
  if (user.isUsEntity && poolAllowedUids.includes(UidType.UsEntity)) {
    return true;
  }
  if (user.isNonUsEntity && poolAllowedUids.includes(UidType.NonUsEntity)) {
    return true;
  }
  return false;
}

export async function signAgreement(
  account: string,
  fullName: string,
  pool: string
) {
  try {
    const response = await fetch(`${API_BASE_URL}/signAgreement`, {
      method: "POST",
      headers: {
        "x-goldfinch-address": account,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ fullName, pool }),
    });
    if (!response.ok) {
      const responseBody = await response.json();
      throw new Error(`Unable to sign agreement. ${responseBody.error}`);
    }
  } catch (e) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        `Could not sign agreement for pool. Message: ${
          (e as Error).message
        }. Ignoring this because it's not production.`
      );
    } else {
      throw e;
    }
  }
}

/**
 * A utility function that tells you if n1 is within one epsilon of n2. This means that the n1 is "reasonably close" to n2. "Reasonably close" is relative to USDC amounts.
 * For use in sticky situations where the user has to enter an imprecise amount.
 * @param n1
 * @param n2
 */
export function usdcWithinEpsilon(n1: BigNumber, n2: BigNumber): boolean {
  const epsilon = utils.parseUnits("1", 4);
  return n2.sub(epsilon).lte(n1) && n1.lte(n2.add(epsilon));
}

/**
 * Utility function that will perform an ERC20 approval if it's necessary, and will toast messages for this approval too.
 */
export async function approveErc20IfRequired({
  account,
  spender,
  amount,
  erc20Contract,
}: {
  account: string;
  spender: string;
  amount: BigNumber;
  erc20Contract: Erc20;
}) {
  const allowance = await erc20Contract.allowance(account, spender);
  const isApprovalRequired = allowance.lt(amount);
  if (isApprovalRequired) {
    await toastTransaction({
      transaction: erc20Contract.approve(spender, amount),
      pendingPrompt: "Awaiting approval to spend tokens.",
      successPrompt: "Successfully approved spending.",
      errorPrompt: "Failed to approved spending",
    });
  }
}

const transactionLabels: Record<TransactionCategory, string> = {
  [TransactionCategory.SeniorPoolStake]: "Senior Pool Stake",
  [TransactionCategory.SeniorPoolDeposit]: "Senior Pool Supply",
  [TransactionCategory.SeniorPoolDepositAndStake]:
    "Senior Pool Supply and Stake",
  [TransactionCategory.SeniorPoolUnstake]: "Senior Pool Unstake",
  [TransactionCategory.SeniorPoolWithdrawal]: "Senior Pool Withdrawal",
  [TransactionCategory.SeniorPoolUnstakeAndWithdrawal]:
    "Senior Pool Unstake and Withdraw",
  [TransactionCategory.SeniorPoolRedemption]: "Senior Pool Auto Transfer",
  [TransactionCategory.TranchedPoolDeposit]: "Borrower Pool Supply",
  [TransactionCategory.TranchedPoolWithdrawal]: "Borrower Pool Withdrawal",
  [TransactionCategory.TranchedPoolRepayment]: "Repayment",
  [TransactionCategory.TranchedPoolDrawdown]: "Drawdown",
  [TransactionCategory.UidMinted]: "Mint UID",
};

export function getTransactionLabel(transaction: {
  category: TransactionCategory;
}): string {
  return transactionLabels[transaction.category];
}

const shortTransactionLabels: Record<TransactionCategory, string> = {
  [TransactionCategory.SeniorPoolStake]: "Stake",
  [TransactionCategory.SeniorPoolDeposit]: "Supply",
  [TransactionCategory.SeniorPoolDepositAndStake]: "Supply and Stake",
  [TransactionCategory.SeniorPoolUnstake]: "Unstake",
  [TransactionCategory.SeniorPoolWithdrawal]: "Withdrawal",
  [TransactionCategory.SeniorPoolUnstakeAndWithdrawal]: "Unstake and Withdraw",
  [TransactionCategory.SeniorPoolRedemption]: "Auto Transfer",
  [TransactionCategory.TranchedPoolDeposit]: "Supply",
  [TransactionCategory.TranchedPoolWithdrawal]: "Withdrawal",
  [TransactionCategory.TranchedPoolRepayment]: "Repayment",
  [TransactionCategory.TranchedPoolDrawdown]: "Drawdown",
  [TransactionCategory.UidMinted]: "Mint UID",
};

/**
 * Less descriptive but more brief than regular getTransactionLabel(). Use this only when it's appropriate in context.
 * @param transaction Transaction object
 * @returns Short label describing the transaction
 */
export function getShortTransactionLabel(transaction: {
  category: TransactionCategory;
}): string {
  return shortTransactionLabels[transaction.category];
}

const transactionIcons: Record<TransactionCategory, IconNameType> = {
  [TransactionCategory.SeniorPoolStake]: "ArrowUpCircle",
  [TransactionCategory.SeniorPoolDeposit]: "ArrowUpCircle",
  [TransactionCategory.SeniorPoolDepositAndStake]: "ArrowUpCircle",
  [TransactionCategory.SeniorPoolUnstake]: "ArrowDownCircle",
  [TransactionCategory.SeniorPoolWithdrawal]: "ArrowDownCircle",
  [TransactionCategory.SeniorPoolUnstakeAndWithdrawal]: "ArrowDownCircle",
  [TransactionCategory.SeniorPoolRedemption]: "ArrowDownCircle",
  [TransactionCategory.TranchedPoolDeposit]: "ArrowUpCircle",
  [TransactionCategory.TranchedPoolWithdrawal]: "ArrowDownCircle",
  [TransactionCategory.TranchedPoolRepayment]: "ArrowUpCircle",
  [TransactionCategory.TranchedPoolDrawdown]: "ArrowDownCircle",
  [TransactionCategory.UidMinted]: "CheckmarkCircle",
};

/**
 * Returns the icon for the transaction category
 * @param transaction Transaction object
 * @returns Icon to use for the transaction
 */
export function getTransactionIcon(transaction: {
  category: TransactionCategory;
}): IconNameType {
  return transactionIcons[transaction.category];
}
