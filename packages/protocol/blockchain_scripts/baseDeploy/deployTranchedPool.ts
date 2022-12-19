import {GoldfinchConfig} from "@goldfinch-eng/protocol/typechain/ethers"
import {assertIsString} from "@goldfinch-eng/utils"
import {Contract} from "ethers/lib/ethers"
import {ContractDeployer, isMainnetForking, isTestEnv} from "../deployHelpers"
import {DeployEffects} from "../migrations/deployEffects"

export function getTranchedPoolImplName() {
  const prodContractName = "TranchedPool"
  const testContractName = "TestTranchedPool"
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

  const contractName = getTranchedPoolImplName()
  const tranchedPoolImpl = await deployer.deploy(contractName, {
    from: gf_deployer,
    libraries: {["TranchingLogic"]: tranchingLogic.address},
  })

  return tranchedPoolImpl.address
}
