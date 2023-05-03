import {CommunityRewards, MerkleDirectDistributor, StakingRewards} from "@goldfinch-eng/protocol/typechain/ethers"
import {deployments} from "hardhat"
import {getEthersContract} from "../../deployHelpers"
import {getDeployEffects} from "../deployEffects"

// Unpause and set token launch time in second
export async function main() {
  const effects = await getDeployEffects({
    title: "Unpause for manual testing",
    description: "Unpause contracts, set token launch time in seconds to 2:40pm PT",
  })

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
      await communityRewards.populateTransaction.unpause(),
      await merkleDirectDistributor.populateTransaction.unpause(),
      await stakingRewards.populateTransaction.unpause(),
      await communityRewards.populateTransaction.setTokenLaunchTimeInSeconds(1641508800),
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
