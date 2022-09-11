const hre = require("hardhat")

const TRANCHED_POOL = "0x017a79d8d1ebca11abdd9e12addea89705fd0be8"
const TRANCHING_LOGIC = "0x899aB3c6A8C6e8786b5C1ea8bF415541eeD2A107"

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
