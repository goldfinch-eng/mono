const hre = require("hardhat")

const TRANCHED_POOL = "0xcEF36C72A1F6e07f7eea547e3133ab7182491c7d"
const TRANCHING_LOGIC = "0xa1B72e5EF8ADc4a23f0bE88afC3dc33DC7a93390"

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
