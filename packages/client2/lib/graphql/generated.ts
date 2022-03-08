import { gql } from '@apollo/client';
import * as Apollo from '@apollo/client';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
const defaultOptions = {} as const;
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: string;
  String: string;
  Boolean: boolean;
  Int: number;
  Float: number;
  BigDecimal: any;
  BigInt: any;
  Bytes: any;
};

/** The block at which the query should be executed. */
export type Block_Height = {
  /** Value containing a block hash */
  hash?: InputMaybe<Scalars['Bytes']>;
  /** Value containing a block number */
  number?: InputMaybe<Scalars['Int']>;
  /**
   * Value containing the minimum block number.
   * In the case of `number_gte`, the query will be executed on the latest block only if
   * the subgraph has progressed to or past the minimum block number.
   * Defaults to the latest block when omitted.
   *
   */
  number_gte?: InputMaybe<Scalars['Int']>;
};

export type CapitalProviderStatus = {
  __typename?: 'CapitalProviderStatus';
  allowance: Scalars['BigInt'];
  availableToWithdraw: Scalars['BigInt'];
  availableToWithdrawInDollars?: Maybe<Scalars['BigInt']>;
  id: Scalars['ID'];
  numShares: Scalars['BigInt'];
  unrealizedGains?: Maybe<Scalars['BigDecimal']>;
  unrealizedGainsInDollars?: Maybe<Scalars['BigInt']>;
  unrealizedGainsPercentage?: Maybe<Scalars['BigDecimal']>;
  user: User;
  weightedAverageSharePrice?: Maybe<Scalars['BigDecimal']>;
};

export type CapitalProviderStatus_Filter = {
  allowance?: InputMaybe<Scalars['BigInt']>;
  allowance_gt?: InputMaybe<Scalars['BigInt']>;
  allowance_gte?: InputMaybe<Scalars['BigInt']>;
  allowance_in?: InputMaybe<Array<Scalars['BigInt']>>;
  allowance_lt?: InputMaybe<Scalars['BigInt']>;
  allowance_lte?: InputMaybe<Scalars['BigInt']>;
  allowance_not?: InputMaybe<Scalars['BigInt']>;
  allowance_not_in?: InputMaybe<Array<Scalars['BigInt']>>;
  availableToWithdraw?: InputMaybe<Scalars['BigInt']>;
  availableToWithdrawInDollars?: InputMaybe<Scalars['BigInt']>;
  availableToWithdrawInDollars_gt?: InputMaybe<Scalars['BigInt']>;
  availableToWithdrawInDollars_gte?: InputMaybe<Scalars['BigInt']>;
  availableToWithdrawInDollars_in?: InputMaybe<Array<Scalars['BigInt']>>;
  availableToWithdrawInDollars_lt?: InputMaybe<Scalars['BigInt']>;
  availableToWithdrawInDollars_lte?: InputMaybe<Scalars['BigInt']>;
  availableToWithdrawInDollars_not?: InputMaybe<Scalars['BigInt']>;
  availableToWithdrawInDollars_not_in?: InputMaybe<Array<Scalars['BigInt']>>;
  availableToWithdraw_gt?: InputMaybe<Scalars['BigInt']>;
  availableToWithdraw_gte?: InputMaybe<Scalars['BigInt']>;
  availableToWithdraw_in?: InputMaybe<Array<Scalars['BigInt']>>;
  availableToWithdraw_lt?: InputMaybe<Scalars['BigInt']>;
  availableToWithdraw_lte?: InputMaybe<Scalars['BigInt']>;
  availableToWithdraw_not?: InputMaybe<Scalars['BigInt']>;
  availableToWithdraw_not_in?: InputMaybe<Array<Scalars['BigInt']>>;
  id?: InputMaybe<Scalars['ID']>;
  id_gt?: InputMaybe<Scalars['ID']>;
  id_gte?: InputMaybe<Scalars['ID']>;
  id_in?: InputMaybe<Array<Scalars['ID']>>;
  id_lt?: InputMaybe<Scalars['ID']>;
  id_lte?: InputMaybe<Scalars['ID']>;
  id_not?: InputMaybe<Scalars['ID']>;
  id_not_in?: InputMaybe<Array<Scalars['ID']>>;
  numShares?: InputMaybe<Scalars['BigInt']>;
  numShares_gt?: InputMaybe<Scalars['BigInt']>;
  numShares_gte?: InputMaybe<Scalars['BigInt']>;
  numShares_in?: InputMaybe<Array<Scalars['BigInt']>>;
  numShares_lt?: InputMaybe<Scalars['BigInt']>;
  numShares_lte?: InputMaybe<Scalars['BigInt']>;
  numShares_not?: InputMaybe<Scalars['BigInt']>;
  numShares_not_in?: InputMaybe<Array<Scalars['BigInt']>>;
  unrealizedGains?: InputMaybe<Scalars['BigDecimal']>;
  unrealizedGainsInDollars?: InputMaybe<Scalars['BigInt']>;
  unrealizedGainsInDollars_gt?: InputMaybe<Scalars['BigInt']>;
  unrealizedGainsInDollars_gte?: InputMaybe<Scalars['BigInt']>;
  unrealizedGainsInDollars_in?: InputMaybe<Array<Scalars['BigInt']>>;
  unrealizedGainsInDollars_lt?: InputMaybe<Scalars['BigInt']>;
  unrealizedGainsInDollars_lte?: InputMaybe<Scalars['BigInt']>;
  unrealizedGainsInDollars_not?: InputMaybe<Scalars['BigInt']>;
  unrealizedGainsInDollars_not_in?: InputMaybe<Array<Scalars['BigInt']>>;
  unrealizedGainsPercentage?: InputMaybe<Scalars['BigDecimal']>;
  unrealizedGainsPercentage_gt?: InputMaybe<Scalars['BigDecimal']>;
  unrealizedGainsPercentage_gte?: InputMaybe<Scalars['BigDecimal']>;
  unrealizedGainsPercentage_in?: InputMaybe<Array<Scalars['BigDecimal']>>;
  unrealizedGainsPercentage_lt?: InputMaybe<Scalars['BigDecimal']>;
  unrealizedGainsPercentage_lte?: InputMaybe<Scalars['BigDecimal']>;
  unrealizedGainsPercentage_not?: InputMaybe<Scalars['BigDecimal']>;
  unrealizedGainsPercentage_not_in?: InputMaybe<Array<Scalars['BigDecimal']>>;
  unrealizedGains_gt?: InputMaybe<Scalars['BigDecimal']>;
  unrealizedGains_gte?: InputMaybe<Scalars['BigDecimal']>;
  unrealizedGains_in?: InputMaybe<Array<Scalars['BigDecimal']>>;
  unrealizedGains_lt?: InputMaybe<Scalars['BigDecimal']>;
  unrealizedGains_lte?: InputMaybe<Scalars['BigDecimal']>;
  unrealizedGains_not?: InputMaybe<Scalars['BigDecimal']>;
  unrealizedGains_not_in?: InputMaybe<Array<Scalars['BigDecimal']>>;
  user?: InputMaybe<Scalars['String']>;
  user_contains?: InputMaybe<Scalars['String']>;
  user_ends_with?: InputMaybe<Scalars['String']>;
  user_gt?: InputMaybe<Scalars['String']>;
  user_gte?: InputMaybe<Scalars['String']>;
  user_in?: InputMaybe<Array<Scalars['String']>>;
  user_lt?: InputMaybe<Scalars['String']>;
  user_lte?: InputMaybe<Scalars['String']>;
  user_not?: InputMaybe<Scalars['String']>;
  user_not_contains?: InputMaybe<Scalars['String']>;
  user_not_ends_with?: InputMaybe<Scalars['String']>;
  user_not_in?: InputMaybe<Array<Scalars['String']>>;
  user_not_starts_with?: InputMaybe<Scalars['String']>;
  user_starts_with?: InputMaybe<Scalars['String']>;
  weightedAverageSharePrice?: InputMaybe<Scalars['BigDecimal']>;
  weightedAverageSharePrice_gt?: InputMaybe<Scalars['BigDecimal']>;
  weightedAverageSharePrice_gte?: InputMaybe<Scalars['BigDecimal']>;
  weightedAverageSharePrice_in?: InputMaybe<Array<Scalars['BigDecimal']>>;
  weightedAverageSharePrice_lt?: InputMaybe<Scalars['BigDecimal']>;
  weightedAverageSharePrice_lte?: InputMaybe<Scalars['BigDecimal']>;
  weightedAverageSharePrice_not?: InputMaybe<Scalars['BigDecimal']>;
  weightedAverageSharePrice_not_in?: InputMaybe<Array<Scalars['BigDecimal']>>;
};

export enum CapitalProviderStatus_OrderBy {
  Allowance = 'allowance',
  AvailableToWithdraw = 'availableToWithdraw',
  AvailableToWithdrawInDollars = 'availableToWithdrawInDollars',
  Id = 'id',
  NumShares = 'numShares',
  UnrealizedGains = 'unrealizedGains',
  UnrealizedGainsInDollars = 'unrealizedGainsInDollars',
  UnrealizedGainsPercentage = 'unrealizedGainsPercentage',
  User = 'user',
  WeightedAverageSharePrice = 'weightedAverageSharePrice'
}

export type CreditLine = {
  __typename?: 'CreditLine';
  availableCredit: Scalars['BigInt'];
  balance: Scalars['BigInt'];
  collectedPaymentBalance?: Maybe<Scalars['BigInt']>;
  dueDate?: Maybe<Scalars['String']>;
  id: Scalars['ID'];
  interestAccruedAsOf: Scalars['BigInt'];
  interestApr: Scalars['BigInt'];
  interestAprDecimal: Scalars['BigDecimal'];
  interestOwed: Scalars['BigInt'];
  lastFullPaymentTime: Scalars['BigInt'];
  limit: Scalars['BigInt'];
  name?: Maybe<Scalars['String']>;
  nextDueTime: Scalars['BigInt'];
  paymentPeriodInDays: Scalars['BigInt'];
  periodDueAmount?: Maybe<Scalars['BigInt']>;
  remainingPeriodDueAmount: Scalars['BigInt'];
  remainingTotalDueAmount: Scalars['BigInt'];
  termEndDate: Scalars['BigInt'];
  termEndTime: Scalars['BigInt'];
  termInDays: Scalars['BigInt'];
  totalDueAmount?: Maybe<Scalars['BigInt']>;
  tranchedPool: TranchedPool;
};

