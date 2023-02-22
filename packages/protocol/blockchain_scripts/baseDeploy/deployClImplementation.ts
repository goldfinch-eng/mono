import {GoldfinchConfig} from "@goldfinch-eng/protocol/typechain/ethers"
import {assertIsString} from "@goldfinch-eng/utils"
import {CONFIG_KEYS} from "../configKeys"
import {ContractDeployer, isMainnetForking, isTestEnv, updateConfig} from "../deployHelpers"
import {DeployEffects} from "../migrations/deployEffects"

const logger = console.log

const PROD_CONTRACT = "CreditLine"
const TEST_CONTRACT = "TestCreditLine"

export function getClContractName() {
  if (isTestEnv() && isMainnetForking()) {
    return PROD_CONTRACT
  } else if (isTestEnv()) {
    return TEST_CONTRACT
  } else {
    return PROD_CONTRACT
  }
}

export async function deployClImplementation(
  deployer: ContractDeployer,
  {config, deployEffects}: {config: GoldfinchConfig; deployEffects?: DeployEffects}
) {
  console.log("deploying cl implementation")
  const {gf_deployer} = await deployer.getNamedAccounts()
  assertIsString(gf_deployer)
  const accountant = await deployer.deployLibrary("Accountant", {from: gf_deployer, args: []})

  const contractName = getClContractName()
  const clDeployResult = await deployer.deploy(contractName, {
    from: gf_deployer,
    libraries: {["Accountant"]: accountant.address},
  })

  if (deployEffects !== undefined) {
    await deployEffects.add({
      deferred: [await config.populateTransaction.setCreditLineImplementation(clDeployResult.address)],
    })
  } else {
    await updateConfig(config, "address", CONFIG_KEYS.CreditLineImplementation, clDeployResult.address, {logger})
  }

  return clDeployResult.address
}
