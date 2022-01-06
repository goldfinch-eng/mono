import {CommunityRewards, MerkleDirectDistributor, StakingRewards} from "@goldfinch-eng/protocol/typechain/ethers"
import {deployments} from "hardhat"
import {getEthersContract} from "../../deployHelpers"
import {getDeployEffects} from "../deployEffects"

export async function main() {
  const effects = await getDeployEffects()

  const communityRewards = await getEthersContract<CommunityRewards>("CommunityRewards", {
    at: (await deployments.get("CommunityRewards")).address,
  })

  const merkleDirectDistributor = await getEthersContract<MerkleDirectDistributor>("MerkleDirectDistributor", {
    at: (await deployments.get("MerkleDirectDistributor")).address,
  })

  const stakingRewards = await getEthersContract<StakingRewards>("StakingRewards", {
    at: (await deployments.get("StakingRewards")).address,
  })

  await effects.add({
    deferred: [
      await communityRewards.populateTransaction.pause(),
      await merkleDirectDistributor.populateTransaction.pause(),
      await stakingRewards.populateTransaction.pause(),
    ],
  })

  await effects.executeDeferred()
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
