/* tslint:disable */
/* eslint-disable */
// @generated
// This file was automatically generated and should not be edited.

// ====================================================
// GraphQL query operation: getSeniorPoolAndProviders
// ====================================================

export interface getSeniorPoolAndProviders__meta_block {
  __typename: "_Block_"
  /**
   * The block number
   */
  number: number
}

export interface getSeniorPoolAndProviders__meta {
  __typename: "_Meta_"
  /**
   * Information about a specific subgraph block. The hash of the block
   * will be null if the _meta field has a block constraint that asks for
   * a block number. It will be filled if the _meta field has no block constraint
   * and therefore asks for the latest  block
   */
  block: getSeniorPoolAndProviders__meta_block
}

export interface getSeniorPoolAndProviders_seniorPools_latestPoolStatus {
  __typename: "SeniorPoolStatus"
  /**
   * This entity is a singleton, so the id is always "1"
   */
  id: string
  rawBalance: any
  balance: any
  totalShares: any
  sharePrice: any
  totalPoolAssets: any
  totalLoansOutstanding: any
  cumulativeWritedowns: any
  cumulativeDrawdowns: any
  estimatedTotalInterest: any
  estimatedApy: any
  defaultRate: any
  remainingCapacity: any | null
}

export interface getSeniorPoolAndProviders_seniorPools {
  __typename: "SeniorPool"
  id: string
  latestPoolStatus: getSeniorPoolAndProviders_seniorPools_latestPoolStatus
}

export interface getSeniorPoolAndProviders_user_capitalProviderStatus {
  __typename: "CapitalProviderStatus"
  numShares: any
  availableToWithdraw: any
  availableToWithdrawInDollars: any | null
  allowance: any
  weightedAverageSharePrice: any | null
  unrealizedGains: any | null
  unrealizedGainsPercentage: any | null
  unrealizedGainsInDollars: any | null
}

export interface getSeniorPoolAndProviders_user_seniorPoolDeposits {
  __typename: "SeniorPoolDeposit"
  /**
   * tx hash
   */
  id: string
  amount: any
  shares: any
  blockNumber: any
  timestamp: any
}

export interface getSeniorPoolAndProviders_user {
  __typename: "User"
  id: string
  goListed: boolean | null
  capitalProviderStatus: getSeniorPoolAndProviders_user_capitalProviderStatus | null
  seniorPoolDeposits: getSeniorPoolAndProviders_user_seniorPoolDeposits[]
}

export interface getSeniorPoolAndProviders {
  /**
   * Access to subgraph metadata
   */
  _meta: getSeniorPoolAndProviders__meta | null
  seniorPools: getSeniorPoolAndProviders_seniorPools[]
  user: getSeniorPoolAndProviders_user | null
}

export interface getSeniorPoolAndProvidersVariables {
  userID: string
}

/* tslint:disable */
/* eslint-disable */
// @generated
// This file was automatically generated and should not be edited.

// ====================================================
// GraphQL query operation: getSeniorPool
// ====================================================

export interface getSeniorPool__meta_block {
  __typename: "_Block_"
  /**
   * The block number
   */
  number: number
}

export interface getSeniorPool__meta {
  __typename: "_Meta_"
  /**
   * Information about a specific subgraph block. The hash of the block
   * will be null if the _meta field has a block constraint that asks for
   * a block number. It will be filled if the _meta field has no block constraint
   * and therefore asks for the latest  block
   */
  block: getSeniorPool__meta_block
}

export interface getSeniorPool_seniorPool_latestPoolStatus {
  __typename: "SeniorPoolStatus"
  /**
   * This entity is a singleton, so the id is always "1"
   */
  id: string
  rawBalance: any
  balance: any
  totalShares: any
  sharePrice: any
  totalPoolAssets: any
  totalLoansOutstanding: any
}

export interface getSeniorPool_seniorPool {
  __typename: "SeniorPool"
  latestPoolStatus: getSeniorPool_seniorPool_latestPoolStatus
}

export interface getSeniorPool {
  /**
   * Access to subgraph metadata
   */
  _meta: getSeniorPool__meta | null
  seniorPool: getSeniorPool_seniorPool | null
}

