import {usdcVal} from "@goldfinch-eng/protocol/test/testHelpers"
import {BackerRewards, GFI, GoldfinchConfig} from "@goldfinch-eng/protocol/typechain/ethers"
import BigNumber from "bignumber.js"
import {ContractDeployer, ContractUpgrader, getEthersContract, getProtocolOwner, getTruffleContract} from "../../deployHelpers"
import {changeImplementations, getDeployEffects} from "../deployEffects"
import hre from "hardhat"
import { deployTranchedPool } from "../../baseDeploy/deployTranchedPool"
import { GoldfinchConfigInstance } from "@goldfinch-eng/protocol/typechain/truffle"

export async function main() {
  const deployer = new ContractDeployer(console.log, hre)
  const upgrader = new ContractUpgrader(deployer)
  const config = await getEthersContract<GoldfinchConfig>("GoldfinchConfig")


  const deployEffects = await getDeployEffects({
    title: "v2.3.5 migration",
    description: "Load backer rewards and set parameters",
  })

  const gfi = await getEthersContract<GFI>("GFI")
  const backerRewards = await getEthersContract<BackerRewards>("BackerRewards")
  const owner = await getProtocolOwner()
  // take 2% of the total GFI supply
  const gfiToLoadIntoBackerRewards = new BigNumber((await gfi.totalSupply()).toString()).multipliedBy("0.02")
  console.log(gfiToLoadIntoBackerRewards.toString())

  // 1. Deploy upgraded tranched pool
  await deployTranchedPool(deployer, {config, deployEffects})

  // 2. Upgrade other contracts
  const upgradedContracts = await upgrader.upgrade({
    contracts: ["BackerRewards"],
  })

  // 2. Change implementations
  deployEffects.add(
    await changeImplementations({
      contracts: upgradedContracts,
    })
  )

  // 3. Load backer rewards
  deployEffects.add({
    deferred: [
      await gfi.populateTransaction.approve(owner, gfiToLoadIntoBackerRewards.toString()),
      await gfi.populateTransaction.transferFrom(owner, backerRewards.address, gfiToLoadIntoBackerRewards.toString()),
      await backerRewards.populateTransaction.setTotalRewards(gfiToLoadIntoBackerRewards.toString()),
      await backerRewards.populateTransaction.setMaxInterestDollarsEligible(usdcVal(1_000_000_000).toString()),
    ],
  })

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
