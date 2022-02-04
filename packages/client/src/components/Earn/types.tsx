import BigNumber from "bignumber.js"
import {BlockInfo} from "../../utils"

export type SeniorPoolStatus = {
  totalPoolAssets: BigNumber
  availableToWithdrawInDollars: BigNumber | undefined
  estimatedApy: BigNumber | undefined
  totalFundsLimit: BigNumber | undefined
  remainingCapacity: BigNumber | undefined
}

export type TranchedPoolsEstimatedBackersOnlyApyFromGfi = {
  currentBlock: BlockInfo
  estimatedBackersOnlyApyFromGfi: {[tranchedPoolAddress: string]: BigNumber | undefined}
}
