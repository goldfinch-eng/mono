import {GoldfinchConfig, StakingRewards} from "@goldfinch-eng/protocol/typechain/ethers"
import {assertIsString} from "@goldfinch-eng/utils"
import {CONFIG_KEYS} from "../configKeys"
import {ContractDeployer, getProtocolOwner} from "../deployHelpers"
import {DeployEffects} from "../migrations/deployEffects"

const logger = console.log

export async function deployLPStakingRewards(
  deployer: ContractDeployer,
  {config, deployEffects}: {config: GoldfinchConfig; deployEffects: DeployEffects}
): Promise<StakingRewards> {
  logger("About to deploy LPStakingRewards...")
  const {gf_deployer} = await deployer.getNamedAccounts()
  assertIsString(gf_deployer)
  const protocol_owner = await getProtocolOwner()
  const stakingRewards = await deployer.deploy<StakingRewards>("StakingRewards", {
    from: gf_deployer,
    gasLimit: 4000000,
    proxy: {
      owner: protocol_owner,
      execute: {
        init: {
          methodName: "__initialize__",
          args: [protocol_owner, config.address],
        },
      },
    },
  })

  await deployEffects.add({
    deferred: [await config.populateTransaction.setAddress(CONFIG_KEYS.StakingRewards, stakingRewards.address)],
  })

  return stakingRewards
}
