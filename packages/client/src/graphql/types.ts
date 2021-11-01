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

export interface getSeniorPoolAndProviders_seniorPools_lastestPoolStatus {
  __typename: "SeniorPoolStatus"
  id: string
  rawBalance: any
  compoundBalance: any
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
  lastestPoolStatus: getSeniorPoolAndProviders_seniorPools_lastestPoolStatus
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

//==============================================================
// START Enums and Input Objects
//==============================================================

//==============================================================
// END Enums and Input Objects
//==============================================================