export type CreditLine_Filter = {
  availableCredit?: InputMaybe<Scalars['BigInt']>;
  availableCredit_gt?: InputMaybe<Scalars['BigInt']>;
  availableCredit_gte?: InputMaybe<Scalars['BigInt']>;
  availableCredit_in?: InputMaybe<Array<Scalars['BigInt']>>;
  availableCredit_lt?: InputMaybe<Scalars['BigInt']>;
  availableCredit_lte?: InputMaybe<Scalars['BigInt']>;
  availableCredit_not?: InputMaybe<Scalars['BigInt']>;
  availableCredit_not_in?: InputMaybe<Array<Scalars['BigInt']>>;
  balance?: InputMaybe<Scalars['BigInt']>;
  balance_gt?: InputMaybe<Scalars['BigInt']>;
  balance_gte?: InputMaybe<Scalars['BigInt']>;
  balance_in?: InputMaybe<Array<Scalars['BigInt']>>;
  balance_lt?: InputMaybe<Scalars['BigInt']>;
  balance_lte?: InputMaybe<Scalars['BigInt']>;
  balance_not?: InputMaybe<Scalars['BigInt']>;
  balance_not_in?: InputMaybe<Array<Scalars['BigInt']>>;
  collectedPaymentBalance?: InputMaybe<Scalars['BigInt']>;
  collectedPaymentBalance_gt?: InputMaybe<Scalars['BigInt']>;
  collectedPaymentBalance_gte?: InputMaybe<Scalars['BigInt']>;
  collectedPaymentBalance_in?: InputMaybe<Array<Scalars['BigInt']>>;
  collectedPaymentBalance_lt?: InputMaybe<Scalars['BigInt']>;
  collectedPaymentBalance_lte?: InputMaybe<Scalars['BigInt']>;
  collectedPaymentBalance_not?: InputMaybe<Scalars['BigInt']>;
  collectedPaymentBalance_not_in?: InputMaybe<Array<Scalars['BigInt']>>;
  dueDate?: InputMaybe<Scalars['String']>;
  dueDate_contains?: InputMaybe<Scalars['String']>;
  dueDate_ends_with?: InputMaybe<Scalars['String']>;
  dueDate_gt?: InputMaybe<Scalars['String']>;
  dueDate_gte?: InputMaybe<Scalars['String']>;
  dueDate_in?: InputMaybe<Array<Scalars['String']>>;
  dueDate_lt?: InputMaybe<Scalars['String']>;
  dueDate_lte?: InputMaybe<Scalars['String']>;
  dueDate_not?: InputMaybe<Scalars['String']>;
  dueDate_not_contains?: InputMaybe<Scalars['String']>;
  dueDate_not_ends_with?: InputMaybe<Scalars['String']>;
  dueDate_not_in?: InputMaybe<Array<Scalars['String']>>;
  dueDate_not_starts_with?: InputMaybe<Scalars['String']>;
  dueDate_starts_with?: InputMaybe<Scalars['String']>;
  id?: InputMaybe<Scalars['ID']>;
  id_gt?: InputMaybe<Scalars['ID']>;
  id_gte?: InputMaybe<Scalars['ID']>;
  id_in?: InputMaybe<Array<Scalars['ID']>>;
  id_lt?: InputMaybe<Scalars['ID']>;
  id_lte?: InputMaybe<Scalars['ID']>;
  id_not?: InputMaybe<Scalars['ID']>;
  id_not_in?: InputMaybe<Array<Scalars['ID']>>;
  interestAccruedAsOf?: InputMaybe<Scalars['BigInt']>;
  interestAccruedAsOf_gt?: InputMaybe<Scalars['BigInt']>;
  interestAccruedAsOf_gte?: InputMaybe<Scalars['BigInt']>;
  interestAccruedAsOf_in?: InputMaybe<Array<Scalars['BigInt']>>;
  interestAccruedAsOf_lt?: InputMaybe<Scalars['BigInt']>;
  interestAccruedAsOf_lte?: InputMaybe<Scalars['BigInt']>;
  interestAccruedAsOf_not?: InputMaybe<Scalars['BigInt']>;
  interestAccruedAsOf_not_in?: InputMaybe<Array<Scalars['BigInt']>>;
  interestApr?: InputMaybe<Scalars['BigInt']>;
  interestAprDecimal?: InputMaybe<Scalars['BigDecimal']>;
  interestAprDecimal_gt?: InputMaybe<Scalars['BigDecimal']>;
  interestAprDecimal_gte?: InputMaybe<Scalars['BigDecimal']>;
  interestAprDecimal_in?: InputMaybe<Array<Scalars['BigDecimal']>>;
  interestAprDecimal_lt?: InputMaybe<Scalars['BigDecimal']>;
  interestAprDecimal_lte?: InputMaybe<Scalars['BigDecimal']>;
  interestAprDecimal_not?: InputMaybe<Scalars['BigDecimal']>;
  interestAprDecimal_not_in?: InputMaybe<Array<Scalars['BigDecimal']>>;
  interestApr_gt?: InputMaybe<Scalars['BigInt']>;
  interestApr_gte?: InputMaybe<Scalars['BigInt']>;
  interestApr_in?: InputMaybe<Array<Scalars['BigInt']>>;
  interestApr_lt?: InputMaybe<Scalars['BigInt']>;
  interestApr_lte?: InputMaybe<Scalars['BigInt']>;
  interestApr_not?: InputMaybe<Scalars['BigInt']>;
  interestApr_not_in?: InputMaybe<Array<Scalars['BigInt']>>;
  interestOwed?: InputMaybe<Scalars['BigInt']>;
  interestOwed_gt?: InputMaybe<Scalars['BigInt']>;
  interestOwed_gte?: InputMaybe<Scalars['BigInt']>;
  interestOwed_in?: InputMaybe<Array<Scalars['BigInt']>>;
  interestOwed_lt?: InputMaybe<Scalars['BigInt']>;
  interestOwed_lte?: InputMaybe<Scalars['BigInt']>;
  interestOwed_not?: InputMaybe<Scalars['BigInt']>;
  interestOwed_not_in?: InputMaybe<Array<Scalars['BigInt']>>;
  lastFullPaymentTime?: InputMaybe<Scalars['BigInt']>;
  lastFullPaymentTime_gt?: InputMaybe<Scalars['BigInt']>;
  lastFullPaymentTime_gte?: InputMaybe<Scalars['BigInt']>;
  lastFullPaymentTime_in?: InputMaybe<Array<Scalars['BigInt']>>;
  lastFullPaymentTime_lt?: InputMaybe<Scalars['BigInt']>;
  lastFullPaymentTime_lte?: InputMaybe<Scalars['BigInt']>;
  lastFullPaymentTime_not?: InputMaybe<Scalars['BigInt']>;
  lastFullPaymentTime_not_in?: InputMaybe<Array<Scalars['BigInt']>>;
  limit?: InputMaybe<Scalars['BigInt']>;
  limit_gt?: InputMaybe<Scalars['BigInt']>;
  limit_gte?: InputMaybe<Scalars['BigInt']>;
  limit_in?: InputMaybe<Array<Scalars['BigInt']>>;
  limit_lt?: InputMaybe<Scalars['BigInt']>;
  limit_lte?: InputMaybe<Scalars['BigInt']>;
  limit_not?: InputMaybe<Scalars['BigInt']>;
  limit_not_in?: InputMaybe<Array<Scalars['BigInt']>>;
  name?: InputMaybe<Scalars['String']>;
  name_contains?: InputMaybe<Scalars['String']>;
  name_ends_with?: InputMaybe<Scalars['String']>;
  name_gt?: InputMaybe<Scalars['String']>;
  name_gte?: InputMaybe<Scalars['String']>;
  name_in?: InputMaybe<Array<Scalars['String']>>;
  name_lt?: InputMaybe<Scalars['String']>;
  name_lte?: InputMaybe<Scalars['String']>;
  name_not?: InputMaybe<Scalars['String']>;
  name_not_contains?: InputMaybe<Scalars['String']>;
  name_not_ends_with?: InputMaybe<Scalars['String']>;
  name_not_in?: InputMaybe<Array<Scalars['String']>>;
  name_not_starts_with?: InputMaybe<Scalars['String']>;
  name_starts_with?: InputMaybe<Scalars['String']>;
  nextDueTime?: InputMaybe<Scalars['BigInt']>;
  nextDueTime_gt?: InputMaybe<Scalars['BigInt']>;
  nextDueTime_gte?: InputMaybe<Scalars['BigInt']>;
  nextDueTime_in?: InputMaybe<Array<Scalars['BigInt']>>;
  nextDueTime_lt?: InputMaybe<Scalars['BigInt']>;
  nextDueTime_lte?: InputMaybe<Scalars['BigInt']>;
  nextDueTime_not?: InputMaybe<Scalars['BigInt']>;
  nextDueTime_not_in?: InputMaybe<Array<Scalars['BigInt']>>;
  paymentPeriodInDays?: InputMaybe<Scalars['BigInt']>;
  paymentPeriodInDays_gt?: InputMaybe<Scalars['BigInt']>;
  paymentPeriodInDays_gte?: InputMaybe<Scalars['BigInt']>;
  paymentPeriodInDays_in?: InputMaybe<Array<Scalars['BigInt']>>;
  paymentPeriodInDays_lt?: InputMaybe<Scalars['BigInt']>;
  paymentPeriodInDays_lte?: InputMaybe<Scalars['BigInt']>;
  paymentPeriodInDays_not?: InputMaybe<Scalars['BigInt']>;
  paymentPeriodInDays_not_in?: InputMaybe<Array<Scalars['BigInt']>>;
  periodDueAmount?: InputMaybe<Scalars['BigInt']>;
  periodDueAmount_gt?: InputMaybe<Scalars['BigInt']>;
  periodDueAmount_gte?: InputMaybe<Scalars['BigInt']>;
  periodDueAmount_in?: InputMaybe<Array<Scalars['BigInt']>>;
  periodDueAmount_lt?: InputMaybe<Scalars['BigInt']>;
  periodDueAmount_lte?: InputMaybe<Scalars['BigInt']>;
  periodDueAmount_not?: InputMaybe<Scalars['BigInt']>;
  periodDueAmount_not_in?: InputMaybe<Array<Scalars['BigInt']>>;
  remainingPeriodDueAmount?: InputMaybe<Scalars['BigInt']>;
  remainingPeriodDueAmount_gt?: InputMaybe<Scalars['BigInt']>;
  remainingPeriodDueAmount_gte?: InputMaybe<Scalars['BigInt']>;
  remainingPeriodDueAmount_in?: InputMaybe<Array<Scalars['BigInt']>>;
  remainingPeriodDueAmount_lt?: InputMaybe<Scalars['BigInt']>;
  remainingPeriodDueAmount_lte?: InputMaybe<Scalars['BigInt']>;
  remainingPeriodDueAmount_not?: InputMaybe<Scalars['BigInt']>;
  remainingPeriodDueAmount_not_in?: InputMaybe<Array<Scalars['BigInt']>>;
  remainingTotalDueAmount?: InputMaybe<Scalars['BigInt']>;
  remainingTotalDueAmount_gt?: InputMaybe<Scalars['BigInt']>;
  remainingTotalDueAmount_gte?: InputMaybe<Scalars['BigInt']>;
  remainingTotalDueAmount_in?: InputMaybe<Array<Scalars['BigInt']>>;
  remainingTotalDueAmount_lt?: InputMaybe<Scalars['BigInt']>;
  remainingTotalDueAmount_lte?: InputMaybe<Scalars['BigInt']>;
  remainingTotalDueAmount_not?: InputMaybe<Scalars['BigInt']>;
  remainingTotalDueAmount_not_in?: InputMaybe<Array<Scalars['BigInt']>>;
  termEndDate?: InputMaybe<Scalars['BigInt']>;
  termEndDate_gt?: InputMaybe<Scalars['BigInt']>;
  termEndDate_gte?: InputMaybe<Scalars['BigInt']>;
  termEndDate_in?: InputMaybe<Array<Scalars['BigInt']>>;
  termEndDate_lt?: InputMaybe<Scalars['BigInt']>;
  termEndDate_lte?: InputMaybe<Scalars['BigInt']>;
  termEndDate_not?: InputMaybe<Scalars['BigInt']>;
  termEndDate_not_in?: InputMaybe<Array<Scalars['BigInt']>>;
  termEndTime?: InputMaybe<Scalars['BigInt']>;
  termEndTime_gt?: InputMaybe<Scalars['BigInt']>;
  termEndTime_gte?: InputMaybe<Scalars['BigInt']>;
  termEndTime_in?: InputMaybe<Array<Scalars['BigInt']>>;
  termEndTime_lt?: InputMaybe<Scalars['BigInt']>;
  termEndTime_lte?: InputMaybe<Scalars['BigInt']>;
  termEndTime_not?: InputMaybe<Scalars['BigInt']>;
  termEndTime_not_in?: InputMaybe<Array<Scalars['BigInt']>>;
  termInDays?: InputMaybe<Scalars['BigInt']>;
  termInDays_gt?: InputMaybe<Scalars['BigInt']>;
  termInDays_gte?: InputMaybe<Scalars['BigInt']>;
  termInDays_in?: InputMaybe<Array<Scalars['BigInt']>>;
  termInDays_lt?: InputMaybe<Scalars['BigInt']>;
  termInDays_lte?: InputMaybe<Scalars['BigInt']>;
  termInDays_not?: InputMaybe<Scalars['BigInt']>;
  termInDays_not_in?: InputMaybe<Array<Scalars['BigInt']>>;
  totalDueAmount?: InputMaybe<Scalars['BigInt']>;
  totalDueAmount_gt?: InputMaybe<Scalars['BigInt']>;
  totalDueAmount_gte?: InputMaybe<Scalars['BigInt']>;
  totalDueAmount_in?: InputMaybe<Array<Scalars['BigInt']>>;
  totalDueAmount_lt?: InputMaybe<Scalars['BigInt']>;
  totalDueAmount_lte?: InputMaybe<Scalars['BigInt']>;
  totalDueAmount_not?: InputMaybe<Scalars['BigInt']>;
  totalDueAmount_not_in?: InputMaybe<Array<Scalars['BigInt']>>;
  tranchedPool?: InputMaybe<Scalars['String']>;
  tranchedPool_contains?: InputMaybe<Scalars['String']>;
  tranchedPool_ends_with?: InputMaybe<Scalars['String']>;
  tranchedPool_gt?: InputMaybe<Scalars['String']>;
  tranchedPool_gte?: InputMaybe<Scalars['String']>;
  tranchedPool_in?: InputMaybe<Array<Scalars['String']>>;
  tranchedPool_lt?: InputMaybe<Scalars['String']>;
  tranchedPool_lte?: InputMaybe<Scalars['String']>;
  tranchedPool_not?: InputMaybe<Scalars['String']>;
  tranchedPool_not_contains?: InputMaybe<Scalars['String']>;
  tranchedPool_not_ends_with?: InputMaybe<Scalars['String']>;
  tranchedPool_not_in?: InputMaybe<Array<Scalars['String']>>;
  tranchedPool_not_starts_with?: InputMaybe<Scalars['String']>;
  tranchedPool_starts_with?: InputMaybe<Scalars['String']>;
};

export enum CreditLine_OrderBy {
  AvailableCredit = 'availableCredit',
  Balance = 'balance',
  CollectedPaymentBalance = 'collectedPaymentBalance',
  DueDate = 'dueDate',
  Id = 'id',
  InterestAccruedAsOf = 'interestAccruedAsOf',
  InterestApr = 'interestApr',
  InterestAprDecimal = 'interestAprDecimal',
  InterestOwed = 'interestOwed',
  LastFullPaymentTime = 'lastFullPaymentTime',
  Limit = 'limit',
  Name = 'name',
  NextDueTime = 'nextDueTime',
  PaymentPeriodInDays = 'paymentPeriodInDays',
  PeriodDueAmount = 'periodDueAmount',
  RemainingPeriodDueAmount = 'remainingPeriodDueAmount',
  RemainingTotalDueAmount = 'remainingTotalDueAmount',
  TermEndDate = 'termEndDate',
  TermEndTime = 'termEndTime',
  TermInDays = 'termInDays',
  TotalDueAmount = 'totalDueAmount',
  TranchedPool = 'tranchedPool'
}

export type JuniorTrancheInfo = {
  __typename?: 'JuniorTrancheInfo';
  id: Scalars['ID'];
  interestSharePrice: Scalars['BigInt'];
  lockedUntil: Scalars['BigInt'];
  principalDeposited: Scalars['BigInt'];
  principalSharePrice: Scalars['BigInt'];
  trancheId: Scalars['BigInt'];
  tranchedPool: TranchedPool;
};

export type JuniorTrancheInfo_Filter = {
  id?: InputMaybe<Scalars['ID']>;
  id_gt?: InputMaybe<Scalars['ID']>;
  id_gte?: InputMaybe<Scalars['ID']>;
  id_in?: InputMaybe<Array<Scalars['ID']>>;
  id_lt?: InputMaybe<Scalars['ID']>;
  id_lte?: InputMaybe<Scalars['ID']>;
  id_not?: InputMaybe<Scalars['ID']>;
  id_not_in?: InputMaybe<Array<Scalars['ID']>>;
  interestSharePrice?: InputMaybe<Scalars['BigInt']>;
  interestSharePrice_gt?: InputMaybe<Scalars['BigInt']>;
  interestSharePrice_gte?: InputMaybe<Scalars['BigInt']>;
  interestSharePrice_in?: InputMaybe<Array<Scalars['BigInt']>>;
  interestSharePrice_lt?: InputMaybe<Scalars['BigInt']>;
  interestSharePrice_lte?: InputMaybe<Scalars['BigInt']>;
  interestSharePrice_not?: InputMaybe<Scalars['BigInt']>;
  interestSharePrice_not_in?: InputMaybe<Array<Scalars['BigInt']>>;
  lockedUntil?: InputMaybe<Scalars['BigInt']>;
  lockedUntil_gt?: InputMaybe<Scalars['BigInt']>;
  lockedUntil_gte?: InputMaybe<Scalars['BigInt']>;
  lockedUntil_in?: InputMaybe<Array<Scalars['BigInt']>>;
  lockedUntil_lt?: InputMaybe<Scalars['BigInt']>;
  lockedUntil_lte?: InputMaybe<Scalars['BigInt']>;
  lockedUntil_not?: InputMaybe<Scalars['BigInt']>;
  lockedUntil_not_in?: InputMaybe<Array<Scalars['BigInt']>>;
  principalDeposited?: InputMaybe<Scalars['BigInt']>;
  principalDeposited_gt?: InputMaybe<Scalars['BigInt']>;
  principalDeposited_gte?: InputMaybe<Scalars['BigInt']>;
  principalDeposited_in?: InputMaybe<Array<Scalars['BigInt']>>;
  principalDeposited_lt?: InputMaybe<Scalars['BigInt']>;
  principalDeposited_lte?: InputMaybe<Scalars['BigInt']>;
  principalDeposited_not?: InputMaybe<Scalars['BigInt']>;
  principalDeposited_not_in?: InputMaybe<Array<Scalars['BigInt']>>;
  principalSharePrice?: InputMaybe<Scalars['BigInt']>;
  principalSharePrice_gt?: InputMaybe<Scalars['BigInt']>;
  principalSharePrice_gte?: InputMaybe<Scalars['BigInt']>;
  principalSharePrice_in?: InputMaybe<Array<Scalars['BigInt']>>;
  principalSharePrice_lt?: InputMaybe<Scalars['BigInt']>;
  principalSharePrice_lte?: InputMaybe<Scalars['BigInt']>;
  principalSharePrice_not?: InputMaybe<Scalars['BigInt']>;
  principalSharePrice_not_in?: InputMaybe<Array<Scalars['BigInt']>>;
  trancheId?: InputMaybe<Scalars['BigInt']>;
  trancheId_gt?: InputMaybe<Scalars['BigInt']>;
  trancheId_gte?: InputMaybe<Scalars['BigInt']>;
  trancheId_in?: InputMaybe<Array<Scalars['BigInt']>>;
  trancheId_lt?: InputMaybe<Scalars['BigInt']>;
  trancheId_lte?: InputMaybe<Scalars['BigInt']>;
  trancheId_not?: InputMaybe<Scalars['BigInt']>;
  trancheId_not_in?: InputMaybe<Array<Scalars['BigInt']>>;
  tranchedPool?: InputMaybe<Scalars['String']>;
  tranchedPool_contains?: InputMaybe<Scalars['String']>;
  tranchedPool_ends_with?: InputMaybe<Scalars['String']>;
  tranchedPool_gt?: InputMaybe<Scalars['String']>;
  tranchedPool_gte?: InputMaybe<Scalars['String']>;
  tranchedPool_in?: InputMaybe<Array<Scalars['String']>>;
  tranchedPool_lt?: InputMaybe<Scalars['String']>;
  tranchedPool_lte?: InputMaybe<Scalars['String']>;
  tranchedPool_not?: InputMaybe<Scalars['String']>;
  tranchedPool_not_contains?: InputMaybe<Scalars['String']>;
  tranchedPool_not_ends_with?: InputMaybe<Scalars['String']>;
  tranchedPool_not_in?: InputMaybe<Array<Scalars['String']>>;
  tranchedPool_not_starts_with?: InputMaybe<Scalars['String']>;
  tranchedPool_starts_with?: InputMaybe<Scalars['String']>;
};

