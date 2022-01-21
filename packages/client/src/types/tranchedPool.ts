import BigNumber from "bignumber.js"
import {TranchedPool} from "../ethereum/tranchedPool"

export type ForTranchedPool<T> = {
  tranchedPool: TranchedPool
  value: T
}

export type ByTranchedPool<T> = {
  [tranchedPoolAddress: string]: ForTranchedPool<T>
}

export type ScheduledRepayment = {
  timestamp: number
  usdcAmount: BigNumber
}

export type RepaymentSchedule = ScheduledRepayment[]

export type RepaymentSchedulesByTranchedPool = ByTranchedPool<RepaymentSchedule>

export type ScheduledRepaymentEstimatedReward = {
  timestamp: number
  gfiAmount: BigNumber
}

export type EstimatedRewards = {
  annualizedPerPrincipalDollar: BigNumber
}

export type EstimatedRewardsByTranchedPool = ByTranchedPool<EstimatedRewards>
