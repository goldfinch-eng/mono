import {GoldfinchConfig} from "@goldfinch-eng/protocol/typechain/ethers"
import {assertIsString} from "@goldfinch-eng/utils"
import {Contract} from "ethers/lib/ethers"
import {ContractDeployer, isMainnetForking, isTestEnv, POOL_VERSION1, POOL_VERSION2} from "../deployHelpers"
import {DeployEffects} from "../migrations/deployEffects"

const versionToContractNames = {
  [POOL_VERSION1]: {
    prodContractName: "TranchedPool",
    testContractName: "TestTranchedPool",
  },
  [POOL_VERSION2]: {
    prodContractName: "TranchedPoolV2",
    testContractName: "TestTranchedPoolV2",
  },
}

export function getTranchedPoolImplName(version: string) {
  const {prodContractName, testContractName} = versionToContractNames[version]
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

/**
 * Deploy all available tranched pool implementations and return the addresses of those deployments
 */
export async function deployTranchedPool(
  deployer: ContractDeployer,
  {config, deployEffects}: {config: GoldfinchConfig; deployEffects: DeployEffects}
) {
  const logger = console.log
  const {gf_deployer} = await deployer.getNamedAccounts()
  assertIsString(gf_deployer)

  const tranchingLogic = await deployer.deployLibrary("TranchingLogic", {from: gf_deployer, args: []})

  const tranchedPoolImpls: {[version: string]: Contract} = {}
  for (const version in versionToContractNames) {
    logger(`About to deploy TranchedPool version ${version}...`)
    const contractName = getTranchedPoolImplName(version)
    const tranchedPoolImpl = await deployer.deploy(contractName, {
      from: gf_deployer,
      libraries: {["TranchingLogic"]: tranchingLogic.address},
    })
    tranchedPoolImpls[version] = tranchedPoolImpl
  }

  return tranchedPoolImpls
}
