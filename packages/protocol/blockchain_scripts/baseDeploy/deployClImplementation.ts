import {GoldfinchConfig} from "@goldfinch-eng/protocol/typechain/ethers"
import {assertIsString} from "@goldfinch-eng/utils"
import {CONFIG_KEYS} from "../configKeys"
import {
  ContractDeployer,
  isMainnetForking,
  isTestEnv,
  POOL_VERSION1,
  POOL_VERSION2,
  updateConfig,
} from "../deployHelpers"
import {DeployEffects} from "../migrations/deployEffects"

const logger = console.log

/**
 * Map from TranchedPool version to its CreditLine contract
 */
export const poolVersionToCreditLines = {
  [POOL_VERSION1]: {
    prodContractName: "CreditLine",
    testContractName: "TestCreditLine",
  },
  [POOL_VERSION2]: {
    prodContractName: "CreditLineV2",
    testContractName: "TestCreditLineV2",
  },
}

export function getClContractName(poolVersion: string) {
  const {prodContractName, testContractName} = poolVersionToCreditLines[poolVersion]
  assertIsString(prodContractName)
  assertIsString(testContractName)
  if (isTestEnv() && isMainnetForking()) {
    return prodContractName
  } else if (isTestEnv()) {
    return testContractName
  } else {
    return prodContractName
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

  // Deploy all impls
  const clImpls = {}
  for (const version in poolVersionToCreditLines) {
    console.log(`About to deploy CreditLine (Pool version ${version}`)
    const contractName = getClContractName(version)
    const clDeployResult = await deployer.deploy(contractName, {
      from: gf_deployer,
      libraries: {["Accountant"]: accountant.address},
    })
    clImpls[version] = clDeployResult.address
  }

  // The config will point to v0.1.0. If you'd like to run tests on different versions than
  // you can change this in your test setup
  const implAddress = clImpls["0.1.0"]
  assertIsString(implAddress)
  console.log(`Setting Goldfinch impl to ${implAddress} (Pool version 0.1.0)`)
  if (deployEffects !== undefined) {
    await deployEffects.add({
      deferred: [await config.populateTransaction.setCreditLineImplementation(implAddress)],
    })
  } else {
    await updateConfig(config, "address", CONFIG_KEYS.CreditLineImplementation, implAddress, {logger})
  }

  return clImpls
}
