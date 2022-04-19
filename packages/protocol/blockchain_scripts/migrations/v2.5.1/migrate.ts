import {
  BackerRewards,
  Go,
  GoldfinchFactory,
  PoolTokens,
  StakingRewards,
  UniqueIdentity,
} from "@goldfinch-eng/protocol/typechain/ethers"
import {getEthersContract, PAUSER_ROLE} from "../../deployHelpers"
import {getDeployEffects} from "../deployEffects"

export const EMERGENCY_PAUSER_ADDR = "0x061e0b0087a01127554ffef8f9c4c6e9447ad9dd"

export async function main() {
  const deployEffects = await getDeployEffects({
    title: "v2.5.1 Script",
    description: `Grants pauser role to emergency pauser at ${EMERGENCY_PAUSER_ADDR} `,
  })

  console.log("Beginning v2.5.1 upgrade")
  const stakingRewards = await getEthersContract<StakingRewards>("StakingRewards")
  const backerRewards = await getEthersContract<BackerRewards>("BackerRewards")
  const uniqueIdentity = await getEthersContract<UniqueIdentity>("UniqueIdentity")
  const go = await getEthersContract<Go>("Go")
  const goldfinchFactory = await getEthersContract<GoldfinchFactory>("GoldfinchFactory")
  const poolTokens = await getEthersContract<PoolTokens>("PoolTokens")

  deployEffects.add({
    deferred: [
      await stakingRewards.populateTransaction.grantRole(PAUSER_ROLE, EMERGENCY_PAUSER_ADDR),
      await backerRewards.populateTransaction.grantRole(PAUSER_ROLE, EMERGENCY_PAUSER_ADDR),
      await uniqueIdentity.populateTransaction.grantRole(PAUSER_ROLE, EMERGENCY_PAUSER_ADDR),
      await go.populateTransaction.grantRole(PAUSER_ROLE, EMERGENCY_PAUSER_ADDR),
      await poolTokens.populateTransaction.grantRole(PAUSER_ROLE, EMERGENCY_PAUSER_ADDR),
      await goldfinchFactory.populateTransaction.grantRole(PAUSER_ROLE, EMERGENCY_PAUSER_ADDR),
    ],
  })

  await deployEffects.executeDeferred()
  console.log("finished v2.5.1 deploy")
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
