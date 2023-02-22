import {assertIsString} from "@goldfinch-eng/utils"
import {ContractDeployer, isMainnetForking, isTestEnv} from "../deployHelpers"

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

export async function deployTranchedPool(deployer: ContractDeployer) {
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