export enum JuniorTrancheInfo_OrderBy {
  Id = 'id',
  InterestSharePrice = 'interestSharePrice',
  LockedUntil = 'lockedUntil',
  PrincipalDeposited = 'principalDeposited',
  PrincipalSharePrice = 'principalSharePrice',
  TrancheId = 'trancheId',
  TranchedPool = 'tranchedPool'
}

/** Defines the order direction, either ascending or descending */
export enum OrderDirection {
  Asc = 'asc',
  Desc = 'desc'
}

export type PoolBacker = {
  __typename?: 'PoolBacker';
  availableToWithdraw: Scalars['BigInt'];
  balance: Scalars['BigInt'];
  id: Scalars['ID'];
  interestRedeemable: Scalars['BigInt'];
  interestRedeemed: Scalars['BigInt'];
  principalAmount: Scalars['BigInt'];
  principalAtRisk: Scalars['BigInt'];
  principalRedeemable: Scalars['BigInt'];
  principalRedeemed: Scalars['BigInt'];
  tranchedPool: TranchedPool;
  unrealizedGains: Scalars['BigInt'];
  user: User;
};

export type PoolBacker_Filter = {
  availableToWithdraw?: InputMaybe<Scalars['BigInt']>;
  availableToWithdraw_gt?: InputMaybe<Scalars['BigInt']>;
  availableToWithdraw_gte?: InputMaybe<Scalars['BigInt']>;
  availableToWithdraw_in?: InputMaybe<Array<Scalars['BigInt']>>;
  availableToWithdraw_lt?: InputMaybe<Scalars['BigInt']>;
  availableToWithdraw_lte?: InputMaybe<Scalars['BigInt']>;
  availableToWithdraw_not?: InputMaybe<Scalars['BigInt']>;
  availableToWithdraw_not_in?: InputMaybe<Array<Scalars['BigInt']>>;
  balance?: InputMaybe<Scalars['BigInt']>;
  balance_gt?: InputMaybe<Scalars['BigInt']>;
  balance_gte?: InputMaybe<Scalars['BigInt']>;
  balance_in?: InputMaybe<Array<Scalars['BigInt']>>;
  balance_lt?: InputMaybe<Scalars['BigInt']>;
  balance_lte?: InputMaybe<Scalars['BigInt']>;
  balance_not?: InputMaybe<Scalars['BigInt']>;
  balance_not_in?: InputMaybe<Array<Scalars['BigInt']>>;
  id?: InputMaybe<Scalars['ID']>;
  id_gt?: InputMaybe<Scalars['ID']>;
  id_gte?: InputMaybe<Scalars['ID']>;
  id_in?: InputMaybe<Array<Scalars['ID']>>;
  id_lt?: InputMaybe<Scalars['ID']>;
  id_lte?: InputMaybe<Scalars['ID']>;
  id_not?: InputMaybe<Scalars['ID']>;
  id_not_in?: InputMaybe<Array<Scalars['ID']>>;
  interestRedeemable?: InputMaybe<Scalars['BigInt']>;
  interestRedeemable_gt?: InputMaybe<Scalars['BigInt']>;
  interestRedeemable_gte?: InputMaybe<Scalars['BigInt']>;
  interestRedeemable_in?: InputMaybe<Array<Scalars['BigInt']>>;
  interestRedeemable_lt?: InputMaybe<Scalars['BigInt']>;
  interestRedeemable_lte?: InputMaybe<Scalars['BigInt']>;
  interestRedeemable_not?: InputMaybe<Scalars['BigInt']>;
  interestRedeemable_not_in?: InputMaybe<Array<Scalars['BigInt']>>;
  interestRedeemed?: InputMaybe<Scalars['BigInt']>;
  interestRedeemed_gt?: InputMaybe<Scalars['BigInt']>;
  interestRedeemed_gte?: InputMaybe<Scalars['BigInt']>;
  interestRedeemed_in?: InputMaybe<Array<Scalars['BigInt']>>;
  interestRedeemed_lt?: InputMaybe<Scalars['BigInt']>;
  interestRedeemed_lte?: InputMaybe<Scalars['BigInt']>;
  interestRedeemed_not?: InputMaybe<Scalars['BigInt']>;
  interestRedeemed_not_in?: InputMaybe<Array<Scalars['BigInt']>>;
  principalAmount?: InputMaybe<Scalars['BigInt']>;
  principalAmount_gt?: InputMaybe<Scalars['BigInt']>;
  principalAmount_gte?: InputMaybe<Scalars['BigInt']>;
  principalAmount_in?: InputMaybe<Array<Scalars['BigInt']>>;
  principalAmount_lt?: InputMaybe<Scalars['BigInt']>;
  principalAmount_lte?: InputMaybe<Scalars['BigInt']>;
  principalAmount_not?: InputMaybe<Scalars['BigInt']>;
  principalAmount_not_in?: InputMaybe<Array<Scalars['BigInt']>>;
  principalAtRisk?: InputMaybe<Scalars['BigInt']>;
  principalAtRisk_gt?: InputMaybe<Scalars['BigInt']>;
  principalAtRisk_gte?: InputMaybe<Scalars['BigInt']>;
  principalAtRisk_in?: InputMaybe<Array<Scalars['BigInt']>>;
  principalAtRisk_lt?: InputMaybe<Scalars['BigInt']>;
  principalAtRisk_lte?: InputMaybe<Scalars['BigInt']>;
  principalAtRisk_not?: InputMaybe<Scalars['BigInt']>;
  principalAtRisk_not_in?: InputMaybe<Array<Scalars['BigInt']>>;
  principalRedeemable?: InputMaybe<Scalars['BigInt']>;
  principalRedeemable_gt?: InputMaybe<Scalars['BigInt']>;
  principalRedeemable_gte?: InputMaybe<Scalars['BigInt']>;
  principalRedeemable_in?: InputMaybe<Array<Scalars['BigInt']>>;
  principalRedeemable_lt?: InputMaybe<Scalars['BigInt']>;
  principalRedeemable_lte?: InputMaybe<Scalars['BigInt']>;
  principalRedeemable_not?: InputMaybe<Scalars['BigInt']>;
  principalRedeemable_not_in?: InputMaybe<Array<Scalars['BigInt']>>;
  principalRedeemed?: InputMaybe<Scalars['BigInt']>;
  principalRedeemed_gt?: InputMaybe<Scalars['BigInt']>;
  principalRedeemed_gte?: InputMaybe<Scalars['BigInt']>;
  principalRedeemed_in?: InputMaybe<Array<Scalars['BigInt']>>;
  principalRedeemed_lt?: InputMaybe<Scalars['BigInt']>;
  principalRedeemed_lte?: InputMaybe<Scalars['BigInt']>;
  principalRedeemed_not?: InputMaybe<Scalars['BigInt']>;
  principalRedeemed_not_in?: InputMaybe<Array<Scalars['BigInt']>>;
  tranchedPool?: InputMaybe<Scalars['String']>;
  tranchedPool_contains?: InputMaybe<Scalars['String']>;
  tranchedPool_ends_with?: InputMaybe<Scalars['String']>;
  tranchedPool_gt?: InputMaybe<Scalars['String']>;
  tranchedPool_gte?: InputMaybe<Scalars['String']>;
  tranchedPool_in?: InputMaybe<Array<Scalars['String']>>;
  tranchedPool_lt?: InputMaybe<Scalars['String']>;
  tranchedPool_lte?: InputMaybe<Scalars['String']>;
  tranchedPool_not?: InputMaybe<Scalars['String']>;
  tranchedPool_not_contains?: InputMaybe<Scalars['String']>;
  tranchedPool_not_ends_with?: InputMaybe<Scalars['String']>;
  tranchedPool_not_in?: InputMaybe<Array<Scalars['String']>>;
  tranchedPool_not_starts_with?: InputMaybe<Scalars['String']>;
  tranchedPool_starts_with?: InputMaybe<Scalars['String']>;
  unrealizedGains?: InputMaybe<Scalars['BigInt']>;
  unrealizedGains_gt?: InputMaybe<Scalars['BigInt']>;
  unrealizedGains_gte?: InputMaybe<Scalars['BigInt']>;
  unrealizedGains_in?: InputMaybe<Array<Scalars['BigInt']>>;
  unrealizedGains_lt?: InputMaybe<Scalars['BigInt']>;
  unrealizedGains_lte?: InputMaybe<Scalars['BigInt']>;
  unrealizedGains_not?: InputMaybe<Scalars['BigInt']>;
  unrealizedGains_not_in?: InputMaybe<Array<Scalars['BigInt']>>;
  user?: InputMaybe<Scalars['String']>;
  user_contains?: InputMaybe<Scalars['String']>;
  user_ends_with?: InputMaybe<Scalars['String']>;
  user_gt?: InputMaybe<Scalars['String']>;
  user_gte?: InputMaybe<Scalars['String']>;
  user_in?: InputMaybe<Array<Scalars['String']>>;
  user_lt?: InputMaybe<Scalars['String']>;
  user_lte?: InputMaybe<Scalars['String']>;
  user_not?: InputMaybe<Scalars['String']>;
  user_not_contains?: InputMaybe<Scalars['String']>;
  user_not_ends_with?: InputMaybe<Scalars['String']>;
  user_not_in?: InputMaybe<Array<Scalars['String']>>;
  user_not_starts_with?: InputMaybe<Scalars['String']>;
  user_starts_with?: InputMaybe<Scalars['String']>;
};

export enum PoolBacker_OrderBy {
  AvailableToWithdraw = 'availableToWithdraw',
  Balance = 'balance',
  Id = 'id',
  InterestRedeemable = 'interestRedeemable',
  InterestRedeemed = 'interestRedeemed',
  PrincipalAmount = 'principalAmount',
  PrincipalAtRisk = 'principalAtRisk',
  PrincipalRedeemable = 'principalRedeemable',
  PrincipalRedeemed = 'principalRedeemed',
  TranchedPool = 'tranchedPool',
  UnrealizedGains = 'unrealizedGains',
  User = 'user'
}

export type Query = {
  __typename?: 'Query';
  /** Access to subgraph metadata */
  _meta?: Maybe<_Meta_>;
  capitalProviderStatus?: Maybe<CapitalProviderStatus>;
  capitalProviderStatuses: Array<CapitalProviderStatus>;
  creditLine?: Maybe<CreditLine>;
  creditLines: Array<CreditLine>;
  juniorTrancheInfo?: Maybe<JuniorTrancheInfo>;
  juniorTrancheInfos: Array<JuniorTrancheInfo>;
  poolBacker?: Maybe<PoolBacker>;
  poolBackers: Array<PoolBacker>;
  seniorPool?: Maybe<SeniorPool>;
  seniorPoolDeposit?: Maybe<SeniorPoolDeposit>;
  seniorPoolDeposits: Array<SeniorPoolDeposit>;
  seniorPoolStatus?: Maybe<SeniorPoolStatus>;
  seniorPoolStatuses: Array<SeniorPoolStatus>;
  seniorPools: Array<SeniorPool>;
  seniorTrancheInfo?: Maybe<SeniorTrancheInfo>;
  seniorTrancheInfos: Array<SeniorTrancheInfo>;
  stakingRewards: Array<StakingRewards>;
  tranchedPool?: Maybe<TranchedPool>;
  tranchedPoolDeposit?: Maybe<TranchedPoolDeposit>;
  tranchedPoolDeposits: Array<TranchedPoolDeposit>;
  tranchedPoolToken?: Maybe<TranchedPoolToken>;
  tranchedPoolTokens: Array<TranchedPoolToken>;
  tranchedPools: Array<TranchedPool>;
  user?: Maybe<User>;
  users: Array<User>;
};


export type Query_MetaArgs = {
  block?: InputMaybe<Block_Height>;
};


export type QueryCapitalProviderStatusArgs = {
  block?: InputMaybe<Block_Height>;
  id: Scalars['ID'];
  subgraphError?: _SubgraphErrorPolicy_;
};


export type QueryCapitalProviderStatusesArgs = {
  block?: InputMaybe<Block_Height>;
  first?: InputMaybe<Scalars['Int']>;
  orderBy?: InputMaybe<CapitalProviderStatus_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']>;
  subgraphError?: _SubgraphErrorPolicy_;
  where?: InputMaybe<CapitalProviderStatus_Filter>;
};


export type QueryCreditLineArgs = {
  block?: InputMaybe<Block_Height>;
  id: Scalars['ID'];
  subgraphError?: _SubgraphErrorPolicy_;
};


export type QueryCreditLinesArgs = {
  block?: InputMaybe<Block_Height>;
  first?: InputMaybe<Scalars['Int']>;
  orderBy?: InputMaybe<CreditLine_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']>;
  subgraphError?: _SubgraphErrorPolicy_;
  where?: InputMaybe<CreditLine_Filter>;
};


