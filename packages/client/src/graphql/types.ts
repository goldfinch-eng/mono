import {gql} from "@apollo/client"
export type Maybe<T> = T | null
export type Exact<T extends {[key: string]: unknown}> = {[K in keyof T]: T[K]}
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & {[SubKey in K]?: Maybe<T[SubKey]>}
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & {[SubKey in K]: Maybe<T[SubKey]>}
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: string
  String: string
  Boolean: boolean
  Int: number
  Float: number
  BigDecimal: any
  BigInt: any
  Bytes: any
}

export type Block_Height = {
  hash?: Maybe<Scalars["Bytes"]>
  number?: Maybe<Scalars["Int"]>
}

export type CapitalProviderStatus = {
  __typename?: "CapitalProviderStatus"
  allowance: Scalars["BigInt"]
  availableToWithdraw: Scalars["BigInt"]
  availableToWithdrawInDollars?: Maybe<Scalars["BigInt"]>
  id: Scalars["ID"]
  numShares: Scalars["BigInt"]
  unrealizedGains?: Maybe<Scalars["BigDecimal"]>
  unrealizedGainsInDollars?: Maybe<Scalars["BigInt"]>
  unrealizedGainsPercentage?: Maybe<Scalars["BigDecimal"]>
  user: User
  weightedAverageSharePrice?: Maybe<Scalars["BigDecimal"]>
}

