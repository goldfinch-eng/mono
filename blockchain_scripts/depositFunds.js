/* global ethers */
const BN = require("bn.js")
const bre = require("@nomiclabs/buidler")
const {deployments, getNamedAccounts, getChainId} = bre
const {getUSDCAddress, USDCDecimals, getDeployedContract} = require("../blockchain_scripts/deployHelpers.js")

async function main() {
  const {protocolOwner} = await getNamedAccounts()
  const chainID = await getChainId()
  const pool = await getDeployedContract(deployments, "Pool", protocolOwner)
  const erc20 = await ethers.getContractAt("TestERC20", getUSDCAddress(chainID))

  await depositFundsToThePool(pool, erc20)

  async function depositFundsToThePool(pool) {
    console.log("Depositing funds...")
    const depositAmount = new BN(9900).mul(USDCDecimals)

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