export type QueryJuniorTrancheInfoArgs = {
  block?: InputMaybe<Block_Height>;
  id: Scalars['ID'];
  subgraphError?: _SubgraphErrorPolicy_;
};


export type QueryJuniorTrancheInfosArgs = {
  block?: InputMaybe<Block_Height>;
  first?: InputMaybe<Scalars['Int']>;
  orderBy?: InputMaybe<JuniorTrancheInfo_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']>;
  subgraphError?: _SubgraphErrorPolicy_;
  where?: InputMaybe<JuniorTrancheInfo_Filter>;
};


export type QueryPoolBackerArgs = {
  block?: InputMaybe<Block_Height>;
  id: Scalars['ID'];
  subgraphError?: _SubgraphErrorPolicy_;
};


export type QueryPoolBackersArgs = {
  block?: InputMaybe<Block_Height>;
  first?: InputMaybe<Scalars['Int']>;
  orderBy?: InputMaybe<PoolBacker_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']>;
  subgraphError?: _SubgraphErrorPolicy_;
  where?: InputMaybe<PoolBacker_Filter>;
};


export type QuerySeniorPoolArgs = {
  block?: InputMaybe<Block_Height>;
  id: Scalars['ID'];
  subgraphError?: _SubgraphErrorPolicy_;
};


export type QuerySeniorPoolDepositArgs = {
  block?: InputMaybe<Block_Height>;
  id: Scalars['ID'];
  subgraphError?: _SubgraphErrorPolicy_;
};


export type QuerySeniorPoolDepositsArgs = {
  block?: InputMaybe<Block_Height>;
  first?: InputMaybe<Scalars['Int']>;
  orderBy?: InputMaybe<SeniorPoolDeposit_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']>;
  subgraphError?: _SubgraphErrorPolicy_;
  where?: InputMaybe<SeniorPoolDeposit_Filter>;
};


export type QuerySeniorPoolStatusArgs = {
  block?: InputMaybe<Block_Height>;
  id: Scalars['ID'];
  subgraphError?: _SubgraphErrorPolicy_;
};


export type QuerySeniorPoolStatusesArgs = {
  block?: InputMaybe<Block_Height>;
  first?: InputMaybe<Scalars['Int']>;
  orderBy?: InputMaybe<SeniorPoolStatus_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']>;
  subgraphError?: _SubgraphErrorPolicy_;
  where?: InputMaybe<SeniorPoolStatus_Filter>;
};


export type QuerySeniorPoolsArgs = {
  block?: InputMaybe<Block_Height>;
  first?: InputMaybe<Scalars['Int']>;
  orderBy?: InputMaybe<SeniorPool_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']>;
  subgraphError?: _SubgraphErrorPolicy_;
  where?: InputMaybe<SeniorPool_Filter>;
};


export type QuerySeniorTrancheInfoArgs = {
  block?: InputMaybe<Block_Height>;
  id: Scalars['ID'];
  subgraphError?: _SubgraphErrorPolicy_;
};


export type QuerySeniorTrancheInfosArgs = {
  block?: InputMaybe<Block_Height>;
  first?: InputMaybe<Scalars['Int']>;
  orderBy?: InputMaybe<SeniorTrancheInfo_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']>;
  subgraphError?: _SubgraphErrorPolicy_;
  where?: InputMaybe<SeniorTrancheInfo_Filter>;
};


export type QueryStakingRewardsArgs = {
  block?: InputMaybe<Block_Height>;
  first?: InputMaybe<Scalars['Int']>;
  orderBy?: InputMaybe<StakingRewards_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']>;
  subgraphError?: _SubgraphErrorPolicy_;
  where?: InputMaybe<StakingRewards_Filter>;
};


export type QueryTranchedPoolArgs = {
  block?: InputMaybe<Block_Height>;
  id: Scalars['ID'];
  subgraphError?: _SubgraphErrorPolicy_;
};


export type QueryTranchedPoolDepositArgs = {
  block?: InputMaybe<Block_Height>;
  id: Scalars['ID'];
  subgraphError?: _SubgraphErrorPolicy_;
};


export type QueryTranchedPoolDepositsArgs = {
  block?: InputMaybe<Block_Height>;
  first?: InputMaybe<Scalars['Int']>;
  orderBy?: InputMaybe<TranchedPoolDeposit_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']>;
  subgraphError?: _SubgraphErrorPolicy_;
  where?: InputMaybe<TranchedPoolDeposit_Filter>;
};


export type QueryTranchedPoolTokenArgs = {
  block?: InputMaybe<Block_Height>;
  id: Scalars['ID'];
  subgraphError?: _SubgraphErrorPolicy_;
};


export type QueryTranchedPoolTokensArgs = {
  block?: InputMaybe<Block_Height>;
  first?: InputMaybe<Scalars['Int']>;
  orderBy?: InputMaybe<TranchedPoolToken_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']>;
  subgraphError?: _SubgraphErrorPolicy_;
  where?: InputMaybe<TranchedPoolToken_Filter>;
};


export type QueryTranchedPoolsArgs = {
  block?: InputMaybe<Block_Height>;
  first?: InputMaybe<Scalars['Int']>;
  orderBy?: InputMaybe<TranchedPool_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']>;
  subgraphError?: _SubgraphErrorPolicy_;
  where?: InputMaybe<TranchedPool_Filter>;
};


export type QueryUserArgs = {
  block?: InputMaybe<Block_Height>;
  id: Scalars['ID'];
  subgraphError?: _SubgraphErrorPolicy_;
};


export type QueryUsersArgs = {
  block?: InputMaybe<Block_Height>;
  first?: InputMaybe<Scalars['Int']>;
  orderBy?: InputMaybe<User_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']>;
  subgraphError?: _SubgraphErrorPolicy_;
  where?: InputMaybe<User_Filter>;
};

/**
 * Notes
 * - address are mapped as IDs
 * - We are using reverse lookups to create virtual fields:
 *   https://thegraph.com/docs/developer/create-subgraph-hosted#reverse-lookups
 *
 */
export type SeniorPool = {
  __typename?: 'SeniorPool';
  capitalProviders: Array<User>;
  category: Scalars['String'];
  icon: Scalars['String'];
  id: Scalars['ID'];
  investmentsMade: Array<TranchedPool>;
  latestPoolStatus: SeniorPoolStatus;
  name: Scalars['String'];
};


/**
 * Notes
 * - address are mapped as IDs
 * - We are using reverse lookups to create virtual fields:
 *   https://thegraph.com/docs/developer/create-subgraph-hosted#reverse-lookups
 *
 */
export type SeniorPoolCapitalProvidersArgs = {
  first?: InputMaybe<Scalars['Int']>;
  orderBy?: InputMaybe<User_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']>;
  where?: InputMaybe<User_Filter>;
};


/**
 * Notes
 * - address are mapped as IDs
 * - We are using reverse lookups to create virtual fields:
 *   https://thegraph.com/docs/developer/create-subgraph-hosted#reverse-lookups
 *
 */
export type SeniorPoolInvestmentsMadeArgs = {
  first?: InputMaybe<Scalars['Int']>;
  orderBy?: InputMaybe<TranchedPool_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']>;
  where?: InputMaybe<TranchedPool_Filter>;
};

export type SeniorPoolDeposit = {
  __typename?: 'SeniorPoolDeposit';
  amount: Scalars['BigInt'];
  blockNumber: Scalars['BigInt'];
  /**
   * tx hash
   *
   */
  id: Scalars['ID'];
  shares: Scalars['BigInt'];
  timestamp: Scalars['BigInt'];
  user: User;
};

export type SeniorPoolDeposit_Filter = {
  amount?: InputMaybe<Scalars['BigInt']>;
  amount_gt?: InputMaybe<Scalars['BigInt']>;
  amount_gte?: InputMaybe<Scalars['BigInt']>;
  amount_in?: InputMaybe<Array<Scalars['BigInt']>>;
  amount_lt?: InputMaybe<Scalars['BigInt']>;
  amount_lte?: InputMaybe<Scalars['BigInt']>;
  amount_not?: InputMaybe<Scalars['BigInt']>;
  amount_not_in?: InputMaybe<Array<Scalars['BigInt']>>;
  blockNumber?: InputMaybe<Scalars['BigInt']>;
  blockNumber_gt?: InputMaybe<Scalars['BigInt']>;
  blockNumber_gte?: InputMaybe<Scalars['BigInt']>;
  blockNumber_in?: InputMaybe<Array<Scalars['BigInt']>>;
  blockNumber_lt?: InputMaybe<Scalars['BigInt']>;
  blockNumber_lte?: InputMaybe<Scalars['BigInt']>;
  blockNumber_not?: InputMaybe<Scalars['BigInt']>;
  blockNumber_not_in?: InputMaybe<Array<Scalars['BigInt']>>;
  id?: InputMaybe<Scalars['ID']>;
  id_gt?: InputMaybe<Scalars['ID']>;
  id_gte?: InputMaybe<Scalars['ID']>;
  id_in?: InputMaybe<Array<Scalars['ID']>>;
  id_lt?: InputMaybe<Scalars['ID']>;
  id_lte?: InputMaybe<Scalars['ID']>;
  id_not?: InputMaybe<Scalars['ID']>;
  id_not_in?: InputMaybe<Array<Scalars['ID']>>;
  shares?: InputMaybe<Scalars['BigInt']>;
  shares_gt?: InputMaybe<Scalars['BigInt']>;
  shares_gte?: InputMaybe<Scalars['BigInt']>;
  shares_in?: InputMaybe<Array<Scalars['BigInt']>>;
  shares_lt?: InputMaybe<Scalars['BigInt']>;
  shares_lte?: InputMaybe<Scalars['BigInt']>;
  shares_not?: InputMaybe<Scalars['BigInt']>;
  shares_not_in?: InputMaybe<Array<Scalars['BigInt']>>;
  timestamp?: InputMaybe<Scalars['BigInt']>;
  timestamp_gt?: InputMaybe<Scalars['BigInt']>;
  timestamp_gte?: InputMaybe<Scalars['BigInt']>;
  timestamp_in?: InputMaybe<Array<Scalars['BigInt']>>;
  timestamp_lt?: InputMaybe<Scalars['BigInt']>;
  timestamp_lte?: InputMaybe<Scalars['BigInt']>;
  timestamp_not?: InputMaybe<Scalars['BigInt']>;
  timestamp_not_in?: InputMaybe<Array<Scalars['BigInt']>>;
  user?: InputMaybe<Scalars['String']>;
  user_contains?: InputMaybe<Scalars['String']>;
  user_ends_with?: InputMaybe<Scalars['String']>;
  user_gt?: InputMaybe<Scalars['String']>;
  user_gte?: InputMaybe<Scalars['String']>;
  user_in?: InputMaybe<Array<Scalars['String']>>;
  user_lt?: InputMaybe<Scalars['String']>;
  user_lte?: InputMaybe<Scalars['String']>;
  user_not?: InputMaybe<Scalars['String']>;
  user_not_contains?: InputMaybe<Scalars['String']>;
  user_not_ends_with?: InputMaybe<Scalars['String']>;
  user_not_in?: InputMaybe<Array<Scalars['String']>>;
  user_not_starts_with?: InputMaybe<Scalars['String']>;
  user_starts_with?: InputMaybe<Scalars['String']>;
};

export enum SeniorPoolDeposit_OrderBy {
  Amount = 'amount',
  BlockNumber = 'blockNumber',
  Id = 'id',
  Shares = 'shares',
  Timestamp = 'timestamp',
  User = 'user'
}

export type SeniorPoolStatus = {
  __typename?: 'SeniorPoolStatus';
  balance: Scalars['BigInt'];
  compoundBalance: Scalars['BigInt'];
  cumulativeDrawdowns: Scalars['BigInt'];
  cumulativeWritedowns: Scalars['BigInt'];
  defaultRate: Scalars['BigInt'];
  estimatedApy: Scalars['BigDecimal'];
  estimatedTotalInterest: Scalars['BigDecimal'];
  /**
   * This entity is a singleton, so the id is always "1"
   *
   */
  id: Scalars['ID'];
  rawBalance: Scalars['BigInt'];
  remainingCapacity?: Maybe<Scalars['BigInt']>;
  sharePrice: Scalars['BigInt'];
  totalLoansOutstanding: Scalars['BigInt'];
  totalPoolAssets: Scalars['BigInt'];
  totalShares: Scalars['BigInt'];
  tranchedPools: Array<TranchedPool>;
};


export type SeniorPoolStatusTranchedPoolsArgs = {
  first?: InputMaybe<Scalars['Int']>;
  orderBy?: InputMaybe<TranchedPool_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']>;
  where?: InputMaybe<TranchedPool_Filter>;
};

