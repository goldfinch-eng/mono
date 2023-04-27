import {HardhatRuntimeEnvironment} from "hardhat/types"
import {MAINNET_CHAIN_ID} from "../blockchain_scripts/deployHelpers"
import {setUpForTesting} from "../blockchain_scripts/setUpForTesting"

async function main(hre) {
  await setUpForTesting(hre)
}

module.exports = main
module.exports.dependencies = ["baseDeploy"]
module.exports.tags = ["setupForTesting"]
module.exports.skip = async ({getChainId}: HardhatRuntimeEnvironment) => {
  const chainId = await getChainId()
  return String(chainId) === MAINNET_CHAIN_ID
}
