import BigNumber from "bignumber.js"

export type SeniorPoolStatus = {
  totalPoolAssets: BigNumber
  availableToWithdrawInDollars: BigNumber | undefined
  estimatedApy: BigNumber | undefined
  totalFundsLimit: BigNumber | undefined
  remainingCapacity: BigNumber | undefined
}

export type SeniorPoolCardProps = {
  balance: string
  userBalance: string
  apy: string
  limit: string
  remainingCapacity: BigNumber | undefined
  disabled: boolean
  userBalanceDisabled: boolean
}