export type SeniorPoolStatus_Filter = {
  balance?: InputMaybe<Scalars['BigInt']>;
  balance_gt?: InputMaybe<Scalars['BigInt']>;
  balance_gte?: InputMaybe<Scalars['BigInt']>;
  balance_in?: InputMaybe<Array<Scalars['BigInt']>>;
  balance_lt?: InputMaybe<Scalars['BigInt']>;
  balance_lte?: InputMaybe<Scalars['BigInt']>;
  balance_not?: InputMaybe<Scalars['BigInt']>;
  balance_not_in?: InputMaybe<Array<Scalars['BigInt']>>;
  compoundBalance?: InputMaybe<Scalars['BigInt']>;
  compoundBalance_gt?: InputMaybe<Scalars['BigInt']>;
  compoundBalance_gte?: InputMaybe<Scalars['BigInt']>;
  compoundBalance_in?: InputMaybe<Array<Scalars['BigInt']>>;
  compoundBalance_lt?: InputMaybe<Scalars['BigInt']>;
  compoundBalance_lte?: InputMaybe<Scalars['BigInt']>;
  compoundBalance_not?: InputMaybe<Scalars['BigInt']>;
  compoundBalance_not_in?: InputMaybe<Array<Scalars['BigInt']>>;
  cumulativeDrawdowns?: InputMaybe<Scalars['BigInt']>;
  cumulativeDrawdowns_gt?: InputMaybe<Scalars['BigInt']>;
  cumulativeDrawdowns_gte?: InputMaybe<Scalars['BigInt']>;
  cumulativeDrawdowns_in?: InputMaybe<Array<Scalars['BigInt']>>;
  cumulativeDrawdowns_lt?: InputMaybe<Scalars['BigInt']>;
  cumulativeDrawdowns_lte?: InputMaybe<Scalars['BigInt']>;
  cumulativeDrawdowns_not?: InputMaybe<Scalars['BigInt']>;
  cumulativeDrawdowns_not_in?: InputMaybe<Array<Scalars['BigInt']>>;
  cumulativeWritedowns?: InputMaybe<Scalars['BigInt']>;
  cumulativeWritedowns_gt?: InputMaybe<Scalars['BigInt']>;
  cumulativeWritedowns_gte?: InputMaybe<Scalars['BigInt']>;
  cumulativeWritedowns_in?: InputMaybe<Array<Scalars['BigInt']>>;
  cumulativeWritedowns_lt?: InputMaybe<Scalars['BigInt']>;
  cumulativeWritedowns_lte?: InputMaybe<Scalars['BigInt']>;
  cumulativeWritedowns_not?: InputMaybe<Scalars['BigInt']>;
  cumulativeWritedowns_not_in?: InputMaybe<Array<Scalars['BigInt']>>;
  defaultRate?: InputMaybe<Scalars['BigInt']>;
  defaultRate_gt?: InputMaybe<Scalars['BigInt']>;
  defaultRate_gte?: InputMaybe<Scalars['BigInt']>;
  defaultRate_in?: InputMaybe<Array<Scalars['BigInt']>>;
  defaultRate_lt?: InputMaybe<Scalars['BigInt']>;
  defaultRate_lte?: InputMaybe<Scalars['BigInt']>;
  defaultRate_not?: InputMaybe<Scalars['BigInt']>;
  defaultRate_not_in?: InputMaybe<Array<Scalars['BigInt']>>;
  estimatedApy?: InputMaybe<Scalars['BigDecimal']>;
  estimatedApy_gt?: InputMaybe<Scalars['BigDecimal']>;
  estimatedApy_gte?: InputMaybe<Scalars['BigDecimal']>;
  estimatedApy_in?: InputMaybe<Array<Scalars['BigDecimal']>>;
  estimatedApy_lt?: InputMaybe<Scalars['BigDecimal']>;
  estimatedApy_lte?: InputMaybe<Scalars['BigDecimal']>;
  estimatedApy_not?: InputMaybe<Scalars['BigDecimal']>;
  estimatedApy_not_in?: InputMaybe<Array<Scalars['BigDecimal']>>;
  estimatedTotalInterest?: InputMaybe<Scalars['BigDecimal']>;
  estimatedTotalInterest_gt?: InputMaybe<Scalars['BigDecimal']>;
  estimatedTotalInterest_gte?: InputMaybe<Scalars['BigDecimal']>;
  estimatedTotalInterest_in?: InputMaybe<Array<Scalars['BigDecimal']>>;
  estimatedTotalInterest_lt?: InputMaybe<Scalars['BigDecimal']>;
  estimatedTotalInterest_lte?: InputMaybe<Scalars['BigDecimal']>;
  estimatedTotalInterest_not?: InputMaybe<Scalars['BigDecimal']>;
  estimatedTotalInterest_not_in?: InputMaybe<Array<Scalars['BigDecimal']>>;
  id?: InputMaybe<Scalars['ID']>;
  id_gt?: InputMaybe<Scalars['ID']>;
  id_gte?: InputMaybe<Scalars['ID']>;
  id_in?: InputMaybe<Array<Scalars['ID']>>;
  id_lt?: InputMaybe<Scalars['ID']>;
  id_lte?: InputMaybe<Scalars['ID']>;
  id_not?: InputMaybe<Scalars['ID']>;
  id_not_in?: InputMaybe<Array<Scalars['ID']>>;
  rawBalance?: InputMaybe<Scalars['BigInt']>;
  rawBalance_gt?: InputMaybe<Scalars['BigInt']>;
  rawBalance_gte?: InputMaybe<Scalars['BigInt']>;
  rawBalance_in?: InputMaybe<Array<Scalars['BigInt']>>;
  rawBalance_lt?: InputMaybe<Scalars['BigInt']>;
  rawBalance_lte?: InputMaybe<Scalars['BigInt']>;
  rawBalance_not?: InputMaybe<Scalars['BigInt']>;
  rawBalance_not_in?: InputMaybe<Array<Scalars['BigInt']>>;
  remainingCapacity?: InputMaybe<Scalars['BigInt']>;
  remainingCapacity_gt?: InputMaybe<Scalars['BigInt']>;
  remainingCapacity_gte?: InputMaybe<Scalars['BigInt']>;
  remainingCapacity_in?: InputMaybe<Array<Scalars['BigInt']>>;
  remainingCapacity_lt?: InputMaybe<Scalars['BigInt']>;
  remainingCapacity_lte?: InputMaybe<Scalars['BigInt']>;
  remainingCapacity_not?: InputMaybe<Scalars['BigInt']>;
  remainingCapacity_not_in?: InputMaybe<Array<Scalars['BigInt']>>;
  sharePrice?: InputMaybe<Scalars['BigInt']>;
  sharePrice_gt?: InputMaybe<Scalars['BigInt']>;
  sharePrice_gte?: InputMaybe<Scalars['BigInt']>;
  sharePrice_in?: InputMaybe<Array<Scalars['BigInt']>>;
  sharePrice_lt?: InputMaybe<Scalars['BigInt']>;
  sharePrice_lte?: InputMaybe<Scalars['BigInt']>;
  sharePrice_not?: InputMaybe<Scalars['BigInt']>;
  sharePrice_not_in?: InputMaybe<Array<Scalars['BigInt']>>;
  totalLoansOutstanding?: InputMaybe<Scalars['BigInt']>;
  totalLoansOutstanding_gt?: InputMaybe<Scalars['BigInt']>;
  totalLoansOutstanding_gte?: InputMaybe<Scalars['BigInt']>;
  totalLoansOutstanding_in?: InputMaybe<Array<Scalars['BigInt']>>;
  totalLoansOutstanding_lt?: InputMaybe<Scalars['BigInt']>;
  totalLoansOutstanding_lte?: InputMaybe<Scalars['BigInt']>;
  totalLoansOutstanding_not?: InputMaybe<Scalars['BigInt']>;
  totalLoansOutstanding_not_in?: InputMaybe<Array<Scalars['BigInt']>>;
  totalPoolAssets?: InputMaybe<Scalars['BigInt']>;
  totalPoolAssets_gt?: InputMaybe<Scalars['BigInt']>;
  totalPoolAssets_gte?: InputMaybe<Scalars['BigInt']>;
  totalPoolAssets_in?: InputMaybe<Array<Scalars['BigInt']>>;
  totalPoolAssets_lt?: InputMaybe<Scalars['BigInt']>;
  totalPoolAssets_lte?: InputMaybe<Scalars['BigInt']>;
  totalPoolAssets_not?: InputMaybe<Scalars['BigInt']>;
  totalPoolAssets_not_in?: InputMaybe<Array<Scalars['BigInt']>>;
  totalShares?: InputMaybe<Scalars['BigInt']>;
  totalShares_gt?: InputMaybe<Scalars['BigInt']>;
  totalShares_gte?: InputMaybe<Scalars['BigInt']>;
  totalShares_in?: InputMaybe<Array<Scalars['BigInt']>>;
  totalShares_lt?: InputMaybe<Scalars['BigInt']>;
  totalShares_lte?: InputMaybe<Scalars['BigInt']>;
  totalShares_not?: InputMaybe<Scalars['BigInt']>;
  totalShares_not_in?: InputMaybe<Array<Scalars['BigInt']>>;
  tranchedPools?: InputMaybe<Array<Scalars['String']>>;
  tranchedPools_contains?: InputMaybe<Array<Scalars['String']>>;
  tranchedPools_not?: InputMaybe<Array<Scalars['String']>>;
  tranchedPools_not_contains?: InputMaybe<Array<Scalars['String']>>;
};

export enum SeniorPoolStatus_OrderBy {
  Balance = 'balance',
  CompoundBalance = 'compoundBalance',
  CumulativeDrawdowns = 'cumulativeDrawdowns',
  CumulativeWritedowns = 'cumulativeWritedowns',
  DefaultRate = 'defaultRate',
  EstimatedApy = 'estimatedApy',
  EstimatedTotalInterest = 'estimatedTotalInterest',
  Id = 'id',
  RawBalance = 'rawBalance',
  RemainingCapacity = 'remainingCapacity',
  SharePrice = 'sharePrice',
  TotalLoansOutstanding = 'totalLoansOutstanding',
  TotalPoolAssets = 'totalPoolAssets',
  TotalShares = 'totalShares',
  TranchedPools = 'tranchedPools'
}

export type SeniorPool_Filter = {
  capitalProviders?: InputMaybe<Array<Scalars['String']>>;
  capitalProviders_contains?: InputMaybe<Array<Scalars['String']>>;
  capitalProviders_not?: InputMaybe<Array<Scalars['String']>>;
  capitalProviders_not_contains?: InputMaybe<Array<Scalars['String']>>;
  id?: InputMaybe<Scalars['ID']>;
  id_gt?: InputMaybe<Scalars['ID']>;
  id_gte?: InputMaybe<Scalars['ID']>;
  id_in?: InputMaybe<Array<Scalars['ID']>>;
  id_lt?: InputMaybe<Scalars['ID']>;
  id_lte?: InputMaybe<Scalars['ID']>;
  id_not?: InputMaybe<Scalars['ID']>;
  id_not_in?: InputMaybe<Array<Scalars['ID']>>;
  investmentsMade?: InputMaybe<Array<Scalars['String']>>;
  investmentsMade_contains?: InputMaybe<Array<Scalars['String']>>;
  investmentsMade_not?: InputMaybe<Array<Scalars['String']>>;
  investmentsMade_not_contains?: InputMaybe<Array<Scalars['String']>>;
  latestPoolStatus?: InputMaybe<Scalars['String']>;
  latestPoolStatus_contains?: InputMaybe<Scalars['String']>;
  latestPoolStatus_ends_with?: InputMaybe<Scalars['String']>;
  latestPoolStatus_gt?: InputMaybe<Scalars['String']>;
  latestPoolStatus_gte?: InputMaybe<Scalars['String']>;
  latestPoolStatus_in?: InputMaybe<Array<Scalars['String']>>;
  latestPoolStatus_lt?: InputMaybe<Scalars['String']>;
  latestPoolStatus_lte?: InputMaybe<Scalars['String']>;
  latestPoolStatus_not?: InputMaybe<Scalars['String']>;
  latestPoolStatus_not_contains?: InputMaybe<Scalars['String']>;
  latestPoolStatus_not_ends_with?: InputMaybe<Scalars['String']>;
  latestPoolStatus_not_in?: InputMaybe<Array<Scalars['String']>>;
  latestPoolStatus_not_starts_with?: InputMaybe<Scalars['String']>;
  latestPoolStatus_starts_with?: InputMaybe<Scalars['String']>;
};

export enum SeniorPool_OrderBy {
  CapitalProviders = 'capitalProviders',
  Id = 'id',
  InvestmentsMade = 'investmentsMade',
  LatestPoolStatus = 'latestPoolStatus'
}

export type SeniorTrancheInfo = {
  __typename?: 'SeniorTrancheInfo';
  id: Scalars['ID'];
  interestSharePrice: Scalars['BigInt'];
  lockedUntil: Scalars['BigInt'];
  principalDeposited: Scalars['BigInt'];
  principalSharePrice: Scalars['BigInt'];
  trancheId: Scalars['BigInt'];
  tranchedPool: TranchedPool;
};

export type SeniorTrancheInfo_Filter = {
  id?: InputMaybe<Scalars['ID']>;
  id_gt?: InputMaybe<Scalars['ID']>;
  id_gte?: InputMaybe<Scalars['ID']>;
  id_in?: InputMaybe<Array<Scalars['ID']>>;
  id_lt?: InputMaybe<Scalars['ID']>;
  id_lte?: InputMaybe<Scalars['ID']>;
  id_not?: InputMaybe<Scalars['ID']>;
  id_not_in?: InputMaybe<Array<Scalars['ID']>>;
  interestSharePrice?: InputMaybe<Scalars['BigInt']>;
  interestSharePrice_gt?: InputMaybe<Scalars['BigInt']>;
  interestSharePrice_gte?: InputMaybe<Scalars['BigInt']>;
  interestSharePrice_in?: InputMaybe<Array<Scalars['BigInt']>>;
  interestSharePrice_lt?: InputMaybe<Scalars['BigInt']>;
  interestSharePrice_lte?: InputMaybe<Scalars['BigInt']>;
  interestSharePrice_not?: InputMaybe<Scalars['BigInt']>;
  interestSharePrice_not_in?: InputMaybe<Array<Scalars['BigInt']>>;
  lockedUntil?: InputMaybe<Scalars['BigInt']>;
  lockedUntil_gt?: InputMaybe<Scalars['BigInt']>;
  lockedUntil_gte?: InputMaybe<Scalars['BigInt']>;
  lockedUntil_in?: InputMaybe<Array<Scalars['BigInt']>>;
  lockedUntil_lt?: InputMaybe<Scalars['BigInt']>;
  lockedUntil_lte?: InputMaybe<Scalars['BigInt']>;
  lockedUntil_not?: InputMaybe<Scalars['BigInt']>;
  lockedUntil_not_in?: InputMaybe<Array<Scalars['BigInt']>>;
  principalDeposited?: InputMaybe<Scalars['BigInt']>;
  principalDeposited_gt?: InputMaybe<Scalars['BigInt']>;
  principalDeposited_gte?: InputMaybe<Scalars['BigInt']>;
  principalDeposited_in?: InputMaybe<Array<Scalars['BigInt']>>;
  principalDeposited_lt?: InputMaybe<Scalars['BigInt']>;
  principalDeposited_lte?: InputMaybe<Scalars['BigInt']>;
  principalDeposited_not?: InputMaybe<Scalars['BigInt']>;
  principalDeposited_not_in?: InputMaybe<Array<Scalars['BigInt']>>;
  principalSharePrice?: InputMaybe<Scalars['BigInt']>;
  principalSharePrice_gt?: InputMaybe<Scalars['BigInt']>;
  principalSharePrice_gte?: InputMaybe<Scalars['BigInt']>;
  principalSharePrice_in?: InputMaybe<Array<Scalars['BigInt']>>;
  principalSharePrice_lt?: InputMaybe<Scalars['BigInt']>;
  principalSharePrice_lte?: InputMaybe<Scalars['BigInt']>;
  principalSharePrice_not?: InputMaybe<Scalars['BigInt']>;
  principalSharePrice_not_in?: InputMaybe<Array<Scalars['BigInt']>>;
  trancheId?: InputMaybe<Scalars['BigInt']>;
  trancheId_gt?: InputMaybe<Scalars['BigInt']>;
  trancheId_gte?: InputMaybe<Scalars['BigInt']>;
  trancheId_in?: InputMaybe<Array<Scalars['BigInt']>>;
  trancheId_lt?: InputMaybe<Scalars['BigInt']>;
  trancheId_lte?: InputMaybe<Scalars['BigInt']>;
  trancheId_not?: InputMaybe<Scalars['BigInt']>;
  trancheId_not_in?: InputMaybe<Array<Scalars['BigInt']>>;
  tranchedPool?: InputMaybe<Scalars['String']>;
  tranchedPool_contains?: InputMaybe<Scalars['String']>;
  tranchedPool_ends_with?: InputMaybe<Scalars['String']>;
  tranchedPool_gt?: InputMaybe<Scalars['String']>;
  tranchedPool_gte?: InputMaybe<Scalars['String']>;
  tranchedPool_in?: InputMaybe<Array<Scalars['String']>>;
  tranchedPool_lt?: InputMaybe<Scalars['String']>;
  tranchedPool_lte?: InputMaybe<Scalars['String']>;
  tranchedPool_not?: InputMaybe<Scalars['String']>;
  tranchedPool_not_contains?: InputMaybe<Scalars['String']>;
  tranchedPool_not_ends_with?: InputMaybe<Scalars['String']>;
  tranchedPool_not_in?: InputMaybe<Array<Scalars['String']>>;
  tranchedPool_not_starts_with?: InputMaybe<Scalars['String']>;
  tranchedPool_starts_with?: InputMaybe<Scalars['String']>;
};

