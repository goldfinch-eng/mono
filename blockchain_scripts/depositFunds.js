// /* globals ethers */
const BN = require("bn.js")
const hre = require("hardhat")
const {deployments, getNamedAccounts} = hre
const {USDCDecimals, getDeployedContract} = require("../blockchain_scripts/deployHelpers.js")

async function main() {
  const {protocolOwner} = await getNamedAccounts()
  const pool = await getDeployedContract(deployments, "Pool", protocolOwner)

  await depositFundsToThePool(pool)

  async function depositFundsToThePool(pool) {
    // let chainID = await getChainId()
    // let erc20 = await ethers.getContractAt("TestERC20", getUSDCAddress(chainID))
    // console.log("Approving the protocol owner")
    // const approval = await erc20.approve(pool.address, String(new BN(100000000).mul(USDCDecimals)))
    // await approval.wait()

    console.log("Supplying funds...")
    const depositAmount = new BN(1000).mul(USDCDecimals)

    var txn = await pool.deposit(String(depositAmount))
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
