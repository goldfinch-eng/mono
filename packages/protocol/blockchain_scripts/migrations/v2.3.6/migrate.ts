import {bigVal} from "@goldfinch-eng/protocol/test/testHelpers"
import {BackerRewards, GFI, GoldfinchConfig} from "@goldfinch-eng/protocol/typechain/ethers"
import BigNumber from "bignumber.js"
import {ContractDeployer, ContractUpgrader, getEthersContract, getProtocolOwner} from "../../deployHelpers"
import {changeImplementations, getDeployEffects} from "../deployEffects"
import hre from "hardhat"
import {deployTranchedPool} from "../../baseDeploy/deployTranchedPool"

export async function main() {
  const deployer = new ContractDeployer(console.log, hre)
  const upgrader = new ContractUpgrader(deployer)
  const config = await getEthersContract<GoldfinchConfig>("GoldfinchConfig")

  const deployEffects = await getDeployEffects({
    title: "v2.3.6 migration",
    description: "Upgrade StakingRewards",
  })

  // Upgrade contracts
  const upgradedContracts = await upgrader.upgrade({
    contracts: ["StakingRewards"],
  })

  // Change implementations
  deployEffects.add(
    await changeImplementations({
      contracts: upgradedContracts,
    })
  )

  await deployEffects.executeDeferred()
  return {upgradedContracts}
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
}
