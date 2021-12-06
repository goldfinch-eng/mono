import {assertIsString} from "@goldfinch-eng/utils"
import {CONFIG_KEYS} from "../configKeys"
import {ContractDeployer, updateConfig} from "../deployHelpers"
import {DeployOpts} from "../types"

const logger = console.log

export async function deployMigratedTranchedPool(deployer: ContractDeployer, {config}: DeployOpts) {
  const {gf_deployer} = await deployer.getNamedAccounts()

  logger("About to deploy MigratedTranchedPool...")
  const contractName = "MigratedTranchedPool"

  assertIsString(gf_deployer)
  const migratedTranchedPoolImpl = await deployer.deploy(contractName, {from: gf_deployer})

  await updateConfig(
    config,
    "address",
    CONFIG_KEYS.MigratedTranchedPoolImplementation,
    migratedTranchedPoolImpl.address,
    {logger}
  )
  return migratedTranchedPoolImpl
}
