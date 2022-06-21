import {GoldfinchConfig} from "@goldfinch-eng/protocol/typechain/ethers"
import {CommunityRewardsInstance} from "@goldfinch-eng/protocol/typechain/truffle"
import {assertIsString} from "@goldfinch-eng/utils"
import {Deployed, TOKEN_LAUNCH_TIME_IN_SECONDS} from "../baseDeploy"
import {ContractDeployer, getProtocolOwner, getTruffleContract} from "../deployHelpers"
import {DeployEffects} from "../migrations/deployEffects"

const logger = console.log

export async function deployCommunityRewards(
  deployer: ContractDeployer,
  {
    config,
    deployEffects,
  }: {
    config: GoldfinchConfig

    deployEffects: DeployEffects
  }
): Promise<Deployed<CommunityRewardsInstance>> {
  const contractName = "CommunityRewards"
  logger(`About to deploy ${contractName}...`)
  const {gf_deployer} = await deployer.getNamedAccounts()
  assertIsString(gf_deployer)
  const protocol_owner = await getProtocolOwner()
  const communityRewards = await deployer.deploy(contractName, {
    from: gf_deployer,
    gasLimit: 4000000,
    proxy: {
      owner: protocol_owner,
      execute: {
        init: {
          methodName: "__initialize__",
          args: [protocol_owner, config.address, TOKEN_LAUNCH_TIME_IN_SECONDS],
        },
      },
    },
  })
  const contract = await getTruffleContract<CommunityRewardsInstance>(contractName, {at: communityRewards.address})

  return {name: contractName, contract}
}
