import {assertIsString} from "@goldfinch-eng/utils"
import {CONFIG_KEYS} from "../configKeys"
import {ContractDeployer, isTestEnv, updateConfig} from "../deployHelpers"
import {DeployOpts} from "../types"

export async function deployTranchedPool(deployer: ContractDeployer, {config}: DeployOpts) {
  const logger = console.log
  const {gf_deployer} = await deployer.getNamedAccounts()

  logger("About to deploy TranchedPool...")
  let contractName = "TranchedPool"

  if (isTestEnv()) {
    contractName = "TestTranchedPool"
  }

  assertIsString(gf_deployer)
  const tranchingLogic = await deployer.deployLibrary("TranchingLogic", {from: gf_deployer, args: []})
  const tranchedPoolImpl = await deployer.deploy(contractName, {
    from: gf_deployer,
    libraries: {["TranchingLogic"]: tranchingLogic.address},
  })
  logger("Updating config...")
  await updateConfig(config, "address", CONFIG_KEYS.TranchedPoolImplementation, tranchedPoolImpl.address, {logger})
  logger("Updated TranchedPool config address to:", tranchedPoolImpl.address)
  return tranchedPoolImpl
}
