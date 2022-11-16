import {GoldfinchConfig} from "@goldfinch-eng/protocol/typechain/ethers"
import {BN} from "bn.js"
import hre from "hardhat"
import {deployWithdrawalRequestToken} from "../../baseDeploy/deployWithdrawalRequestToken"
import {CONFIG_KEYS} from "../../configKeys"
import {ContractDeployer, ContractUpgrader, getEthersContract} from "../../deployHelpers"
import {changeImplementations, getDeployEffects} from "../deployEffects"

export async function main() {
  const deployer = new ContractDeployer(console.log, hre)
  const upgrader = new ContractUpgrader(deployer)
  const deployEffects = await getDeployEffects({
    title: "v2.8 upgrade",
    description: "SeniorPool Epoch Withdrawals",
  })

  const upgradedContracts = await upgrader.upgrade({
    contracts: ["SeniorPool", "StakingRewards", "Zapper", "Fidu"],
  })
  await deployEffects.add(await changeImplementations({contracts: upgradedContracts}))

  const gfConfig = await getEthersContract<GoldfinchConfig>("GoldfinchConfig")
  await deployEffects.add({
    deferred: [
      await gfConfig.populateTransaction.setNumber(CONFIG_KEYS.SeniorPoolWithdrawalCancelationFeeInBps, "100"),
    ],
  })
  await deployWithdrawalRequestToken(deployer, {config: gfConfig})

  await deployEffects.executeDeferred()
  return {}
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
}