export type CapitalProviderStatus_Filter = {
  allowance?: Maybe<Scalars["BigInt"]>
  allowance_gt?: Maybe<Scalars["BigInt"]>
  allowance_gte?: Maybe<Scalars["BigInt"]>
  allowance_in?: Maybe<Array<Scalars["BigInt"]>>
  allowance_lt?: Maybe<Scalars["BigInt"]>
  allowance_lte?: Maybe<Scalars["BigInt"]>
  allowance_not?: Maybe<Scalars["BigInt"]>
  allowance_not_in?: Maybe<Array<Scalars["BigInt"]>>
  availableToWithdraw?: Maybe<Scalars["BigInt"]>
  availableToWithdrawInDollars?: Maybe<Scalars["BigInt"]>
  availableToWithdrawInDollars_gt?: Maybe<Scalars["BigInt"]>
  availableToWithdrawInDollars_gte?: Maybe<Scalars["BigInt"]>
  availableToWithdrawInDollars_in?: Maybe<Array<Scalars["BigInt"]>>
  availableToWithdrawInDollars_lt?: Maybe<Scalars["BigInt"]>
  availableToWithdrawInDollars_lte?: Maybe<Scalars["BigInt"]>
  availableToWithdrawInDollars_not?: Maybe<Scalars["BigInt"]>
  availableToWithdrawInDollars_not_in?: Maybe<Array<Scalars["BigInt"]>>
  availableToWithdraw_gt?: Maybe<Scalars["BigInt"]>
  availableToWithdraw_gte?: Maybe<Scalars["BigInt"]>
  availableToWithdraw_in?: Maybe<Array<Scalars["BigInt"]>>
  availableToWithdraw_lt?: Maybe<Scalars["BigInt"]>
  availableToWithdraw_lte?: Maybe<Scalars["BigInt"]>
  availableToWithdraw_not?: Maybe<Scalars["BigInt"]>
  availableToWithdraw_not_in?: Maybe<Array<Scalars["BigInt"]>>
  id?: Maybe<Scalars["ID"]>
  id_gt?: Maybe<Scalars["ID"]>
  id_gte?: Maybe<Scalars["ID"]>
  id_in?: Maybe<Array<Scalars["ID"]>>
  id_lt?: Maybe<Scalars["ID"]>
  id_lte?: Maybe<Scalars["ID"]>
  id_not?: Maybe<Scalars["ID"]>
  id_not_in?: Maybe<Array<Scalars["ID"]>>
  numShares?: Maybe<Scalars["BigInt"]>
  numShares_gt?: Maybe<Scalars["BigInt"]>
  numShares_gte?: Maybe<Scalars["BigInt"]>
  numShares_in?: Maybe<Array<Scalars["BigInt"]>>
  numShares_lt?: Maybe<Scalars["BigInt"]>
  numShares_lte?: Maybe<Scalars["BigInt"]>
  numShares_not?: Maybe<Scalars["BigInt"]>
  numShares_not_in?: Maybe<Array<Scalars["BigInt"]>>
  unrealizedGains?: Maybe<Scalars["BigDecimal"]>
  unrealizedGainsInDollars?: Maybe<Scalars["BigInt"]>
  unrealizedGainsInDollars_gt?: Maybe<Scalars["BigInt"]>
  unrealizedGainsInDollars_gte?: Maybe<Scalars["BigInt"]>
  unrealizedGainsInDollars_in?: Maybe<Array<Scalars["BigInt"]>>
  unrealizedGainsInDollars_lt?: Maybe<Scalars["BigInt"]>
  unrealizedGainsInDollars_lte?: Maybe<Scalars["BigInt"]>
  unrealizedGainsInDollars_not?: Maybe<Scalars["BigInt"]>
  unrealizedGainsInDollars_not_in?: Maybe<Array<Scalars["BigInt"]>>
  unrealizedGainsPercentage?: Maybe<Scalars["BigDecimal"]>
  unrealizedGainsPercentage_gt?: Maybe<Scalars["BigDecimal"]>
  unrealizedGainsPercentage_gte?: Maybe<Scalars["BigDecimal"]>
  unrealizedGainsPercentage_in?: Maybe<Array<Scalars["BigDecimal"]>>
  unrealizedGainsPercentage_lt?: Maybe<Scalars["BigDecimal"]>
  unrealizedGainsPercentage_lte?: Maybe<Scalars["BigDecimal"]>
  unrealizedGainsPercentage_not?: Maybe<Scalars["BigDecimal"]>
  unrealizedGainsPercentage_not_in?: Maybe<Array<Scalars["BigDecimal"]>>
  unrealizedGains_gt?: Maybe<Scalars["BigDecimal"]>
  unrealizedGains_gte?: Maybe<Scalars["BigDecimal"]>
  unrealizedGains_in?: Maybe<Array<Scalars["BigDecimal"]>>
  unrealizedGains_lt?: Maybe<Scalars["BigDecimal"]>
  unrealizedGains_lte?: Maybe<Scalars["BigDecimal"]>
  unrealizedGains_not?: Maybe<Scalars["BigDecimal"]>
  unrealizedGains_not_in?: Maybe<Array<Scalars["BigDecimal"]>>
  user?: Maybe<Scalars["String"]>
  user_contains?: Maybe<Scalars["String"]>
  user_ends_with?: Maybe<Scalars["String"]>
  user_gt?: Maybe<Scalars["String"]>
  user_gte?: Maybe<Scalars["String"]>
  user_in?: Maybe<Array<Scalars["String"]>>
  user_lt?: Maybe<Scalars["String"]>
  user_lte?: Maybe<Scalars["String"]>
  user_not?: Maybe<Scalars["String"]>
  user_not_contains?: Maybe<Scalars["String"]>
  user_not_ends_with?: Maybe<Scalars["String"]>
  user_not_in?: Maybe<Array<Scalars["String"]>>
  user_not_starts_with?: Maybe<Scalars["String"]>
  user_starts_with?: Maybe<Scalars["String"]>
  weightedAverageSharePrice?: Maybe<Scalars["BigDecimal"]>
  weightedAverageSharePrice_gt?: Maybe<Scalars["BigDecimal"]>
  weightedAverageSharePrice_gte?: Maybe<Scalars["BigDecimal"]>
  weightedAverageSharePrice_in?: Maybe<Array<Scalars["BigDecimal"]>>
  weightedAverageSharePrice_lt?: Maybe<Scalars["BigDecimal"]>
  weightedAverageSharePrice_lte?: Maybe<Scalars["BigDecimal"]>
  weightedAverageSharePrice_not?: Maybe<Scalars["BigDecimal"]>
  weightedAverageSharePrice_not_in?: Maybe<Array<Scalars["BigDecimal"]>>
}

export enum CapitalProviderStatus_OrderBy {
  Allowance = "allowance",
  AvailableToWithdraw = "availableToWithdraw",
  AvailableToWithdrawInDollars = "availableToWithdrawInDollars",
  Id = "id",
  NumShares = "numShares",
  UnrealizedGains = "unrealizedGains",
  UnrealizedGainsInDollars = "unrealizedGainsInDollars",
  UnrealizedGainsPercentage = "unrealizedGainsPercentage",
  User = "user",
  WeightedAverageSharePrice = "weightedAverageSharePrice",
}

export enum OrderDirection {
  Asc = "asc",
  Desc = "desc",
}

export type Query = {
  __typename?: "Query"
  /** Access to subgraph metadata */
  _meta?: Maybe<_Meta_>
  capitalProviderStatus?: Maybe<CapitalProviderStatus>
  capitalProviderStatuses: Array<CapitalProviderStatus>
  seniorPool?: Maybe<SeniorPool>
  seniorPoolDeposit?: Maybe<SeniorPoolDeposit>
  seniorPoolDeposits: Array<SeniorPoolDeposit>
  seniorPoolStatus?: Maybe<SeniorPoolStatus>
  seniorPoolStatuses: Array<SeniorPoolStatus>
  seniorPools: Array<SeniorPool>
  user?: Maybe<User>
  users: Array<User>
}

