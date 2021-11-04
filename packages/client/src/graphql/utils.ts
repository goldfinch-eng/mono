import BigNumber from "bignumber.js"

export interface GraphSeniorPoolData {
  type: string
  address: string
  compoundBalance: BigNumber
  balance: BigNumber
  totalShares: BigNumber
  totalPoolAssets: BigNumber
  totalLoansOutstanding: BigNumber
  estimatedTotalInterest: BigNumber
  estimatedApy: BigNumber
  defaultRate: BigNumber
  rawBalance: BigNumber
  cumulativeDrawdowns: BigNumber
  cumulativeWritedowns: BigNumber
  remainingCapacity: (this: any, maxCapacity: BigNumber) => BigNumber
  isPaused?: boolean
}

export interface GraphUserData {
  type: string
  address: string
  goListed: boolean
  numShares: BigNumber
  availableToWithdraw: BigNumber
  availableToWithdrawInDollars: BigNumber
  allowance: BigNumber
  weightedAverageSharePrice: BigNumber
  unrealizedGains: BigNumber
  unrealizedGainsInDollars: BigNumber
  unrealizedGainsPercentage: BigNumber
}

export function isGraphUserData(value: any): value is GraphUserData {
  if (!value) return false
  return value.hasOwnProperty("type") && value.type === "GraphUserData"
}

export function isGraphSeniorPoolData(value: any): value is GraphSeniorPoolData {
  if (!value) return false
  return value.hasOwnProperty("type") && value.type === "GraphSeniorPoolData"
}
