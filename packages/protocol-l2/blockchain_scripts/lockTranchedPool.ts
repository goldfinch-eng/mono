import {assertIsString, assertNonNullable} from "@goldfinch-eng/utils"
import {ethers} from "hardhat"
import {HardhatRuntimeEnvironment} from "hardhat/types"
import {SeniorPool, TranchedPool} from "../typechain/ethers"
import {getEthersContract, getProtocolOwner} from "./deployHelpers"

/**
 * Locks a TranchedPool so a borrower can start to drawdown. Convenience function for testing various UI elements
 * on a TranchedPool page. Can also be combined with `setupForTesting` to quickly spin up an open borrower pool,
 * fund it, lock it, and then draw it down.
 */
export async function lockTranchedPool(hre: HardhatRuntimeEnvironment, tranchedPoolAddress: string) {
  console.log("🔒 Start lockTranchedPool...")

  const protocol_owner = await getProtocolOwner()
  assertIsString(protocol_owner)
  const protocolOwnerSigner = ethers.provider.getSigner(protocol_owner)

  const tranchedPool = await getEthersContract<TranchedPool>("TranchedPool", {at: tranchedPoolAddress})
  assertNonNullable(tranchedPool)
  const seniorPool = await getEthersContract<SeniorPool>("SeniorPool")
  assertNonNullable(seniorPool)

  console.log(`🔒 Locking junior tranche of pool ${tranchedPoolAddress}...`)
  await tranchedPool.connect(protocolOwnerSigner).lockJuniorCapital()

  console.log(`🔒 Senior Pool funding senior tranche...`)
  await seniorPool.invest(tranchedPoolAddress)

  console.log(`🔒 Locking junior tranche of pool ${tranchedPoolAddress}...`)
  await tranchedPool.connect(protocolOwnerSigner).lockPool()

  console.log("🔒 Successfully locked")
}