export type Query_MetaArgs = {
  block?: Maybe<Block_Height>
}

export type QueryCapitalProviderStatusArgs = {
  block?: Maybe<Block_Height>
  id: Scalars["ID"]
}

export type QueryCapitalProviderStatusesArgs = {
  block?: Maybe<Block_Height>
  first?: Maybe<Scalars["Int"]>
  orderBy?: Maybe<CapitalProviderStatus_OrderBy>
  orderDirection?: Maybe<OrderDirection>
  skip?: Maybe<Scalars["Int"]>
  where?: Maybe<CapitalProviderStatus_Filter>
}

export type QuerySeniorPoolArgs = {
  block?: Maybe<Block_Height>
  id: Scalars["ID"]
}

export type QuerySeniorPoolDepositArgs = {
  block?: Maybe<Block_Height>
  id: Scalars["ID"]
}

export type QuerySeniorPoolDepositsArgs = {
  block?: Maybe<Block_Height>
  first?: Maybe<Scalars["Int"]>
  orderBy?: Maybe<SeniorPoolDeposit_OrderBy>
  orderDirection?: Maybe<OrderDirection>
  skip?: Maybe<Scalars["Int"]>
  where?: Maybe<SeniorPoolDeposit_Filter>
}

export type QuerySeniorPoolStatusArgs = {
  block?: Maybe<Block_Height>
  id: Scalars["ID"]
}

export type QuerySeniorPoolStatusesArgs = {
  block?: Maybe<Block_Height>
  first?: Maybe<Scalars["Int"]>
  orderBy?: Maybe<SeniorPoolStatus_OrderBy>
  orderDirection?: Maybe<OrderDirection>
  skip?: Maybe<Scalars["Int"]>
  where?: Maybe<SeniorPoolStatus_Filter>
}

export type QuerySeniorPoolsArgs = {
  block?: Maybe<Block_Height>
  first?: Maybe<Scalars["Int"]>
  orderBy?: Maybe<SeniorPool_OrderBy>
  orderDirection?: Maybe<OrderDirection>
  skip?: Maybe<Scalars["Int"]>
  where?: Maybe<SeniorPool_Filter>
}

export type QueryUserArgs = {
  block?: Maybe<Block_Height>
  id: Scalars["ID"]
}

export type QueryUsersArgs = {
  block?: Maybe<Block_Height>
  first?: Maybe<Scalars["Int"]>
  orderBy?: Maybe<User_OrderBy>
  orderDirection?: Maybe<OrderDirection>
  skip?: Maybe<Scalars["Int"]>
  where?: Maybe<User_Filter>
}

/**
 * Notes
 * - address are mapped as IDs
 *
 */
export type SeniorPool = {
  __typename?: "SeniorPool"
  capitalProviders: Array<User>
  id: Scalars["ID"]
  lastestPoolStatus: SeniorPoolStatus
}

/**
 * Notes
 * - address are mapped as IDs
 *
 */
export type SeniorPoolCapitalProvidersArgs = {
  first?: Maybe<Scalars["Int"]>
  orderBy?: Maybe<User_OrderBy>
  orderDirection?: Maybe<OrderDirection>
  skip?: Maybe<Scalars["Int"]>
  where?: Maybe<User_Filter>
}

export type SeniorPoolDeposit = {
  __typename?: "SeniorPoolDeposit"
  amount: Scalars["BigInt"]
  blockNumber: Scalars["BigInt"]
  /**
   * tx hash
   *
   */
  id: Scalars["ID"]
  shares: Scalars["BigInt"]
  timestamp: Scalars["BigInt"]
  user: User
}