export enum SeniorTrancheInfo_OrderBy {
  Id = 'id',
  InterestSharePrice = 'interestSharePrice',
  LockedUntil = 'lockedUntil',
  PrincipalDeposited = 'principalDeposited',
  PrincipalSharePrice = 'principalSharePrice',
  TrancheId = 'trancheId',
  TranchedPool = 'tranchedPool'
}

export type StakingRewards = {
  __typename?: 'StakingRewards';
  currentEarnRatePerToken: Scalars['BigInt'];
  id: Scalars['ID'];
};

export type StakingRewards_Filter = {
  currentEarnRatePerToken?: InputMaybe<Scalars['BigInt']>;
  currentEarnRatePerToken_gt?: InputMaybe<Scalars['BigInt']>;
  currentEarnRatePerToken_gte?: InputMaybe<Scalars['BigInt']>;
  currentEarnRatePerToken_in?: InputMaybe<Array<Scalars['BigInt']>>;
  currentEarnRatePerToken_lt?: InputMaybe<Scalars['BigInt']>;
  currentEarnRatePerToken_lte?: InputMaybe<Scalars['BigInt']>;
  currentEarnRatePerToken_not?: InputMaybe<Scalars['BigInt']>;
  currentEarnRatePerToken_not_in?: InputMaybe<Array<Scalars['BigInt']>>;
  id?: InputMaybe<Scalars['ID']>;
  id_gt?: InputMaybe<Scalars['ID']>;
  id_gte?: InputMaybe<Scalars['ID']>;
  id_in?: InputMaybe<Array<Scalars['ID']>>;
  id_lt?: InputMaybe<Scalars['ID']>;
  id_lte?: InputMaybe<Scalars['ID']>;
  id_not?: InputMaybe<Scalars['ID']>;
  id_not_in?: InputMaybe<Array<Scalars['ID']>>;
};

export enum StakingRewards_OrderBy {
  CurrentEarnRatePerToken = 'currentEarnRatePerToken',
  Id = 'id'
}

export type Subscription = {
  __typename?: 'Subscription';
  /** Access to subgraph metadata */
  _meta?: Maybe<_Meta_>;
  capitalProviderStatus?: Maybe<CapitalProviderStatus>;
  capitalProviderStatuses: Array<CapitalProviderStatus>;
  creditLine?: Maybe<CreditLine>;
  creditLines: Array<CreditLine>;
  juniorTrancheInfo?: Maybe<JuniorTrancheInfo>;
  juniorTrancheInfos: Array<JuniorTrancheInfo>;
  poolBacker?: Maybe<PoolBacker>;
  poolBackers: Array<PoolBacker>;
  seniorPool?: Maybe<SeniorPool>;
  seniorPoolDeposit?: Maybe<SeniorPoolDeposit>;
  seniorPoolDeposits: Array<SeniorPoolDeposit>;
  seniorPoolStatus?: Maybe<SeniorPoolStatus>;
  seniorPoolStatuses: Array<SeniorPoolStatus>;
  seniorPools: Array<SeniorPool>;
  seniorTrancheInfo?: Maybe<SeniorTrancheInfo>;
  seniorTrancheInfos: Array<SeniorTrancheInfo>;
  stakingRewards: Array<StakingRewards>;
  tranchedPool?: Maybe<TranchedPool>;
  tranchedPoolDeposit?: Maybe<TranchedPoolDeposit>;
  tranchedPoolDeposits: Array<TranchedPoolDeposit>;
  tranchedPoolToken?: Maybe<TranchedPoolToken>;
  tranchedPoolTokens: Array<TranchedPoolToken>;
  tranchedPools: Array<TranchedPool>;
  user?: Maybe<User>;
  users: Array<User>;
};


export type Subscription_MetaArgs = {
  block?: InputMaybe<Block_Height>;
};


export type SubscriptionCapitalProviderStatusArgs = {
  block?: InputMaybe<Block_Height>;
  id: Scalars['ID'];
  subgraphError?: _SubgraphErrorPolicy_;
};


export type SubscriptionCapitalProviderStatusesArgs = {
  block?: InputMaybe<Block_Height>;
  first?: InputMaybe<Scalars['Int']>;
  orderBy?: InputMaybe<CapitalProviderStatus_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']>;
  subgraphError?: _SubgraphErrorPolicy_;
  where?: InputMaybe<CapitalProviderStatus_Filter>;
};


export type SubscriptionCreditLineArgs = {
  block?: InputMaybe<Block_Height>;
  id: Scalars['ID'];
  subgraphError?: _SubgraphErrorPolicy_;
};


export type SubscriptionCreditLinesArgs = {
  block?: InputMaybe<Block_Height>;
  first?: InputMaybe<Scalars['Int']>;
  orderBy?: InputMaybe<CreditLine_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']>;
  subgraphError?: _SubgraphErrorPolicy_;
  where?: InputMaybe<CreditLine_Filter>;
};


export type SubscriptionJuniorTrancheInfoArgs = {
  block?: InputMaybe<Block_Height>;
  id: Scalars['ID'];
  subgraphError?: _SubgraphErrorPolicy_;
};


export type SubscriptionJuniorTrancheInfosArgs = {
  block?: InputMaybe<Block_Height>;
  first?: InputMaybe<Scalars['Int']>;
  orderBy?: InputMaybe<JuniorTrancheInfo_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']>;
  subgraphError?: _SubgraphErrorPolicy_;
  where?: InputMaybe<JuniorTrancheInfo_Filter>;
};


export type SubscriptionPoolBackerArgs = {
  block?: InputMaybe<Block_Height>;
  id: Scalars['ID'];
  subgraphError?: _SubgraphErrorPolicy_;
};


export type SubscriptionPoolBackersArgs = {
  block?: InputMaybe<Block_Height>;
  first?: InputMaybe<Scalars['Int']>;
  orderBy?: InputMaybe<PoolBacker_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']>;
  subgraphError?: _SubgraphErrorPolicy_;
  where?: InputMaybe<PoolBacker_Filter>;
};


export type SubscriptionSeniorPoolArgs = {
  block?: InputMaybe<Block_Height>;
  id: Scalars['ID'];
  subgraphError?: _SubgraphErrorPolicy_;
};


export type SubscriptionSeniorPoolDepositArgs = {
  block?: InputMaybe<Block_Height>;
  id: Scalars['ID'];
  subgraphError?: _SubgraphErrorPolicy_;
};


export type SubscriptionSeniorPoolDepositsArgs = {
  block?: InputMaybe<Block_Height>;
  first?: InputMaybe<Scalars['Int']>;
  orderBy?: InputMaybe<SeniorPoolDeposit_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']>;
  subgraphError?: _SubgraphErrorPolicy_;
  where?: InputMaybe<SeniorPoolDeposit_Filter>;
};


export type SubscriptionSeniorPoolStatusArgs = {
  block?: InputMaybe<Block_Height>;
  id: Scalars['ID'];
  subgraphError?: _SubgraphErrorPolicy_;
};


export type SubscriptionSeniorPoolStatusesArgs = {
  block?: InputMaybe<Block_Height>;
  first?: InputMaybe<Scalars['Int']>;
  orderBy?: InputMaybe<SeniorPoolStatus_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']>;
  subgraphError?: _SubgraphErrorPolicy_;
  where?: InputMaybe<SeniorPoolStatus_Filter>;
};


export type SubscriptionSeniorPoolsArgs = {
  block?: InputMaybe<Block_Height>;
  first?: InputMaybe<Scalars['Int']>;
  orderBy?: InputMaybe<SeniorPool_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']>;
  subgraphError?: _SubgraphErrorPolicy_;
  where?: InputMaybe<SeniorPool_Filter>;
};


export type SubscriptionSeniorTrancheInfoArgs = {
  block?: InputMaybe<Block_Height>;
  id: Scalars['ID'];
  subgraphError?: _SubgraphErrorPolicy_;
};


export type SubscriptionSeniorTrancheInfosArgs = {
  block?: InputMaybe<Block_Height>;
  first?: InputMaybe<Scalars['Int']>;
  orderBy?: InputMaybe<SeniorTrancheInfo_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']>;
  subgraphError?: _SubgraphErrorPolicy_;
  where?: InputMaybe<SeniorTrancheInfo_Filter>;
};


export type SubscriptionStakingRewardsArgs = {
  block?: InputMaybe<Block_Height>;
  first?: InputMaybe<Scalars['Int']>;
  orderBy?: InputMaybe<StakingRewards_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']>;
  subgraphError?: _SubgraphErrorPolicy_;
  where?: InputMaybe<StakingRewards_Filter>;
};


export type SubscriptionTranchedPoolArgs = {
  block?: InputMaybe<Block_Height>;
  id: Scalars['ID'];
  subgraphError?: _SubgraphErrorPolicy_;
};


export type SubscriptionTranchedPoolDepositArgs = {
  block?: InputMaybe<Block_Height>;
  id: Scalars['ID'];
  subgraphError?: _SubgraphErrorPolicy_;
};


export type SubscriptionTranchedPoolDepositsArgs = {
  block?: InputMaybe<Block_Height>;
  first?: InputMaybe<Scalars['Int']>;
  orderBy?: InputMaybe<TranchedPoolDeposit_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']>;
  subgraphError?: _SubgraphErrorPolicy_;
  where?: InputMaybe<TranchedPoolDeposit_Filter>;
};


export type SubscriptionTranchedPoolTokenArgs = {
  block?: InputMaybe<Block_Height>;
  id: Scalars['ID'];
  subgraphError?: _SubgraphErrorPolicy_;
};


export type SubscriptionTranchedPoolTokensArgs = {
  block?: InputMaybe<Block_Height>;
  first?: InputMaybe<Scalars['Int']>;
  orderBy?: InputMaybe<TranchedPoolToken_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']>;
  subgraphError?: _SubgraphErrorPolicy_;
  where?: InputMaybe<TranchedPoolToken_Filter>;
};


export type SubscriptionTranchedPoolsArgs = {
  block?: InputMaybe<Block_Height>;
  first?: InputMaybe<Scalars['Int']>;
  orderBy?: InputMaybe<TranchedPool_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']>;
  subgraphError?: _SubgraphErrorPolicy_;
  where?: InputMaybe<TranchedPool_Filter>;
};


export type SubscriptionUserArgs = {
  block?: InputMaybe<Block_Height>;
  id: Scalars['ID'];
  subgraphError?: _SubgraphErrorPolicy_;
};


export type SubscriptionUsersArgs = {
  block?: InputMaybe<Block_Height>;
  first?: InputMaybe<Scalars['Int']>;
  orderBy?: InputMaybe<User_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']>;
  subgraphError?: _SubgraphErrorPolicy_;
  where?: InputMaybe<User_Filter>;
};

export type TranchedPool = {
  __typename?: 'TranchedPool';
  backers: Array<PoolBacker>;
  category?: Maybe<Scalars['String']>;
  creditLine: CreditLine;
  deposits: Array<TranchedPoolDeposit>;
  description?: Maybe<Scalars['String']>;
  estimatedJuniorApy: Scalars['BigInt'];
  estimatedLeverageRatio: Scalars['BigInt'];
  estimatedSeniorPoolContribution: Scalars['BigInt'];
  estimatedTotalAssets: Scalars['BigInt'];
  icon?: Maybe<Scalars['String']>;
  id: Scalars['ID'];
  isPaused: Scalars['Boolean'];
  /**
   * Set to true for tranched pools that were created before the advent of junior/senior tranches. These pools have junior investment only, and they are considered legacy
   *
   */
  isV1StyleDeal: Scalars['Boolean'];
  juniorFeePercent: Scalars['BigInt'];
  juniorTranches: Array<JuniorTrancheInfo>;
  name?: Maybe<Scalars['String']>;
  remainingCapacity: Scalars['BigInt'];
  remainingJuniorCapacity: Scalars['BigInt'];
  reserveFeePercent: Scalars['BigInt'];
  seniorTranches: Array<SeniorTrancheInfo>;
  tokens: Array<TranchedPoolToken>;
  totalDeposited: Scalars['BigInt'];
};


export type TranchedPoolBackersArgs = {
  first?: InputMaybe<Scalars['Int']>;
  orderBy?: InputMaybe<PoolBacker_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']>;
  where?: InputMaybe<PoolBacker_Filter>;
};


export type TranchedPoolDepositsArgs = {
  first?: InputMaybe<Scalars['Int']>;
  orderBy?: InputMaybe<TranchedPoolDeposit_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']>;
  where?: InputMaybe<TranchedPoolDeposit_Filter>;
};


export type TranchedPoolJuniorTranchesArgs = {
  first?: InputMaybe<Scalars['Int']>;
  orderBy?: InputMaybe<JuniorTrancheInfo_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']>;
  where?: InputMaybe<JuniorTrancheInfo_Filter>;
};


export type TranchedPoolSeniorTranchesArgs = {
  first?: InputMaybe<Scalars['Int']>;
  orderBy?: InputMaybe<SeniorTrancheInfo_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']>;
  where?: InputMaybe<SeniorTrancheInfo_Filter>;
};


export type TranchedPoolTokensArgs = {
  first?: InputMaybe<Scalars['Int']>;
  orderBy?: InputMaybe<TranchedPoolToken_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']>;
  where?: InputMaybe<TranchedPoolToken_Filter>;
};

export type TranchedPoolDeposit = {
  __typename?: 'TranchedPoolDeposit';
  amount: Scalars['BigInt'];
  blockNumber: Scalars['BigInt'];
  id: Scalars['ID'];
  timestamp: Scalars['BigInt'];
  tokenId: Scalars['BigInt'];
  tranche: Scalars['BigInt'];
  tranchedPool: TranchedPool;
  user: User;
};

