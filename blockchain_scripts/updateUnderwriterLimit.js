const BN = require("bn.js")
const hre = require("hardhat")
const {deployments, getNamedAccounts} = hre
const {USDCDecimals, getDeployedContract} = require("../blockchain_scripts/deployHelpers.js")
const PROTOCOL_CONFIG = require("../protocol_config.json")

async function main() {
  const {proxyOwner} = await getNamedAccounts()
  const creditDesk = await getDeployedContract(deployments, "CreditDesk", proxyOwner)
  const underwriter = process.env.UNDERWRITER
  if (!underwriter) {
    throw new Error(
      "No underwriter provided. Please run again, passing underwriter as UNDERWRITER={{underwriter_address}}"
    )
  }

  await updateUnderwriterLimit(creditDesk, underwriter)
}

async function updateUnderwriterLimit(creditDesk, underwriter, logger = console.log) {
  const txn = await creditDesk.setUnderwriterGovernanceLimit(
    underwriter,
    String(new BN(PROTOCOL_CONFIG.maxUnderwriterLimit).mul(USDCDecimals))
  )
  await txn.wait()
  logger("Created a credit line for the borrower", underwriter)
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

module.exports = updateUnderwriterLimit
