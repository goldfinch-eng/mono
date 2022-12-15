import {TranchedPool} from "../typechain/ethers"
import {getEthersContract} from "./deployHelpers"

/**
 * Assesses a TranchedPool in order to trigger a repayment from the Credit Line.
 *
 * On mainnet, we have a Defender autotask that runs every hour and calls TranchedPoool.assess(). This collects
 * payment from the Credit Line for the most recently *past* nextDueTime and updates the Credit Line accordingly.
 *
 * On local we do not have this bot, thus this allows us to manually trigger the assess for testing purposes.
 */
export async function assessTranchedPool(tranchedPoolAddress: string) {
  console.log("💳 Start assessTranchedPool...")
  const tranchedPool = await getEthersContract<TranchedPool>("TranchedPool", {at: tranchedPoolAddress})

  await tranchedPool.assess()

  console.log("💳 Successfully assessed")
}
