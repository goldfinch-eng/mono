import {assertIsString} from "@goldfinch-eng/utils"
import {CONFIG_KEYS} from "../configKeys"
import {ContractDeployer, updateConfig} from "../deployHelpers"
import {DeployOpts} from "../types"

const logger = console.log

export async function deployClImplementation(deployer: ContractDeployer, {config}: DeployOpts) {
  const {gf_deployer} = await deployer.getNamedAccounts()

  assertIsString(gf_deployer)
  const accountant = await deployer.deployLibrary("Accountant", {from: gf_deployer, args: []})
  // Deploy the credit line as well so we generate the ABI
  assertIsString(gf_deployer)
  const clDeployResult = await deployer.deploy("CreditLine", {
    from: gf_deployer,
    libraries: {["Accountant"]: accountant.address},
  })
  await updateConfig(config, "address", CONFIG_KEYS.CreditLineImplementation, clDeployResult.address, {logger})
}
