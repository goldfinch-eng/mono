import {assertIsString} from "@goldfinch-eng/utils"
import {ContractDeployer} from "../deployHelpers"

export async function deployTranchedPool(deployer: ContractDeployer) {
  const {gf_deployer} = await deployer.getNamedAccounts()
  assertIsString(gf_deployer)

  const tranchingLogic = await deployer.deployLibrary("TranchingLogic", {from: gf_deployer, args: []})

  const tranchedPoolImpl = await deployer.deploy("TranchedPool", {
    from: gf_deployer,
    libraries: {["TranchingLogic"]: tranchingLogic.address},
  })

  return tranchedPoolImpl.address
}
