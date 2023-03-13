import { gql } from "@apollo/client";
import { BigNumber, FixedNumber, utils } from "ethers";

import { IconNameType } from "@/components/design-system";
import {
  FIDU_DECIMALS,
  GFI_DECIMALS,
  USDC_DECIMALS,
  USDC_MANTISSA,
} from "@/constants";
import { API_BASE_URL } from "@/constants";
import {
  RepaymentStatusLoanFieldsFragment,
  FundingStatusLoanFieldsFragment,
  UserEligibilityFieldsFragment,
  UidType,
  TransactionCategory,
  StakedPositionType,
  SeniorPoolStakedPosition,
  RepaymentScheduleFieldsFragment,
} from "@/lib/graphql/generated";
import { calculateInterestOwed } from "@/pages/borrow/helpers";
import type { Erc20, Erc721 } from "@/types/ethers-contracts";

import { toastTransaction } from "../toast";

const CAURIS_POOL_ID = "0xd43a4f3041069c6178b99d55295b00d0db955bb5";

export enum LoanRepaymentStatus {
  NotDrawnDown,
  Current,
  Late,
  Default,
  Repaid,
}

/**
 * Include this graphQL fragment on a query for Loan to ensure it has the correct fields for computing LoanRepaymentStatus
 */
export const REPAYMENT_STATUS_LOAN_FIELDS = gql`
  fragment RepaymentStatusLoanFields on Loan {
    id
    balance
    termEndTime
    isLate @client
    isInDefault @client
  }
`;

export function getLoanRepaymentStatus(
  loan: RepaymentStatusLoanFieldsFragment
) {
  if (loan.balance.isZero() && loan.termEndTime.gt(0)) {
    return LoanRepaymentStatus.Repaid;
  } else if (loan.balance.isZero()) {
    return LoanRepaymentStatus.NotDrawnDown;
  } else if (loan.isInDefault) {
    return LoanRepaymentStatus.Default;
  } else if (loan.isLate) {
    return LoanRepaymentStatus.Late;
  } else {
    return LoanRepaymentStatus.Current;
  }
}

const repaymentStatusLabels: Record<LoanRepaymentStatus, string> = {
  [LoanRepaymentStatus.Current]: "On Time",
  [LoanRepaymentStatus.Late]: "Grace Period",
  [LoanRepaymentStatus.Default]: "Default",
  [LoanRepaymentStatus.Repaid]: "Fully Repaid",
  [LoanRepaymentStatus.NotDrawnDown]: "Not Drawn Down",
};

export function getLoanRepaymentStatusLabel(
  repaymentStatus: LoanRepaymentStatus
): string {
  return repaymentStatusLabels[repaymentStatus];
}

export enum LoanFundingStatus {
  ComingSoon,
  Open,
  Closed,
  Full,
  Cancelled,
}

export const FUNDING_STATUS_LOAN_FIELDS = gql`
  fragment FundingStatusLoanFields on Loan {
    id
    remainingCapacity
    fundableAt
    balance
    termEndTime
  }
`;

export function getLoanFundingStatus(loan: FundingStatusLoanFieldsFragment) {
  if (loan.id === CAURIS_POOL_ID) {
    return LoanFundingStatus.Cancelled;
  } else if (!loan.balance.isZero() || !loan.termEndTime.isZero()) {
    return LoanFundingStatus.Closed;
  } else if (loan.termEndTime.isZero() && Date.now() / 1000 < loan.fundableAt) {
    return LoanFundingStatus.ComingSoon;
  } else if (loan.remainingCapacity.isZero()) {
    return LoanFundingStatus.Full;
  } else {
    return LoanFundingStatus.Open;
  }
}

export function computeApyFromGfiInFiat(
  apyFromGfiRaw: FixedNumber,
  fiatPerGfi: number
): FixedNumber {
  return apyFromGfiRaw.mulUnsafe(FixedNumber.fromString(fiatPerGfi.toString()));
}

const fiduMantissa = BigNumber.from(10).pow(FIDU_DECIMALS);
const sharePriceMantissa = fiduMantissa;

/**
 * A utility function for converting senior pool shares to a USDC amount
 * @param numShares Number of shares. This could be staked or unstaked FIDU balance, for example.
 * @param sharePrice `sharePrice` as it is reported from the Senior Pool contract
 * @returns a `CryptoAmount` in USDC
 */
export function sharesToUsdc(
  numShares: BigNumber, // TODO refactor numShares to be typed CryptoAmount<"FIDU">
  sharePrice: BigNumber
): CryptoAmount<"USDC"> {
  const amount = numShares
    .mul(sharePrice)
    .div(fiduMantissa)
    .div(sharePriceMantissa.div(USDC_MANTISSA));

  return { token: "USDC", amount };
}