/* tslint:disable */
/* eslint-disable */
// @generated
// This file was automatically generated and should not be edited.

// ====================================================
// GraphQL query operation: getTranchedPoolsData
// ====================================================

export interface getTranchedPoolsData__meta_block {
  __typename: "_Block_"
  /**
   * The block number
   */
  number: number
}

export interface getTranchedPoolsData__meta {
  __typename: "_Meta_"
  /**
   * Information about a specific subgraph block. The hash of the block
   * will be null if the _meta field has a block constraint that asks for
   * a block number. It will be filled if the _meta field has no block constraint
   * and therefore asks for the latest  block
   */
  block: getTranchedPoolsData__meta_block
}

export interface getTranchedPoolsData_tranchedPools_creditLine {
  __typename: "CreditLine"
  id: string
  interestApr: any
  limit: any
  balance: any
  remainingPeriodDueAmount: any
  remainingTotalDueAmount: any
  availableCredit: any
  interestAccruedAsOf: any
  paymentPeriodInDays: any
  termInDays: any
  nextDueTime: any
  interestOwed: any
  termEndTime: any
  lastFullPaymentTime: any
  periodDueAmount: any | null
  interestAprDecimal: any
  collectedPaymentBalance: any | null
  totalDueAmount: any | null
  dueDate: string | null
  name: string | null
}

export interface getTranchedPoolsData_tranchedPools_backers_user_tokens_tranchedPool {
  __typename: "TranchedPool"
  id: string
}

export interface getTranchedPoolsData_tranchedPools_backers_user_tokens {
  __typename: "TranchedPoolToken"
  id: string
  tranchedPool: getTranchedPoolsData_tranchedPools_backers_user_tokens_tranchedPool
  tranche: any
  principalAmount: any
  principalRedeemed: any
  interestRedeemed: any
  principalRedeemable: any
  interestRedeemable: any
}

export interface getTranchedPoolsData_tranchedPools_backers_user {
  __typename: "User"
  id: string
  tokens: getTranchedPoolsData_tranchedPools_backers_user_tokens[] | null
}

export interface getTranchedPoolsData_tranchedPools_backers {
  __typename: "PoolBacker"
  id: string
  user: getTranchedPoolsData_tranchedPools_backers_user
  balance: any
  unrealizedGains: any
  principalAmount: any
  principalRedeemed: any
  interestRedeemed: any
  principalAtRisk: any
  principalRedeemable: any
  interestRedeemable: any
  availableToWithdraw: any
}

export interface getTranchedPoolsData_tranchedPools_juniorTranches {
  __typename: "JuniorTrancheInfo"
  id: string
  lockedUntil: any
  principalDeposited: any
  principalSharePrice: any
  interestSharePrice: any
  trancheId: any
}

export interface getTranchedPoolsData_tranchedPools_seniorTranches {
  __typename: "SeniorTrancheInfo"
  id: string
  lockedUntil: any
  principalDeposited: any
  principalSharePrice: any
  interestSharePrice: any
  trancheId: any
}

export interface getTranchedPoolsData_tranchedPools {
  __typename: "TranchedPool"
  id: string
  estimatedSeniorPoolContribution: any
  isPaused: boolean
  estimatedLeverageRatio: any
  juniorFeePercent: any
  reserveFeePercent: any
  totalDeposited: any
  creditLine: getTranchedPoolsData_tranchedPools_creditLine
  backers: getTranchedPoolsData_tranchedPools_backers[]
  juniorTranches: getTranchedPoolsData_tranchedPools_juniorTranches[]
  seniorTranches: getTranchedPoolsData_tranchedPools_seniorTranches[]
}

export interface getTranchedPoolsData {
  /**
   * Access to subgraph metadata
   */
  _meta: getTranchedPoolsData__meta | null
  tranchedPools: getTranchedPoolsData_tranchedPools[]
}

/* tslint:disable */
/* eslint-disable */
// @generated
// This file was automatically generated and should not be edited.

//==============================================================
// START Enums and Input Objects
//==============================================================

//==============================================================
// END Enums and Input Objects
//==============================================================