export type TranchedPoolDeposit_Filter = {
  amount?: InputMaybe<Scalars['BigInt']>;
  amount_gt?: InputMaybe<Scalars['BigInt']>;
  amount_gte?: InputMaybe<Scalars['BigInt']>;
  amount_in?: InputMaybe<Array<Scalars['BigInt']>>;
  amount_lt?: InputMaybe<Scalars['BigInt']>;
  amount_lte?: InputMaybe<Scalars['BigInt']>;
  amount_not?: InputMaybe<Scalars['BigInt']>;
  amount_not_in?: InputMaybe<Array<Scalars['BigInt']>>;
  blockNumber?: InputMaybe<Scalars['BigInt']>;
  blockNumber_gt?: InputMaybe<Scalars['BigInt']>;
  blockNumber_gte?: InputMaybe<Scalars['BigInt']>;
  blockNumber_in?: InputMaybe<Array<Scalars['BigInt']>>;
  blockNumber_lt?: InputMaybe<Scalars['BigInt']>;
  blockNumber_lte?: InputMaybe<Scalars['BigInt']>;
  blockNumber_not?: InputMaybe<Scalars['BigInt']>;
  blockNumber_not_in?: InputMaybe<Array<Scalars['BigInt']>>;
  id?: InputMaybe<Scalars['ID']>;
  id_gt?: InputMaybe<Scalars['ID']>;
  id_gte?: InputMaybe<Scalars['ID']>;
  id_in?: InputMaybe<Array<Scalars['ID']>>;
  id_lt?: InputMaybe<Scalars['ID']>;
  id_lte?: InputMaybe<Scalars['ID']>;
  id_not?: InputMaybe<Scalars['ID']>;
  id_not_in?: InputMaybe<Array<Scalars['ID']>>;
  timestamp?: InputMaybe<Scalars['BigInt']>;
  timestamp_gt?: InputMaybe<Scalars['BigInt']>;
  timestamp_gte?: InputMaybe<Scalars['BigInt']>;
  timestamp_in?: InputMaybe<Array<Scalars['BigInt']>>;
  timestamp_lt?: InputMaybe<Scalars['BigInt']>;
  timestamp_lte?: InputMaybe<Scalars['BigInt']>;
  timestamp_not?: InputMaybe<Scalars['BigInt']>;
  timestamp_not_in?: InputMaybe<Array<Scalars['BigInt']>>;
  tokenId?: InputMaybe<Scalars['BigInt']>;
  tokenId_gt?: InputMaybe<Scalars['BigInt']>;
  tokenId_gte?: InputMaybe<Scalars['BigInt']>;
  tokenId_in?: InputMaybe<Array<Scalars['BigInt']>>;
  tokenId_lt?: InputMaybe<Scalars['BigInt']>;
  tokenId_lte?: InputMaybe<Scalars['BigInt']>;
  tokenId_not?: InputMaybe<Scalars['BigInt']>;
  tokenId_not_in?: InputMaybe<Array<Scalars['BigInt']>>;
  tranche?: InputMaybe<Scalars['BigInt']>;
  tranche_gt?: InputMaybe<Scalars['BigInt']>;
  tranche_gte?: InputMaybe<Scalars['BigInt']>;
  tranche_in?: InputMaybe<Array<Scalars['BigInt']>>;
  tranche_lt?: InputMaybe<Scalars['BigInt']>;
  tranche_lte?: InputMaybe<Scalars['BigInt']>;
  tranche_not?: InputMaybe<Scalars['BigInt']>;
  tranche_not_in?: InputMaybe<Array<Scalars['BigInt']>>;
  tranchedPool?: InputMaybe<Scalars['String']>;
  tranchedPool_contains?: InputMaybe<Scalars['String']>;
  tranchedPool_ends_with?: InputMaybe<Scalars['String']>;
  tranchedPool_gt?: InputMaybe<Scalars['String']>;
  tranchedPool_gte?: InputMaybe<Scalars['String']>;
  tranchedPool_in?: InputMaybe<Array<Scalars['String']>>;
  tranchedPool_lt?: InputMaybe<Scalars['String']>;
  tranchedPool_lte?: InputMaybe<Scalars['String']>;
  tranchedPool_not?: InputMaybe<Scalars['String']>;
  tranchedPool_not_contains?: InputMaybe<Scalars['String']>;
  tranchedPool_not_ends_with?: InputMaybe<Scalars['String']>;
  tranchedPool_not_in?: InputMaybe<Array<Scalars['String']>>;
  tranchedPool_not_starts_with?: InputMaybe<Scalars['String']>;
  tranchedPool_starts_with?: InputMaybe<Scalars['String']>;
  user?: InputMaybe<Scalars['String']>;
  user_contains?: InputMaybe<Scalars['String']>;
  user_ends_with?: InputMaybe<Scalars['String']>;
  user_gt?: InputMaybe<Scalars['String']>;
  user_gte?: InputMaybe<Scalars['String']>;
  user_in?: InputMaybe<Array<Scalars['String']>>;
  user_lt?: InputMaybe<Scalars['String']>;
  user_lte?: InputMaybe<Scalars['String']>;
  user_not?: InputMaybe<Scalars['String']>;
  user_not_contains?: InputMaybe<Scalars['String']>;
  user_not_ends_with?: InputMaybe<Scalars['String']>;
  user_not_in?: InputMaybe<Array<Scalars['String']>>;
  user_not_starts_with?: InputMaybe<Scalars['String']>;
  user_starts_with?: InputMaybe<Scalars['String']>;
};

export enum TranchedPoolDeposit_OrderBy {
  Amount = 'amount',
  BlockNumber = 'blockNumber',
  Id = 'id',
  Timestamp = 'timestamp',
  TokenId = 'tokenId',
  Tranche = 'tranche',
  TranchedPool = 'tranchedPool',
  User = 'user'
}

export type TranchedPoolToken = {
  __typename?: 'TranchedPoolToken';
  id: Scalars['ID'];
  interestRedeemable: Scalars['BigInt'];
  interestRedeemed: Scalars['BigInt'];
  principalAmount: Scalars['BigInt'];
  principalRedeemable: Scalars['BigInt'];
  principalRedeemed: Scalars['BigInt'];
  tranche: Scalars['BigInt'];
  tranchedPool: TranchedPool;
  user: User;
};

export type TranchedPoolToken_Filter = {
  id?: InputMaybe<Scalars['ID']>;
  id_gt?: InputMaybe<Scalars['ID']>;
  id_gte?: InputMaybe<Scalars['ID']>;
  id_in?: InputMaybe<Array<Scalars['ID']>>;
  id_lt?: InputMaybe<Scalars['ID']>;
  id_lte?: InputMaybe<Scalars['ID']>;
  id_not?: InputMaybe<Scalars['ID']>;
  id_not_in?: InputMaybe<Array<Scalars['ID']>>;
  interestRedeemable?: InputMaybe<Scalars['BigInt']>;
  interestRedeemable_gt?: InputMaybe<Scalars['BigInt']>;
  interestRedeemable_gte?: InputMaybe<Scalars['BigInt']>;
  interestRedeemable_in?: InputMaybe<Array<Scalars['BigInt']>>;
  interestRedeemable_lt?: InputMaybe<Scalars['BigInt']>;
  interestRedeemable_lte?: InputMaybe<Scalars['BigInt']>;
  interestRedeemable_not?: InputMaybe<Scalars['BigInt']>;
  interestRedeemable_not_in?: InputMaybe<Array<Scalars['BigInt']>>;
  interestRedeemed?: InputMaybe<Scalars['BigInt']>;
  interestRedeemed_gt?: InputMaybe<Scalars['BigInt']>;
  interestRedeemed_gte?: InputMaybe<Scalars['BigInt']>;
  interestRedeemed_in?: InputMaybe<Array<Scalars['BigInt']>>;
  interestRedeemed_lt?: InputMaybe<Scalars['BigInt']>;
  interestRedeemed_lte?: InputMaybe<Scalars['BigInt']>;
  interestRedeemed_not?: InputMaybe<Scalars['BigInt']>;
  interestRedeemed_not_in?: InputMaybe<Array<Scalars['BigInt']>>;
  principalAmount?: InputMaybe<Scalars['BigInt']>;
  principalAmount_gt?: InputMaybe<Scalars['BigInt']>;
  principalAmount_gte?: InputMaybe<Scalars['BigInt']>;
  principalAmount_in?: InputMaybe<Array<Scalars['BigInt']>>;
  principalAmount_lt?: InputMaybe<Scalars['BigInt']>;
  principalAmount_lte?: InputMaybe<Scalars['BigInt']>;
  principalAmount_not?: InputMaybe<Scalars['BigInt']>;
  principalAmount_not_in?: InputMaybe<Array<Scalars['BigInt']>>;
  principalRedeemable?: InputMaybe<Scalars['BigInt']>;
  principalRedeemable_gt?: InputMaybe<Scalars['BigInt']>;
  principalRedeemable_gte?: InputMaybe<Scalars['BigInt']>;
  principalRedeemable_in?: InputMaybe<Array<Scalars['BigInt']>>;
  principalRedeemable_lt?: InputMaybe<Scalars['BigInt']>;
  principalRedeemable_lte?: InputMaybe<Scalars['BigInt']>;
  principalRedeemable_not?: InputMaybe<Scalars['BigInt']>;
  principalRedeemable_not_in?: InputMaybe<Array<Scalars['BigInt']>>;
  principalRedeemed?: InputMaybe<Scalars['BigInt']>;
  principalRedeemed_gt?: InputMaybe<Scalars['BigInt']>;
  principalRedeemed_gte?: InputMaybe<Scalars['BigInt']>;
  principalRedeemed_in?: InputMaybe<Array<Scalars['BigInt']>>;
  principalRedeemed_lt?: InputMaybe<Scalars['BigInt']>;
  principalRedeemed_lte?: InputMaybe<Scalars['BigInt']>;
  principalRedeemed_not?: InputMaybe<Scalars['BigInt']>;
  principalRedeemed_not_in?: InputMaybe<Array<Scalars['BigInt']>>;
  tranche?: InputMaybe<Scalars['BigInt']>;
  tranche_gt?: InputMaybe<Scalars['BigInt']>;
  tranche_gte?: InputMaybe<Scalars['BigInt']>;
  tranche_in?: InputMaybe<Array<Scalars['BigInt']>>;
  tranche_lt?: InputMaybe<Scalars['BigInt']>;
  tranche_lte?: InputMaybe<Scalars['BigInt']>;
  tranche_not?: InputMaybe<Scalars['BigInt']>;
  tranche_not_in?: InputMaybe<Array<Scalars['BigInt']>>;
  tranchedPool?: InputMaybe<Scalars['String']>;
  tranchedPool_contains?: InputMaybe<Scalars['String']>;
  tranchedPool_ends_with?: InputMaybe<Scalars['String']>;
  tranchedPool_gt?: InputMaybe<Scalars['String']>;
  tranchedPool_gte?: InputMaybe<Scalars['String']>;
  tranchedPool_in?: InputMaybe<Array<Scalars['String']>>;
  tranchedPool_lt?: InputMaybe<Scalars['String']>;
  tranchedPool_lte?: InputMaybe<Scalars['String']>;
  tranchedPool_not?: InputMaybe<Scalars['String']>;
  tranchedPool_not_contains?: InputMaybe<Scalars['String']>;
  tranchedPool_not_ends_with?: InputMaybe<Scalars['String']>;
  tranchedPool_not_in?: InputMaybe<Array<Scalars['String']>>;
  tranchedPool_not_starts_with?: InputMaybe<Scalars['String']>;
  tranchedPool_starts_with?: InputMaybe<Scalars['String']>;
  user?: InputMaybe<Scalars['String']>;
  user_contains?: InputMaybe<Scalars['String']>;
  user_ends_with?: InputMaybe<Scalars['String']>;
  user_gt?: InputMaybe<Scalars['String']>;
  user_gte?: InputMaybe<Scalars['String']>;
  user_in?: InputMaybe<Array<Scalars['String']>>;
  user_lt?: InputMaybe<Scalars['String']>;
  user_lte?: InputMaybe<Scalars['String']>;
  user_not?: InputMaybe<Scalars['String']>;
  user_not_contains?: InputMaybe<Scalars['String']>;
  user_not_ends_with?: InputMaybe<Scalars['String']>;
  user_not_in?: InputMaybe<Array<Scalars['String']>>;
  user_not_starts_with?: InputMaybe<Scalars['String']>;
  user_starts_with?: InputMaybe<Scalars['String']>;
};

export enum TranchedPoolToken_OrderBy {
  Id = 'id',
  InterestRedeemable = 'interestRedeemable',
  InterestRedeemed = 'interestRedeemed',
  PrincipalAmount = 'principalAmount',
  PrincipalRedeemable = 'principalRedeemable',
  PrincipalRedeemed = 'principalRedeemed',
  Tranche = 'tranche',
  TranchedPool = 'tranchedPool',
  User = 'user'
}