/**
 * A utility function for converting an amount of USDC to an amount of FIDU in the senior pool.
 * @param usdcAmount USDC amount
 * @param sharePrice `sharePrice` as it reported from the Senior Pool contract
 * @returns a `CryptoAmount` in FIDU
 */
export function usdcToShares(
  usdcAmount: BigNumber, // TODO refactor usdcAmount to be typed CryptoAmount<"USDC">
  sharePrice: BigNumber
): CryptoAmount<"FIDU"> {
  const numShares = usdcAmount
    .mul(fiduMantissa)
    .div(USDC_MANTISSA)
    .mul(sharePriceMantissa)
    .div(sharePrice);
  return { token: "FIDU", amount: numShares };
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
  if (user.isNonUsIndividual && poolAllowedUids.includes("NON_US_INDIVIDUAL")) {
    return true;
  }
  if (
    user.isUsAccreditedIndividual &&
    poolAllowedUids.includes("US_ACCREDITED_INDIVIDUAL")
  ) {
    return true;
  }
  if (
    user.isUsNonAccreditedIndividual &&
    poolAllowedUids.includes("US_NON_ACCREDITED_INDIVIDUAL")
  ) {
    return true;
  }
  if (user.isUsEntity && poolAllowedUids.includes("US_ENTITY")) {
    return true;
  }
  if (user.isNonUsEntity && poolAllowedUids.includes("NON_US_ENTITY")) {
    return true;
  }
  return false;
}

export function canUserParticipateInSeniorPool(
  user: UserEligibilityFieldsFragment
) {
  return canUserParticipateInPool(
    [
      "NON_US_ENTITY",
      "NON_US_INDIVIDUAL",
      "US_ENTITY",
      "US_ACCREDITED_INDIVIDUAL",
    ],
    user
  );
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
      errorPrompt: "Failed to approved spending.",
    });
  }
}

/**
 * utility function that will perform an ERC721 approval if it's necessary, and will toast messages for the approval too. Very similar to approveErc20IfRequired
 */
export async function approveErc721IfRequired({
  to,
  tokenId,
  erc721Contract,
}: {
  to: string;
  tokenId: string;
  erc721Contract: Pick<Erc721, "getApproved" | "approve">;
}) {
  const isApprovalRequired = (await erc721Contract.getApproved(tokenId)) !== to;
  if (isApprovalRequired) {
    await toastTransaction({
      transaction: erc721Contract.approve(to, tokenId),
      pendingPrompt: `Awaiting approval to transfer token ${tokenId}.`,
      successPrompt: `Approved transfer of token ${tokenId}.`,
      errorPrompt: `Failed to approve transfer of token ${tokenId}.`,
    });
  }
}

const transactionPresentation: Record<
  TransactionCategory,
  { label: string; shortLabel: string; icon: IconNameType }
