const hre = require("hardhat")

const TRANCHED_POOL = "0x8f367d342181c78217691b6263dba41a61b752fd"
const TRANCHING_LOGIC = "0xa1B72e5EF8ADc4a23f0bE88afC3dc33DC7a93390"

async function main() {
  const TranchedPool = await hre.ethers.getContractFactory("TranchedPool", {
    libraries: {TranchingLogic: TRANCHING_LOGIC},
  })
  const pool = await TranchedPool.attach(TRANCHED_POOL)
  let receipt = await pool.assess()
  let result = await receipt.wait()
  console.log(result)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
