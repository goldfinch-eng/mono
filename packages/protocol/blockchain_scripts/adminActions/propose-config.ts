import {assertIsChainId} from "../deployHelpers"
import hre from "hardhat"
import {DefenderUpgrader} from "../upgrade"

const logger = console.log

async function main() {
  await proposeConfig(hre)
}

async function proposeConfig(hre, oldConfigAddress?) {
  oldConfigAddress = oldConfigAddress || process.env.OLD_CONFIG_ADDRESS
  if (!oldConfigAddress) {
    throw new Error("You must pass OLD_CONFIG_ADDRESS as an envvar")
  }

  const newConfig = await hre.deployments.get("GoldfinchConfig")
  const newConfigAddress = newConfig.address

  if (oldConfigAddress.toLowerCase() === newConfigAddress.toLowerCase()) {
    throw new Error(
      `Old config address ${oldConfigAddress} and new config address ${newConfigAddress} are the same. Make sure a new GoldfinchConfig has been deployed and is reflected in the deployment files.`
    )
  }

  const chainId = await hre.getChainId()
  assertIsChainId(chainId)
  const defender = new DefenderUpgrader({hre, logger, chainId})
  await defender.setNewConfigAddress(oldConfigAddress, newConfigAddress)
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
}

export {proposeConfig}
