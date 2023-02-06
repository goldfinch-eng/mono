import hre from "hardhat"
const {deployments, ethers} = hre
import {JsonRpcBatchProvider} from "@ethersproject/providers"
import stakingRewardsDeployment from "../deployments/mainnet/StakingRewards.json"
import {ContractInterface} from "ethers"
import {assertNonNullable} from "@goldfinch-eng/utils"
async function main() {
  const stakingRewardsAbi = (stakingRewardsDeployment as {abi: any}).abi as ContractInterface
  const stakingRewardsAddress = process.env.STAKING_REWARDS_ADDRESS || (await deployments.get("StakingRewards")).address

  assertNonNullable(process.env.ALCHEMY_API_KEY, "ALCHEMY_API_KEY is required")

  // Use AlchemyProvider directly to bypass hardhat's global timeout on provider
  const provider = new ethers.providers.AlchemyProvider("mainnet", process.env.ALCHEMY_API_KEY)

  const network = await provider.getNetwork()
  const connection = provider.connection

  console.log(`network: ${JSON.stringify(network)}`)
  console.log(`connection: ${JSON.stringify(connection)}`)
  const batchProvider = new JsonRpcBatchProvider(connection, network)
  await batchProvider.ready
  const stakingRewards = new ethers.Contract(stakingRewardsAddress, stakingRewardsAbi, batchProvider)
  console.log("Staked Fidu positions")
  console.log("------------------------------------------------------------")

  const numStakedFiduTokens = (await stakingRewards.totalSupply()).toNumber()

  console.log(`TokenId,FiduHolder,Staked FIDU Amount,PositionType`)
  const batchSize = 300
  for (let batchIndex = 0; batchIndex < Math.ceil(numStakedFiduTokens / batchSize); batchIndex++) {
    const batchOfPromises: Promise<string>[] = []
    for (
      let tokenId = batchIndex * batchSize + 1;
      tokenId < Math.min((batchIndex + 1) * batchSize + 1, numStakedFiduTokens);
      tokenId++
    ) {
      const promise = async () => {
        const position = await stakingRewards.getPosition(tokenId)
        const tokenHolder = await stakingRewards.ownerOf(tokenId)
        console.log(`${tokenId},${tokenHolder},${position.amount},${position.positionType}`)
      }
      batchOfPromises.push(promise())
    }
    await Promise.all(batchOfPromises)
    await new Promise((r) => setTimeout(r, 2000)) // Wait to let compute limit catch up.
  }
}

if (require.main === module) {
  // If this is run as a script, then call main. If it's imported (for tests), this block will not run
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
}

export default main
