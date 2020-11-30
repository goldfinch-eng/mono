const hre = require("hardhat")
const {deployments} = hre
const {getDeployedContract} = require("../blockchain_scripts/deployHelpers.js")

async function main() {
  const config = await getDeployedContract(deployments, "GoldfinchConfig")

  console.log("TransactionLimit ==", String(await config.getNumber(0)))
  console.log("TotalFundsLimit ==", String(await config.getNumber(1)))
  console.log("MaxUnderwriterLimit ==", String(await config.getNumber(2)))
  console.log("ReserveDenominator ==", String(await config.getNumber(3)))
  console.log("WithdrawFeeDenominator ==", String(await config.getNumber(4)))
  console.log("LatenessGracePeriodInDays ==", String(await config.getNumber(5)))
  console.log("LatenessMaxDays ==", String(await config.getNumber(6)))
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