> = {
  SENIOR_POOL_STAKE: {
    label: "Senior Pool Stake",
    shortLabel: "Stake",
    icon: "ArrowUp",
  },
  SENIOR_POOL_DEPOSIT: {
    label: "Senior Pool Supply",
    shortLabel: "Supply",
    icon: "ArrowUp",
  },
  SENIOR_POOL_DEPOSIT_AND_STAKE: {
    label: "Senior Pool Supply and Stake",
    shortLabel: "Supply and Stake",
    icon: "ArrowUp",
  },
  SENIOR_POOL_UNSTAKE: {
    label: "Senior Pool Unstake",
    shortLabel: "Unstake",
    icon: "ArrowDown",
  },
  SENIOR_POOL_WITHDRAWAL: {
    label: "Senior Pool Withdrawal",
    shortLabel: "Withdrawal",
    icon: "ArrowDown",
  },
  SENIOR_POOL_UNSTAKE_AND_WITHDRAWAL: {
    label: "Senior Pool Unstake and Withdraw",
    shortLabel: "Unstake and Withdraw",
    icon: "ArrowDown",
  },
  SENIOR_POOL_REDEMPTION: {
    label: "Senior Pool Auto Transfer",
    shortLabel: "Auto Transfer",
    icon: "ArrowDown",
  },
  TRANCHED_POOL_DEPOSIT: {
    label: "Borrower Pool Supply",
    shortLabel: "Supply",
    icon: "ArrowUp",
  },
  TRANCHED_POOL_WITHDRAWAL: {
    label: "Borrower Pool Withdrawal",
    shortLabel: "Withdrawal",
    icon: "ArrowDown",
  },
  TRANCHED_POOL_REPAYMENT: {
    label: "Repayment",
    shortLabel: "Repayment",
    icon: "ArrowUp",
  },
  TRANCHED_POOL_DRAWDOWN: {
    label: "Drawdown",
    shortLabel: "Drawdown",
    icon: "ArrowDown",
  },
  UID_MINTED: {
    label: "Mint UID",
    shortLabel: "Mint UID",
    icon: "Checkmark",
  },
  CURVE_FIDU_BUY: {
    label: "Curve Swap",
    shortLabel: "Curve Swap",
    icon: "ArrowUp",
  },
  CURVE_FIDU_SELL: {
    label: "Curve Swap",
    shortLabel: "Curve Swap",
    icon: "ArrowDown",
  },
  SENIOR_POOL_ADD_TO_WITHDRAWAL_REQUEST: {
    label: "Withdrawal Request Increased",
    shortLabel: "Increase Withdrawal",
    icon: "ArrowDown",
  },
  SENIOR_POOL_CANCEL_WITHDRAWAL_REQUEST: {
    label: "Cancel Withdrawal Request",
    shortLabel: "Cancel Withdrawal",
    icon: "X",
  },
  SENIOR_POOL_WITHDRAWAL_REQUEST: {
    label: "Withdrawal Request",
    shortLabel: "Withdrawal Request",
    icon: "ArrowDown",
  },
  SENIOR_POOL_DISTRIBUTION: {
    label: "Withdrawal Request Distribution",
    shortLabel: "Withdrawal Request Distribution",
    icon: "ArrowDown",
  },
  STAKING_REWARDS_CLAIMED: {
    label: "Staking Rewards Claimed",
    shortLabel: "Rewards Claimed",
    icon: "ArrowUp",
  },
  BACKER_REWARDS_CLAIMED: {
    label: "Backer Rewards Claimed",
    shortLabel: "Rewards Claimed",
    icon: "ArrowUp",
  },
  COMMUNITY_REWARDS_CLAIMED: {
    label: "GFI Grant Claimed",
    shortLabel: "Grant Claimed",
    icon: "ArrowUp",
  },
  MEMBERSHIP_REWARDS_CLAIMED: {
    label: "Membership Rewards Claimed",
    shortLabel: "Membership Rewards",
    icon: "ArrowUp",
  },
  MEMBERSHIP_GFI_DEPOSIT: {
    label: "Added GFI to Vault",
    shortLabel: "Vaulted GFI",
    icon: "ArrowUp",
  },
  MEMBERSHIP_GFI_WITHDRAWAL: {
    label: "Removed GFI from Vault",
    shortLabel: "Unvaulted GFI",
    icon: "ArrowDown",
  },
  MEMBERSHIP_CAPITAL_DEPOSIT: {
    label: "Added Capital to Vault",
    shortLabel: "Vaulted Capital",
    icon: "ArrowUp",
  },
  MEMBERSHIP_CAPITAL_WITHDRAWAL: {
    label: "Removed Capital from Vault",
    shortLabel: "Unvaulted Capital",
    icon: "ArrowDown",
  },
};

export function getTransactionLabel(transaction: {
  category: TransactionCategory;
}): string {
  return transactionPresentation[transaction.category].label;
}

/**
 * Less descriptive but more brief than regular getTransactionLabel(). Use this only when it's appropriate in context.
 * @param transaction Transaction object
 * @returns Short label describing the transaction
 */
export function getShortTransactionLabel(transaction: {
  category: TransactionCategory;
}): string {
  return transactionPresentation[transaction.category].shortLabel;
}

/**
 * Returns the icon for the transaction category
 * @param transaction Transaction object
 * @returns Icon to use for the transaction
 */
export function getTransactionIcon(transaction: {
  category: TransactionCategory;
}): IconNameType {
  return transactionPresentation[transaction.category].icon;
}

/**
 * Mapping of position type to value for transactions
 */
export const positionTypeToValue: Record<StakedPositionType, string> = {
  Fidu: "0",
  CurveLP: "1",
};

/**
 * Get the optimal positions to unstake
 * @param positions     Array of the positions
 * @param amount        The amount to unstake
 * @returns Sorted array of positions to unstake
 */
export function getOptimalPositionsToUnstake(
  positions: Pick<SeniorPoolStakedPosition, "id" | "amount" | "endTime">[],
  amount: BigNumber
): { id: string; amount: BigNumber }[] {
  const unstakeableAmount = sum("amount", positions);

  if (unstakeableAmount.lt(amount)) {
    throw new Error(`Cannot unstake more than ${unstakeableAmount}.`);
  }

  const sortedUnstakeablePositions = positions
    .slice()
    .sort((a, b) =>
      a.endTime && b.endTime ? b.endTime.sub(a.endTime).toNumber() : 0
    );

  let amountRemaining = BigNumber.from(amount);

  return sortedUnstakeablePositions
    .reduce((acc: { id: string; amount: BigNumber }[], position) => {
      if (!position.id) return acc;

      const id = position.id;
      const positionAmount = position.amount ?? BigNumber.from(0);
      const amountToUnstake = positionAmount.lt(amountRemaining)
        ? positionAmount
        : amountRemaining;

      amountRemaining = amountRemaining.sub(amountToUnstake);

      return acc.concat([{ id, amount: amountToUnstake }]);
    }, [])
    .filter(({ amount }) => amount.gt(BigNumber.from(0)));
}