export type SeniorPoolDeposit_Filter = {
  amount?: Maybe<Scalars["BigInt"]>
  amount_gt?: Maybe<Scalars["BigInt"]>
  amount_gte?: Maybe<Scalars["BigInt"]>
  amount_in?: Maybe<Array<Scalars["BigInt"]>>
  amount_lt?: Maybe<Scalars["BigInt"]>
  amount_lte?: Maybe<Scalars["BigInt"]>
  amount_not?: Maybe<Scalars["BigInt"]>
  amount_not_in?: Maybe<Array<Scalars["BigInt"]>>
  blockNumber?: Maybe<Scalars["BigInt"]>
  blockNumber_gt?: Maybe<Scalars["BigInt"]>
  blockNumber_gte?: Maybe<Scalars["BigInt"]>
  blockNumber_in?: Maybe<Array<Scalars["BigInt"]>>
  blockNumber_lt?: Maybe<Scalars["BigInt"]>
  blockNumber_lte?: Maybe<Scalars["BigInt"]>
  blockNumber_not?: Maybe<Scalars["BigInt"]>
  blockNumber_not_in?: Maybe<Array<Scalars["BigInt"]>>
  id?: Maybe<Scalars["ID"]>
  id_gt?: Maybe<Scalars["ID"]>
  id_gte?: Maybe<Scalars["ID"]>
  id_in?: Maybe<Array<Scalars["ID"]>>
  id_lt?: Maybe<Scalars["ID"]>
  id_lte?: Maybe<Scalars["ID"]>
  id_not?: Maybe<Scalars["ID"]>
  id_not_in?: Maybe<Array<Scalars["ID"]>>
  shares?: Maybe<Scalars["BigInt"]>
  shares_gt?: Maybe<Scalars["BigInt"]>
  shares_gte?: Maybe<Scalars["BigInt"]>
  shares_in?: Maybe<Array<Scalars["BigInt"]>>
  shares_lt?: Maybe<Scalars["BigInt"]>
  shares_lte?: Maybe<Scalars["BigInt"]>
  shares_not?: Maybe<Scalars["BigInt"]>
  shares_not_in?: Maybe<Array<Scalars["BigInt"]>>
  timestamp?: Maybe<Scalars["BigInt"]>
  timestamp_gt?: Maybe<Scalars["BigInt"]>
  timestamp_gte?: Maybe<Scalars["BigInt"]>
  timestamp_in?: Maybe<Array<Scalars["BigInt"]>>
  timestamp_lt?: Maybe<Scalars["BigInt"]>
  timestamp_lte?: Maybe<Scalars["BigInt"]>
  timestamp_not?: Maybe<Scalars["BigInt"]>
  timestamp_not_in?: Maybe<Array<Scalars["BigInt"]>>
  user?: Maybe<Scalars["String"]>
  user_contains?: Maybe<Scalars["String"]>
  user_ends_with?: Maybe<Scalars["String"]>
  user_gt?: Maybe<Scalars["String"]>
  user_gte?: Maybe<Scalars["String"]>
  user_in?: Maybe<Array<Scalars["String"]>>
  user_lt?: Maybe<Scalars["String"]>
  user_lte?: Maybe<Scalars["String"]>
  user_not?: Maybe<Scalars["String"]>
  user_not_contains?: Maybe<Scalars["String"]>
  user_not_ends_with?: Maybe<Scalars["String"]>
  user_not_in?: Maybe<Array<Scalars["String"]>>
  user_not_starts_with?: Maybe<Scalars["String"]>
  user_starts_with?: Maybe<Scalars["String"]>
}

export enum SeniorPoolDeposit_OrderBy {
  Amount = "amount",
  BlockNumber = "blockNumber",
  Id = "id",
  Shares = "shares",
  Timestamp = "timestamp",
  User = "user",
}

export type SeniorPoolStatus = {
  __typename?: "SeniorPoolStatus"
  balance: Scalars["BigInt"]
  compoundBalance: Scalars["BigInt"]
  cumulativeDrawdowns: Scalars["BigInt"]
  cumulativeWritedowns: Scalars["BigInt"]
  defaultRate: Scalars["BigInt"]
  estimatedApy: Scalars["BigInt"]
  estimatedTotalInterest: Scalars["BigInt"]
  id: Scalars["ID"]
  rawBalance: Scalars["BigInt"]
  remainingCapacity?: Maybe<Scalars["BigInt"]>
  sharePrice: Scalars["BigInt"]
  totalLoansOutstanding: Scalars["BigInt"]
  totalPoolAssets: Scalars["BigInt"]
  totalShares: Scalars["BigInt"]
}

