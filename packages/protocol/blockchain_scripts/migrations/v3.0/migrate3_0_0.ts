import {GoldfinchConfig, SeniorPool, StakingRewards} from "@goldfinch-eng/protocol/typechain/ethers"
import hre from "hardhat"
import {deployWithdrawalRequestToken} from "../../baseDeploy/deployWithdrawalRequestToken"
import {CONFIG_KEYS} from "../../configKeys"
import {ContractDeployer, ContractUpgrader, getEthersContract} from "../../deployHelpers"
import {changeImplementations, getDeployEffects} from "../deployEffects"

export async function main() {
  const deployer = new ContractDeployer(console.log, hre)
  const upgrader = new ContractUpgrader(deployer)
  const stakingRewards = await getEthersContract<StakingRewards>("StakingRewards")

  const deployEffects = await getDeployEffects({
    title: "v3.0 upgrade",
    description: "SeniorPool Epoch Withdrawals",
  })

  const upgradedContracts = await upgrader.upgrade({
    contracts: ["SeniorPool", "StakingRewards", "Zapper"],
  })
  await deployEffects.add(await changeImplementations({contracts: upgradedContracts}))

  const seniorPool = await getEthersContract<SeniorPool>("SeniorPool")

  const gfConfig = await getEthersContract<GoldfinchConfig>("GoldfinchConfig")
  await deployEffects.add({
    deferred: [
      await seniorPool.populateTransaction.initializeEpochs(),
      await gfConfig.populateTransaction.setNumber(CONFIG_KEYS.SeniorPoolWithdrawalCancelationFeeInBps, "100"),
      await stakingRewards.populateTransaction.setBaseURI(
        "https://us-central1-goldfinch-frontends-prod.cloudfunctions.net/stakingRewardsTokenMetadata/"
      ),
    ],
  })
  await deployWithdrawalRequestToken(deployer, {config: gfConfig, deployEffects})

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