/**
 * Convenience function that allows you to sum one field of an array of objects.
 * @param field The field to extract from each of the objects.
 * @param summable Array of objects to be summed over. Each object should have a key named the same as `field` with a value that is a BigNumber
 * @returns The sum of all `summable[field]` values.
 */
export function sum<T extends string, U extends Record<T, BigNumber>>(
  field: T,
  summable: U[] = []
): BigNumber {
  return summable.reduce(
    (prev, current) => prev.add(current[field]),
    BigNumber.from(0)
  );
}

/**
 *
 * @param gfi CryptoAmount measured in GFI
 * @param fiatPerGfi The number of USD per GFI
 * @returns A CryptoAmount in USDC
 */
export function gfiToUsdc(
  gfi: CryptoAmount,
  fiatPerGfi: number
): CryptoAmount<"USDC"> {
  const formattedGfi = utils.formatUnits(gfi.amount, GFI_DECIMALS);
  const usdcPerGfi = FixedNumber.from(fiatPerGfi.toString()).mulUnsafe(
    FixedNumber.from(Math.pow(10, USDC_DECIMALS).toString())
  );
  const amount = FixedNumber.from(formattedGfi).mulUnsafe(usdcPerGfi);
  return {
    token: "USDC",
    amount: BigNumber.from(amount.toString().split(".")[0]),
  };
}

export type RepaymentSchedule = {
  paymentPeriod: number;
  estimatedPaymentDate: number;
  principal: BigNumber;
  interest: BigNumber;
}[];

export const REPAYMENT_SCHEDULE_FIELDS = gql`
  fragment RepaymentScheduleFields on Loan {
    fundableAt
    termStartTime
    termEndTime
    paymentPeriodInDays
    termInDays
    interestRateBigInt
    principalAmount
    fundingLimit
  }
`;

export function generateRepaymentSchedule(
  loan: RepaymentScheduleFieldsFragment
): RepaymentSchedule {
  const repaymentSchedule: RepaymentSchedule = [];
  const secondsPerDay = 24 * 60 * 60;

  const termStartTime = !loan.termStartTime.isZero()
    ? loan.termStartTime.toNumber()
    : loan.fundableAt + secondsPerDay * 14;
  const termEndTime = !loan.termEndTime.isZero()
    ? loan.termEndTime.toNumber()
    : termStartTime + loan.termInDays * secondsPerDay;

  const principal = !loan.principalAmount.isZero()
    ? loan.principalAmount
    : loan.fundingLimit;

  // Number of seconds in 'paymentPeriodInDays'
  const paymentPeriodInSeconds =
    loan.paymentPeriodInDays.toNumber() * 24 * 60 * 60;

  // Keep track of period start & end and payment period number
  let periodStartTimestamp = termStartTime;
  let paymentPeriod = 1;

  for (
    let periodEndTimestamp = termStartTime + paymentPeriodInSeconds;
    periodEndTimestamp <= termEndTime;
    periodEndTimestamp += paymentPeriodInSeconds
  ) {
    const expectedInterest = calculateInterestOwed({
      isLate: false,
      interestOwed: BigNumber.from(0),
      interestApr: loan.interestRateBigInt,
      nextDueTime: BigNumber.from(periodEndTimestamp),
      interestAccruedAsOf: BigNumber.from(periodStartTimestamp),
      balance: principal,
    });
    repaymentSchedule.push({
      paymentPeriod: paymentPeriod,
      estimatedPaymentDate: periodEndTimestamp * 1000,
      principal: BigNumber.from(0),
      interest: expectedInterest,
    });

    paymentPeriod++;
    periodStartTimestamp = periodEndTimestamp;
  }

  // Catch the remainder of time when there's not a perfect diff of 'paymentPeriodInDays' on the last period
  // i.e startTime Dec 6th 2024, endTime Dec 16th 2024 and paymentPeriodInDays is 30 days
  if (periodStartTimestamp <= termEndTime) {
    const expectedInterest = calculateInterestOwed({
      isLate: false,
      interestOwed: BigNumber.from(0),
      interestApr: loan.interestRateBigInt,
      nextDueTime: BigNumber.from(termEndTime),
      interestAccruedAsOf: BigNumber.from(periodStartTimestamp),
      balance: principal,
    });
    repaymentSchedule.push({
      paymentPeriod: paymentPeriod,
      estimatedPaymentDate: termEndTime * 1000,
      principal: principal,
      interest: expectedInterest,
    });
  }

  return repaymentSchedule;
}
