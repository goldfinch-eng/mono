const hre = require("hardhat")

const TRANCHED_POOL = "0x45dF221c9de3330534421836C5Dd0a2EE1607d8E"
const TRANCHING_LOGIC = "0x9c06e8E759238532e63202A302735a49AB993771"

async function main() {
  const TranchedPool = await hre.ethers.getContractFactory("TranchedPool", {
    libraries: {TranchingLogic: TRANCHING_LOGIC},
  })
  const pool = await TranchedPool.attach(TRANCHED_POOL)
  let receipt = await pool.lockJuniorCapital()
  let result = await receipt.wait()
  console.log(result)
  receipt = await pool.lockPool()
  result = await receipt.wait()
  console.log(result)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