export type SeniorPoolStatus_Filter = {
  balance?: Maybe<Scalars["BigInt"]>
  balance_gt?: Maybe<Scalars["BigInt"]>
  balance_gte?: Maybe<Scalars["BigInt"]>
  balance_in?: Maybe<Array<Scalars["BigInt"]>>
  balance_lt?: Maybe<Scalars["BigInt"]>
  balance_lte?: Maybe<Scalars["BigInt"]>
  balance_not?: Maybe<Scalars["BigInt"]>
  balance_not_in?: Maybe<Array<Scalars["BigInt"]>>
  compoundBalance?: Maybe<Scalars["BigInt"]>
  compoundBalance_gt?: Maybe<Scalars["BigInt"]>
  compoundBalance_gte?: Maybe<Scalars["BigInt"]>
  compoundBalance_in?: Maybe<Array<Scalars["BigInt"]>>
  compoundBalance_lt?: Maybe<Scalars["BigInt"]>
  compoundBalance_lte?: Maybe<Scalars["BigInt"]>
  compoundBalance_not?: Maybe<Scalars["BigInt"]>
  compoundBalance_not_in?: Maybe<Array<Scalars["BigInt"]>>
  cumulativeDrawdowns?: Maybe<Scalars["BigInt"]>
  cumulativeDrawdowns_gt?: Maybe<Scalars["BigInt"]>
  cumulativeDrawdowns_gte?: Maybe<Scalars["BigInt"]>
  cumulativeDrawdowns_in?: Maybe<Array<Scalars["BigInt"]>>
  cumulativeDrawdowns_lt?: Maybe<Scalars["BigInt"]>
  cumulativeDrawdowns_lte?: Maybe<Scalars["BigInt"]>
  cumulativeDrawdowns_not?: Maybe<Scalars["BigInt"]>
  cumulativeDrawdowns_not_in?: Maybe<Array<Scalars["BigInt"]>>
  cumulativeWritedowns?: Maybe<Scalars["BigInt"]>
  cumulativeWritedowns_gt?: Maybe<Scalars["BigInt"]>
  cumulativeWritedowns_gte?: Maybe<Scalars["BigInt"]>
  cumulativeWritedowns_in?: Maybe<Array<Scalars["BigInt"]>>
  cumulativeWritedowns_lt?: Maybe<Scalars["BigInt"]>
  cumulativeWritedowns_lte?: Maybe<Scalars["BigInt"]>
  cumulativeWritedowns_not?: Maybe<Scalars["BigInt"]>
  cumulativeWritedowns_not_in?: Maybe<Array<Scalars["BigInt"]>>
  defaultRate?: Maybe<Scalars["BigInt"]>
  defaultRate_gt?: Maybe<Scalars["BigInt"]>
  defaultRate_gte?: Maybe<Scalars["BigInt"]>
  defaultRate_in?: Maybe<Array<Scalars["BigInt"]>>
  defaultRate_lt?: Maybe<Scalars["BigInt"]>
  defaultRate_lte?: Maybe<Scalars["BigInt"]>
  defaultRate_not?: Maybe<Scalars["BigInt"]>
  defaultRate_not_in?: Maybe<Array<Scalars["BigInt"]>>
  estimatedApy?: Maybe<Scalars["BigInt"]>
  estimatedApy_gt?: Maybe<Scalars["BigInt"]>
  estimatedApy_gte?: Maybe<Scalars["BigInt"]>
  estimatedApy_in?: Maybe<Array<Scalars["BigInt"]>>
  estimatedApy_lt?: Maybe<Scalars["BigInt"]>
  estimatedApy_lte?: Maybe<Scalars["BigInt"]>
  estimatedApy_not?: Maybe<Scalars["BigInt"]>
  estimatedApy_not_in?: Maybe<Array<Scalars["BigInt"]>>
  estimatedTotalInterest?: Maybe<Scalars["BigInt"]>
  estimatedTotalInterest_gt?: Maybe<Scalars["BigInt"]>
  estimatedTotalInterest_gte?: Maybe<Scalars["BigInt"]>
  estimatedTotalInterest_in?: Maybe<Array<Scalars["BigInt"]>>
  estimatedTotalInterest_lt?: Maybe<Scalars["BigInt"]>
  estimatedTotalInterest_lte?: Maybe<Scalars["BigInt"]>
  estimatedTotalInterest_not?: Maybe<Scalars["BigInt"]>
  estimatedTotalInterest_not_in?: Maybe<Array<Scalars["BigInt"]>>
  id?: Maybe<Scalars["ID"]>
  id_gt?: Maybe<Scalars["ID"]>
  id_gte?: Maybe<Scalars["ID"]>
  id_in?: Maybe<Array<Scalars["ID"]>>
  id_lt?: Maybe<Scalars["ID"]>
  id_lte?: Maybe<Scalars["ID"]>
  id_not?: Maybe<Scalars["ID"]>
  id_not_in?: Maybe<Array<Scalars["ID"]>>
  rawBalance?: Maybe<Scalars["BigInt"]>
  rawBalance_gt?: Maybe<Scalars["BigInt"]>
  rawBalance_gte?: Maybe<Scalars["BigInt"]>
  rawBalance_in?: Maybe<Array<Scalars["BigInt"]>>
  rawBalance_lt?: Maybe<Scalars["BigInt"]>
  rawBalance_lte?: Maybe<Scalars["BigInt"]>
  rawBalance_not?: Maybe<Scalars["BigInt"]>
  rawBalance_not_in?: Maybe<Array<Scalars["BigInt"]>>
  remainingCapacity?: Maybe<Scalars["BigInt"]>
  remainingCapacity_gt?: Maybe<Scalars["BigInt"]>
  remainingCapacity_gte?: Maybe<Scalars["BigInt"]>
  remainingCapacity_in?: Maybe<Array<Scalars["BigInt"]>>
  remainingCapacity_lt?: Maybe<Scalars["BigInt"]>
  remainingCapacity_lte?: Maybe<Scalars["BigInt"]>
  remainingCapacity_not?: Maybe<Scalars["BigInt"]>
  remainingCapacity_not_in?: Maybe<Array<Scalars["BigInt"]>>
  sharePrice?: Maybe<Scalars["BigInt"]>
  sharePrice_gt?: Maybe<Scalars["BigInt"]>
  sharePrice_gte?: Maybe<Scalars["BigInt"]>
  sharePrice_in?: Maybe<Array<Scalars["BigInt"]>>
  sharePrice_lt?: Maybe<Scalars["BigInt"]>
  sharePrice_lte?: Maybe<Scalars["BigInt"]>
  sharePrice_not?: Maybe<Scalars["BigInt"]>
  sharePrice_not_in?: Maybe<Array<Scalars["BigInt"]>>
  totalLoansOutstanding?: Maybe<Scalars["BigInt"]>
  totalLoansOutstanding_gt?: Maybe<Scalars["BigInt"]>
  totalLoansOutstanding_gte?: Maybe<Scalars["BigInt"]>
  totalLoansOutstanding_in?: Maybe<Array<Scalars["BigInt"]>>
  totalLoansOutstanding_lt?: Maybe<Scalars["BigInt"]>
  totalLoansOutstanding_lte?: Maybe<Scalars["BigInt"]>
  totalLoansOutstanding_not?: Maybe<Scalars["BigInt"]>
  totalLoansOutstanding_not_in?: Maybe<Array<Scalars["BigInt"]>>
  totalPoolAssets?: Maybe<Scalars["BigInt"]>
  totalPoolAssets_gt?: Maybe<Scalars["BigInt"]>
  totalPoolAssets_gte?: Maybe<Scalars["BigInt"]>
  totalPoolAssets_in?: Maybe<Array<Scalars["BigInt"]>>
  totalPoolAssets_lt?: Maybe<Scalars["BigInt"]>
  totalPoolAssets_lte?: Maybe<Scalars["BigInt"]>
  totalPoolAssets_not?: Maybe<Scalars["BigInt"]>
  totalPoolAssets_not_in?: Maybe<Array<Scalars["BigInt"]>>
  totalShares?: Maybe<Scalars["BigInt"]>
  totalShares_gt?: Maybe<Scalars["BigInt"]>
  totalShares_gte?: Maybe<Scalars["BigInt"]>
  totalShares_in?: Maybe<Array<Scalars["BigInt"]>>
  totalShares_lt?: Maybe<Scalars["BigInt"]>
  totalShares_lte?: Maybe<Scalars["BigInt"]>
  totalShares_not?: Maybe<Scalars["BigInt"]>
  totalShares_not_in?: Maybe<Array<Scalars["BigInt"]>>
}

