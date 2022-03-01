import {ContractDeployer, ContractUpgrader, getProtocolOwner, getTruffleContract} from "../../deployHelpers"
import hre from "hardhat"
import {changeImplementations, DeployEffects} from "../deployEffects"
import {UniqueIdentityInstance} from "@goldfinch-eng/protocol/typechain/truffle"

export async function deploy(deployEffects: DeployEffects) {
  const deployer = new ContractDeployer(console.log, hre)
  const upgrader = new ContractUpgrader(deployer)
  const protocolOwner = await getProtocolOwner()

  // 1.
  // Upgrade existing contracts
  const upgradedContracts = await upgrader.upgrade({
    contracts: ["Go"],
  })

  await deployEffects.add(await changeImplementations({contracts: upgradedContracts}))

  const uniqueIdentity = await getTruffleContract<UniqueIdentityInstance>("UniqueIdentity", {from: protocolOwner})
  await uniqueIdentity.setSupportedUIDTypes([0, 1, 2, 3, 4], [true, true, true, true, true])

  return {
    deployedContracts: {},
    upgradedContracts,
  }
}
