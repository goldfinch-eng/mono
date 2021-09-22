const BN = require("bn.js")
const hre = require("hardhat")
const {deployments, getNamedAccounts} = hre
const {USDCDecimals, getDeployedContract} = require("../blockchain_scripts/deployHelpers.js")

async function main() {
  const {protocolOwner} = await getNamedAccounts()
  const pool = await getDeployedContract(deployments, "Pool", protocolOwner)

  await withdrawFundsFromThePool(pool)

  async function withdrawFundsFromThePool(pool) {
    console.log("Withdrawing funds...")
    const withdrawAmount = new BN(10000).mul(USDCDecimals)

    var txn = await pool.withdraw(String(withdrawAmount))
    await txn.wait()
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

module.exports = main