export enum SeniorPoolStatus_OrderBy {
  Balance = "balance",
  CompoundBalance = "compoundBalance",
  CumulativeDrawdowns = "cumulativeDrawdowns",
  CumulativeWritedowns = "cumulativeWritedowns",
  DefaultRate = "defaultRate",
  EstimatedApy = "estimatedApy",
  EstimatedTotalInterest = "estimatedTotalInterest",
  Id = "id",
  RawBalance = "rawBalance",
  RemainingCapacity = "remainingCapacity",
  SharePrice = "sharePrice",
  TotalLoansOutstanding = "totalLoansOutstanding",
  TotalPoolAssets = "totalPoolAssets",
  TotalShares = "totalShares",
}

export type SeniorPool_Filter = {
  capitalProviders?: Maybe<Array<Scalars["String"]>>
  capitalProviders_contains?: Maybe<Array<Scalars["String"]>>
  capitalProviders_not?: Maybe<Array<Scalars["String"]>>
  capitalProviders_not_contains?: Maybe<Array<Scalars["String"]>>
  id?: Maybe<Scalars["ID"]>
  id_gt?: Maybe<Scalars["ID"]>
  id_gte?: Maybe<Scalars["ID"]>
  id_in?: Maybe<Array<Scalars["ID"]>>
  id_lt?: Maybe<Scalars["ID"]>
  id_lte?: Maybe<Scalars["ID"]>
  id_not?: Maybe<Scalars["ID"]>
  id_not_in?: Maybe<Array<Scalars["ID"]>>
  lastestPoolStatus?: Maybe<Scalars["String"]>
  lastestPoolStatus_contains?: Maybe<Scalars["String"]>
  lastestPoolStatus_ends_with?: Maybe<Scalars["String"]>
  lastestPoolStatus_gt?: Maybe<Scalars["String"]>
  lastestPoolStatus_gte?: Maybe<Scalars["String"]>
  lastestPoolStatus_in?: Maybe<Array<Scalars["String"]>>
  lastestPoolStatus_lt?: Maybe<Scalars["String"]>
  lastestPoolStatus_lte?: Maybe<Scalars["String"]>
  lastestPoolStatus_not?: Maybe<Scalars["String"]>
  lastestPoolStatus_not_contains?: Maybe<Scalars["String"]>
  lastestPoolStatus_not_ends_with?: Maybe<Scalars["String"]>
  lastestPoolStatus_not_in?: Maybe<Array<Scalars["String"]>>
  lastestPoolStatus_not_starts_with?: Maybe<Scalars["String"]>
  lastestPoolStatus_starts_with?: Maybe<Scalars["String"]>
}