export type TranchedPool_Filter = {
  backers?: InputMaybe<Array<Scalars['String']>>;
  backers_contains?: InputMaybe<Array<Scalars['String']>>;
  backers_not?: InputMaybe<Array<Scalars['String']>>;
  backers_not_contains?: InputMaybe<Array<Scalars['String']>>;
  creditLine?: InputMaybe<Scalars['String']>;
  creditLine_contains?: InputMaybe<Scalars['String']>;
  creditLine_ends_with?: InputMaybe<Scalars['String']>;
  creditLine_gt?: InputMaybe<Scalars['String']>;
  creditLine_gte?: InputMaybe<Scalars['String']>;
  creditLine_in?: InputMaybe<Array<Scalars['String']>>;
  creditLine_lt?: InputMaybe<Scalars['String']>;
  creditLine_lte?: InputMaybe<Scalars['String']>;
  creditLine_not?: InputMaybe<Scalars['String']>;
  creditLine_not_contains?: InputMaybe<Scalars['String']>;
  creditLine_not_ends_with?: InputMaybe<Scalars['String']>;
  creditLine_not_in?: InputMaybe<Array<Scalars['String']>>;
  creditLine_not_starts_with?: InputMaybe<Scalars['String']>;
  creditLine_starts_with?: InputMaybe<Scalars['String']>;
  estimatedJuniorApy?: InputMaybe<Scalars['BigInt']>;
  estimatedJuniorApy_gt?: InputMaybe<Scalars['BigInt']>;
  estimatedJuniorApy_gte?: InputMaybe<Scalars['BigInt']>;
  estimatedJuniorApy_in?: InputMaybe<Array<Scalars['BigInt']>>;
  estimatedJuniorApy_lt?: InputMaybe<Scalars['BigInt']>;
  estimatedJuniorApy_lte?: InputMaybe<Scalars['BigInt']>;
  estimatedJuniorApy_not?: InputMaybe<Scalars['BigInt']>;
  estimatedJuniorApy_not_in?: InputMaybe<Array<Scalars['BigInt']>>;
  estimatedLeverageRatio?: InputMaybe<Scalars['BigInt']>;
  estimatedLeverageRatio_gt?: InputMaybe<Scalars['BigInt']>;
  estimatedLeverageRatio_gte?: InputMaybe<Scalars['BigInt']>;
  estimatedLeverageRatio_in?: InputMaybe<Array<Scalars['BigInt']>>;
  estimatedLeverageRatio_lt?: InputMaybe<Scalars['BigInt']>;
  estimatedLeverageRatio_lte?: InputMaybe<Scalars['BigInt']>;
  estimatedLeverageRatio_not?: InputMaybe<Scalars['BigInt']>;
  estimatedLeverageRatio_not_in?: InputMaybe<Array<Scalars['BigInt']>>;
  estimatedSeniorPoolContribution?: InputMaybe<Scalars['BigInt']>;
  estimatedSeniorPoolContribution_gt?: InputMaybe<Scalars['BigInt']>;
  estimatedSeniorPoolContribution_gte?: InputMaybe<Scalars['BigInt']>;
  estimatedSeniorPoolContribution_in?: InputMaybe<Array<Scalars['BigInt']>>;
  estimatedSeniorPoolContribution_lt?: InputMaybe<Scalars['BigInt']>;
  estimatedSeniorPoolContribution_lte?: InputMaybe<Scalars['BigInt']>;
  estimatedSeniorPoolContribution_not?: InputMaybe<Scalars['BigInt']>;
  estimatedSeniorPoolContribution_not_in?: InputMaybe<Array<Scalars['BigInt']>>;
  estimatedTotalAssets?: InputMaybe<Scalars['BigInt']>;
  estimatedTotalAssets_gt?: InputMaybe<Scalars['BigInt']>;
  estimatedTotalAssets_gte?: InputMaybe<Scalars['BigInt']>;
  estimatedTotalAssets_in?: InputMaybe<Array<Scalars['BigInt']>>;
  estimatedTotalAssets_lt?: InputMaybe<Scalars['BigInt']>;
  estimatedTotalAssets_lte?: InputMaybe<Scalars['BigInt']>;
  estimatedTotalAssets_not?: InputMaybe<Scalars['BigInt']>;
  estimatedTotalAssets_not_in?: InputMaybe<Array<Scalars['BigInt']>>;
  id?: InputMaybe<Scalars['ID']>;
  id_gt?: InputMaybe<Scalars['ID']>;
  id_gte?: InputMaybe<Scalars['ID']>;
  id_in?: InputMaybe<Array<Scalars['ID']>>;
  id_lt?: InputMaybe<Scalars['ID']>;
  id_lte?: InputMaybe<Scalars['ID']>;
  id_not?: InputMaybe<Scalars['ID']>;
  id_not_in?: InputMaybe<Array<Scalars['ID']>>;
  isPaused?: InputMaybe<Scalars['Boolean']>;
  isPaused_in?: InputMaybe<Array<Scalars['Boolean']>>;
  isPaused_not?: InputMaybe<Scalars['Boolean']>;
  isPaused_not_in?: InputMaybe<Array<Scalars['Boolean']>>;
  isV1StyleDeal?: InputMaybe<Scalars['Boolean']>;
  isV1StyleDeal_in?: InputMaybe<Array<Scalars['Boolean']>>;
  isV1StyleDeal_not?: InputMaybe<Scalars['Boolean']>;
  isV1StyleDeal_not_in?: InputMaybe<Array<Scalars['Boolean']>>;
  juniorFeePercent?: InputMaybe<Scalars['BigInt']>;
  juniorFeePercent_gt?: InputMaybe<Scalars['BigInt']>;
  juniorFeePercent_gte?: InputMaybe<Scalars['BigInt']>;
  juniorFeePercent_in?: InputMaybe<Array<Scalars['BigInt']>>;
  juniorFeePercent_lt?: InputMaybe<Scalars['BigInt']>;
  juniorFeePercent_lte?: InputMaybe<Scalars['BigInt']>;
  juniorFeePercent_not?: InputMaybe<Scalars['BigInt']>;
  juniorFeePercent_not_in?: InputMaybe<Array<Scalars['BigInt']>>;
  remainingCapacity?: InputMaybe<Scalars['BigInt']>;
  remainingCapacity_gt?: InputMaybe<Scalars['BigInt']>;
  remainingCapacity_gte?: InputMaybe<Scalars['BigInt']>;
  remainingCapacity_in?: InputMaybe<Array<Scalars['BigInt']>>;
  remainingCapacity_lt?: InputMaybe<Scalars['BigInt']>;
  remainingCapacity_lte?: InputMaybe<Scalars['BigInt']>;
  remainingCapacity_not?: InputMaybe<Scalars['BigInt']>;
  remainingCapacity_not_in?: InputMaybe<Array<Scalars['BigInt']>>;
  remainingJuniorCapacity?: InputMaybe<Scalars['BigInt']>;
  remainingJuniorCapacity_gt?: InputMaybe<Scalars['BigInt']>;
  remainingJuniorCapacity_gte?: InputMaybe<Scalars['BigInt']>;
  remainingJuniorCapacity_in?: InputMaybe<Array<Scalars['BigInt']>>;
  remainingJuniorCapacity_lt?: InputMaybe<Scalars['BigInt']>;
  remainingJuniorCapacity_lte?: InputMaybe<Scalars['BigInt']>;
  remainingJuniorCapacity_not?: InputMaybe<Scalars['BigInt']>;
  remainingJuniorCapacity_not_in?: InputMaybe<Array<Scalars['BigInt']>>;
  reserveFeePercent?: InputMaybe<Scalars['BigInt']>;
  reserveFeePercent_gt?: InputMaybe<Scalars['BigInt']>;
  reserveFeePercent_gte?: InputMaybe<Scalars['BigInt']>;
  reserveFeePercent_in?: InputMaybe<Array<Scalars['BigInt']>>;
  reserveFeePercent_lt?: InputMaybe<Scalars['BigInt']>;
  reserveFeePercent_lte?: InputMaybe<Scalars['BigInt']>;
  reserveFeePercent_not?: InputMaybe<Scalars['BigInt']>;
  reserveFeePercent_not_in?: InputMaybe<Array<Scalars['BigInt']>>;
  tokens?: InputMaybe<Array<Scalars['String']>>;
  tokens_contains?: InputMaybe<Array<Scalars['String']>>;
  tokens_not?: InputMaybe<Array<Scalars['String']>>;
  tokens_not_contains?: InputMaybe<Array<Scalars['String']>>;
  totalDeposited?: InputMaybe<Scalars['BigInt']>;
  totalDeposited_gt?: InputMaybe<Scalars['BigInt']>;
  totalDeposited_gte?: InputMaybe<Scalars['BigInt']>;
  totalDeposited_in?: InputMaybe<Array<Scalars['BigInt']>>;
  totalDeposited_lt?: InputMaybe<Scalars['BigInt']>;
  totalDeposited_lte?: InputMaybe<Scalars['BigInt']>;
  totalDeposited_not?: InputMaybe<Scalars['BigInt']>;
  totalDeposited_not_in?: InputMaybe<Array<Scalars['BigInt']>>;
};

export enum TranchedPool_OrderBy {
  Backers = 'backers',
  CreditLine = 'creditLine',
  Deposits = 'deposits',
  EstimatedJuniorApy = 'estimatedJuniorApy',
  EstimatedLeverageRatio = 'estimatedLeverageRatio',
  EstimatedSeniorPoolContribution = 'estimatedSeniorPoolContribution',
  EstimatedTotalAssets = 'estimatedTotalAssets',
  Id = 'id',
  IsPaused = 'isPaused',
  IsV1StyleDeal = 'isV1StyleDeal',
  JuniorFeePercent = 'juniorFeePercent',
  JuniorTranches = 'juniorTranches',
  RemainingCapacity = 'remainingCapacity',
  RemainingJuniorCapacity = 'remainingJuniorCapacity',
  ReserveFeePercent = 'reserveFeePercent',
  SeniorTranches = 'seniorTranches',
  Tokens = 'tokens',
  TotalDeposited = 'totalDeposited'
}

export type User = {
  __typename?: 'User';
  capitalProviderStatus?: Maybe<CapitalProviderStatus>;
  goListed?: Maybe<Scalars['Boolean']>;
  id: Scalars['ID'];
  poolBackers: Array<PoolBacker>;
  seniorPoolDeposits: Array<SeniorPoolDeposit>;
  tokens?: Maybe<Array<TranchedPoolToken>>;
  tranchedPoolsDeposits: Array<TranchedPoolDeposit>;
  type?: Maybe<UserType>;
};


export type UserPoolBackersArgs = {
  first?: InputMaybe<Scalars['Int']>;
  orderBy?: InputMaybe<PoolBacker_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']>;
  where?: InputMaybe<PoolBacker_Filter>;
};


export type UserSeniorPoolDepositsArgs = {
  first?: InputMaybe<Scalars['Int']>;
  orderBy?: InputMaybe<SeniorPoolDeposit_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']>;
  where?: InputMaybe<SeniorPoolDeposit_Filter>;
};


export type UserTokensArgs = {
  first?: InputMaybe<Scalars['Int']>;
  orderBy?: InputMaybe<TranchedPoolToken_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']>;
  where?: InputMaybe<TranchedPoolToken_Filter>;
};


export type UserTranchedPoolsDepositsArgs = {
  first?: InputMaybe<Scalars['Int']>;
  orderBy?: InputMaybe<TranchedPoolDeposit_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']>;
  where?: InputMaybe<TranchedPoolDeposit_Filter>;
};

export enum UserType {
  Backer = 'BACKER',
  Borrower = 'BORROWER',
  CapitalProvider = 'CAPITAL_PROVIDER'
}

export type User_Filter = {
  capitalProviderStatus?: InputMaybe<Scalars['String']>;
  capitalProviderStatus_contains?: InputMaybe<Scalars['String']>;
  capitalProviderStatus_ends_with?: InputMaybe<Scalars['String']>;
  capitalProviderStatus_gt?: InputMaybe<Scalars['String']>;
  capitalProviderStatus_gte?: InputMaybe<Scalars['String']>;
  capitalProviderStatus_in?: InputMaybe<Array<Scalars['String']>>;
  capitalProviderStatus_lt?: InputMaybe<Scalars['String']>;
  capitalProviderStatus_lte?: InputMaybe<Scalars['String']>;
  capitalProviderStatus_not?: InputMaybe<Scalars['String']>;
  capitalProviderStatus_not_contains?: InputMaybe<Scalars['String']>;
  capitalProviderStatus_not_ends_with?: InputMaybe<Scalars['String']>;
  capitalProviderStatus_not_in?: InputMaybe<Array<Scalars['String']>>;
  capitalProviderStatus_not_starts_with?: InputMaybe<Scalars['String']>;
  capitalProviderStatus_starts_with?: InputMaybe<Scalars['String']>;
  goListed?: InputMaybe<Scalars['Boolean']>;
  goListed_in?: InputMaybe<Array<Scalars['Boolean']>>;
  goListed_not?: InputMaybe<Scalars['Boolean']>;
  goListed_not_in?: InputMaybe<Array<Scalars['Boolean']>>;
  id?: InputMaybe<Scalars['ID']>;
  id_gt?: InputMaybe<Scalars['ID']>;
  id_gte?: InputMaybe<Scalars['ID']>;
  id_in?: InputMaybe<Array<Scalars['ID']>>;
  id_lt?: InputMaybe<Scalars['ID']>;
  id_lte?: InputMaybe<Scalars['ID']>;
  id_not?: InputMaybe<Scalars['ID']>;
  id_not_in?: InputMaybe<Array<Scalars['ID']>>;
  type?: InputMaybe<UserType>;
  type_in?: InputMaybe<Array<UserType>>;
  type_not?: InputMaybe<UserType>;
  type_not_in?: InputMaybe<Array<UserType>>;
};

export enum User_OrderBy {
  CapitalProviderStatus = 'capitalProviderStatus',
  GoListed = 'goListed',
  Id = 'id',
  PoolBackers = 'poolBackers',
  SeniorPoolDeposits = 'seniorPoolDeposits',
  Tokens = 'tokens',
  TranchedPoolsDeposits = 'tranchedPoolsDeposits',
  Type = 'type'
}

export type _Block_ = {
  __typename?: '_Block_';
  /** The hash of the block */
  hash?: Maybe<Scalars['Bytes']>;
  /** The block number */
  number: Scalars['Int'];
};

/** The type for the top-level _meta field */
export type _Meta_ = {
  __typename?: '_Meta_';
  /**
   * Information about a specific subgraph block. The hash of the block
   * will be null if the _meta field has a block constraint that asks for
   * a block number. It will be filled if the _meta field has no block constraint
   * and therefore asks for the latest  block
   *
   */
  block: _Block_;
  /** The deployment ID */
  deployment: Scalars['String'];
  /** If `true`, the subgraph encountered indexing errors at some past block */
  hasIndexingErrors: Scalars['Boolean'];
};

export enum _SubgraphErrorPolicy_ {
  /** Data will be returned even if the subgraph has indexing errors */
  Allow = 'allow',
  /** If the subgraph has indexing errors, data will be omitted. The default. */
  Deny = 'deny'
}

export type ExampleQueryVariables = Exact<{ [key: string]: never; }>;


export type ExampleQuery = { __typename?: 'Query', seniorPools: Array<{ __typename?: 'SeniorPool', id: string, name: string, category: string, icon: string, latestPoolStatus: { __typename?: 'SeniorPoolStatus', id: string, estimatedApy: any, tranchedPools: Array<{ __typename?: 'TranchedPool', id: string, name?: string | null, category?: string | null, icon?: string | null }> } }>, tranchedPools: Array<{ __typename?: 'TranchedPool', id: string, name?: string | null, category?: string | null, icon?: string | null }> };

export type TranchedPoolCardFieldsFragment = { __typename?: 'TranchedPool', id: string, name?: string | null, category?: string | null, icon?: string | null };

export const TranchedPoolCardFieldsFragmentDoc = gql`
    fragment TranchedPoolCardFields on TranchedPool {
  id
  name @client
  category @client
  icon @client
}
    `;
export const ExampleDocument = gql`
    query Example {
  seniorPools(first: 1) {
    id
    name @client
    category @client
    icon @client
    latestPoolStatus {
      id
      estimatedApy
      tranchedPools {
        id
        ...TranchedPoolCardFields
      }
    }
  }
  tranchedPools {
    id
    ...TranchedPoolCardFields
  }
}
    ${TranchedPoolCardFieldsFragmentDoc}`;

/**
 * __useExampleQuery__
 *
 * To run a query within a React component, call `useExampleQuery` and pass it any options that fit your needs.
 * When your component renders, `useExampleQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useExampleQuery({
 *   variables: {
 *   },
 * });
 */
export function useExampleQuery(baseOptions?: Apollo.QueryHookOptions<ExampleQuery, ExampleQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<ExampleQuery, ExampleQueryVariables>(ExampleDocument, options);
      }
export function useExampleLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<ExampleQuery, ExampleQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<ExampleQuery, ExampleQueryVariables>(ExampleDocument, options);
        }
export type ExampleQueryHookResult = ReturnType<typeof useExampleQuery>;
export type ExampleLazyQueryHookResult = ReturnType<typeof useExampleLazyQuery>;
export type ExampleQueryResult = Apollo.QueryResult<ExampleQuery, ExampleQueryVariables>;