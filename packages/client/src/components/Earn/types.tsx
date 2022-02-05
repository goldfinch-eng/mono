import BigNumber from "bignumber.js"
import {BlockInfo} from "../../utils"

export type SeniorPoolStatus = {
  totalPoolAssets: BigNumber
  availableToWithdrawInDollars: BigNumber | undefined
  estimatedApy: BigNumber | undefined
  totalFundsLimit: BigNumber | undefined
  remainingCapacity: BigNumber | undefined
}

export type TranchedPoolsEstimatedApyFromGfi = {
  currentBlock: BlockInfo
  estimatedApyFromGfi: {
    [tranchedPoolAddress: string]: {
      backersOnly: BigNumber | undefined
      seniorPoolMatching: BigNumber | undefined
    }
  }
}
