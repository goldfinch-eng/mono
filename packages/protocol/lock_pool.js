const hre = require("hardhat")

const TRANCHED_POOL = "0x462df1A332f93D3Fe2891AF9ae12166E4c2084C2"
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
