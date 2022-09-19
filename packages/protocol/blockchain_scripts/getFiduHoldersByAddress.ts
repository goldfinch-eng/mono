import hre from "hardhat"
const {deployments, ethers} = hre

async function main() {
  const stakingRewardsAddress = process.env.STAKING_REWARDS_ADDRESS || (await deployments.get("StakingRewards")).address
  const stakingRewards = await ethers.getContractAt("StakingRewards", stakingRewardsAddress)

  console.log(`StakingRewards (${stakingRewards.address})`)
  console.log("------------------------------------------------------------")

  const numStakedFiduTokens = (await stakingRewards.totalSupply()).toNumber()
  // NOTE: Could make this more efficient by using Promises, would need to throttle number of Promises in order to not get rate limited.
  // const promises: Promise<string>[] = []
  console.log(`TokenId,FiduHolder,Staked FIDU Amount,PositionType`)
  for (let tokenId = 1; tokenId < numStakedFiduTokens + 1; tokenId++) {
    // const promise = async () => {
    const position = await stakingRewards.getPosition(tokenId)
    const tokenHolder = await stakingRewards.ownerOf(tokenId)
    console.log(`${tokenId},${tokenHolder},${position.amount},${position.positionType}`)
    // return `${tokenId},${tokenHolder},${position.amount},${position.positionType}`
  }
  // promises.push(promise())
  // console.log(`promises.length: ${promises.length}`)
  // const values = await Promise.all(promises)
  // console.log(`promises: ${promises}`)
  // console.log(`JSON.stringify(values): ${JSON.stringify(values)}`)
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
