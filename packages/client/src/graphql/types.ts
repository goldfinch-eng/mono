/* tslint:disable */
/* eslint-disable */
// @generated
// This file was automatically generated and should not be edited.

// ====================================================
// GraphQL query operation: getSeniorPoolAndProviders
// ====================================================

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