export enum SeniorPool_OrderBy {
  CapitalProviders = "capitalProviders",
  Id = "id",
  LastestPoolStatus = "lastestPoolStatus",
}

export type Subscription = {
  __typename?: "Subscription"
  /** Access to subgraph metadata */
  _meta?: Maybe<_Meta_>
  capitalProviderStatus?: Maybe<CapitalProviderStatus>
  capitalProviderStatuses: Array<CapitalProviderStatus>
  seniorPool?: Maybe<SeniorPool>
  seniorPoolDeposit?: Maybe<SeniorPoolDeposit>
  seniorPoolDeposits: Array<SeniorPoolDeposit>
  seniorPoolStatus?: Maybe<SeniorPoolStatus>
  seniorPoolStatuses: Array<SeniorPoolStatus>
  seniorPools: Array<SeniorPool>
  user?: Maybe<User>
  users: Array<User>
}

export type Subscription_MetaArgs = {
  block?: Maybe<Block_Height>
}

export type SubscriptionCapitalProviderStatusArgs = {
  block?: Maybe<Block_Height>
  id: Scalars["ID"]
}

export type SubscriptionCapitalProviderStatusesArgs = {
  block?: Maybe<Block_Height>
  first?: Maybe<Scalars["Int"]>
  orderBy?: Maybe<CapitalProviderStatus_OrderBy>
  orderDirection?: Maybe<OrderDirection>
  skip?: Maybe<Scalars["Int"]>
  where?: Maybe<CapitalProviderStatus_Filter>
}

export type SubscriptionSeniorPoolArgs = {
  block?: Maybe<Block_Height>
  id: Scalars["ID"]
}

export type SubscriptionSeniorPoolDepositArgs = {
  block?: Maybe<Block_Height>
  id: Scalars["ID"]
}

export type SubscriptionSeniorPoolDepositsArgs = {
  block?: Maybe<Block_Height>
  first?: Maybe<Scalars["Int"]>
  orderBy?: Maybe<SeniorPoolDeposit_OrderBy>
  orderDirection?: Maybe<OrderDirection>
  skip?: Maybe<Scalars["Int"]>
  where?: Maybe<SeniorPoolDeposit_Filter>
}

export type SubscriptionSeniorPoolStatusArgs = {
  block?: Maybe<Block_Height>
  id: Scalars["ID"]
}

export type SubscriptionSeniorPoolStatusesArgs = {
  block?: Maybe<Block_Height>
  first?: Maybe<Scalars["Int"]>
  orderBy?: Maybe<SeniorPoolStatus_OrderBy>
  orderDirection?: Maybe<OrderDirection>
  skip?: Maybe<Scalars["Int"]>
  where?: Maybe<SeniorPoolStatus_Filter>
}

export type SubscriptionSeniorPoolsArgs = {
  block?: Maybe<Block_Height>
  first?: Maybe<Scalars["Int"]>
  orderBy?: Maybe<SeniorPool_OrderBy>
  orderDirection?: Maybe<OrderDirection>
  skip?: Maybe<Scalars["Int"]>
  where?: Maybe<SeniorPool_Filter>
}

export type SubscriptionUserArgs = {
  block?: Maybe<Block_Height>
  id: Scalars["ID"]
}

export type SubscriptionUsersArgs = {
  block?: Maybe<Block_Height>
  first?: Maybe<Scalars["Int"]>
  orderBy?: Maybe<User_OrderBy>
  orderDirection?: Maybe<OrderDirection>
  skip?: Maybe<Scalars["Int"]>
  where?: Maybe<User_Filter>
}

export type User = {
  __typename?: "User"
  capitalProviderStatus?: Maybe<CapitalProviderStatus>
  goListed?: Maybe<Scalars["Boolean"]>
  id: Scalars["ID"]
  seniorPoolDeposits: Array<SeniorPoolDeposit>
  type?: Maybe<UserType>
}

export type UserSeniorPoolDepositsArgs = {
  first?: Maybe<Scalars["Int"]>
  orderBy?: Maybe<SeniorPoolDeposit_OrderBy>
  orderDirection?: Maybe<OrderDirection>
  skip?: Maybe<Scalars["Int"]>
  where?: Maybe<SeniorPoolDeposit_Filter>
}

export enum UserType {
  Backer = "BACKER",
  Borrower = "BORROWER",
  CapitalProvider = "CAPITAL_PROVIDER",
}

export type User_Filter = {
  capitalProviderStatus?: Maybe<Scalars["String"]>
  capitalProviderStatus_contains?: Maybe<Scalars["String"]>
  capitalProviderStatus_ends_with?: Maybe<Scalars["String"]>
  capitalProviderStatus_gt?: Maybe<Scalars["String"]>
  capitalProviderStatus_gte?: Maybe<Scalars["String"]>
  capitalProviderStatus_in?: Maybe<Array<Scalars["String"]>>
  capitalProviderStatus_lt?: Maybe<Scalars["String"]>
  capitalProviderStatus_lte?: Maybe<Scalars["String"]>
  capitalProviderStatus_not?: Maybe<Scalars["String"]>
  capitalProviderStatus_not_contains?: Maybe<Scalars["String"]>
  capitalProviderStatus_not_ends_with?: Maybe<Scalars["String"]>
  capitalProviderStatus_not_in?: Maybe<Array<Scalars["String"]>>
  capitalProviderStatus_not_starts_with?: Maybe<Scalars["String"]>
  capitalProviderStatus_starts_with?: Maybe<Scalars["String"]>
  goListed?: Maybe<Scalars["Boolean"]>
  goListed_in?: Maybe<Array<Scalars["Boolean"]>>
  goListed_not?: Maybe<Scalars["Boolean"]>
  goListed_not_in?: Maybe<Array<Scalars["Boolean"]>>
  id?: Maybe<Scalars["ID"]>
  id_gt?: Maybe<Scalars["ID"]>
  id_gte?: Maybe<Scalars["ID"]>
  id_in?: Maybe<Array<Scalars["ID"]>>
  id_lt?: Maybe<Scalars["ID"]>
  id_lte?: Maybe<Scalars["ID"]>
  id_not?: Maybe<Scalars["ID"]>
  id_not_in?: Maybe<Array<Scalars["ID"]>>
  type?: Maybe<UserType>
  type_not?: Maybe<UserType>
}

export enum User_OrderBy {
  CapitalProviderStatus = "capitalProviderStatus",
  GoListed = "goListed",
  Id = "id",
  SeniorPoolDeposits = "seniorPoolDeposits",
  Type = "type",
}

export type _Block_ = {
  __typename?: "_Block_"
  /** The hash of the block */
  hash?: Maybe<Scalars["Bytes"]>
  /** The block number */
  number: Scalars["Int"]
}

/** The type for the top-level _meta field */
export type _Meta_ = {
  __typename?: "_Meta_"
  /**
   * Information about a specific subgraph block. The hash of the block
   * will be null if the _meta field has a block constraint that asks for
   * a block number. It will be filled if the _meta field has no block constraint
   * and therefore asks for the latest  block
   *
   */
  block: _Block_
  /** The deployment ID */
  deployment: Scalars["String"]
  /** If `true`, the subgraph encountered indexing errors at some past block */
  hasIndexingErrors: Scalars["Boolean"]
}

export enum _SubgraphErrorPolicy_ {
  /** Data will be returned even if the subgraph has indexing errors */
  Allow = "allow",
  /** If the subgraph has indexing errors, data will be omitted. The default. */
  Deny = "deny",
}
