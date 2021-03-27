/* globals ethers */
const hre = require("hardhat")
const {deployments} = hre
const {getSignerForAddress} = require("../blockchain_scripts/deployHelpers.js")
const {CONFIG_KEYS} = require("./configKeys")

async function main() {
  let configAddress = process.env.CONFIG_ADDRESS || (await deployments.get("GoldfinchConfig")).address
  let {proxy_owner} = await hre.getNamedAccounts()
  let signer = await getSignerForAddress(proxy_owner)
  const config = await ethers.getContractAt("GoldfinchConfig", configAddress, signer)

  console.log(`GoldfinchConfig (${config.address})`)
  console.log("------------------------------------------------------------")

  console.log("TransactionLimit ==", String(await config.getNumber(0)))
  console.log("TotalFundsLimit ==", String(await config.getNumber(1)))
  console.log("MaxUnderwriterLimit ==", String(await config.getNumber(2)))
  console.log("ReserveDenominator ==", String(await config.getNumber(3)))
  console.log("WithdrawFeeDenominator ==", String(await config.getNumber(4)))
  console.log("LatenessGracePeriodInDays ==", String(await config.getNumber(5)))
  console.log("LatenessMaxDays ==", String(await config.getNumber(6)))

  console.log("Pool ==", String(await config.getAddress(CONFIG_KEYS.Pool)))
  console.log("CreditLineImplementation ==", String(await config.getAddress(CONFIG_KEYS.CreditLineImplementation)))
  console.log("CreditLineFactory ==", String(await config.getAddress(CONFIG_KEYS.CreditLineFactory)))
  console.log("CreditDesk ==", String(await config.getAddress(CONFIG_KEYS.CreditDesk)))
  console.log("Fidu ==", String(await config.getAddress(CONFIG_KEYS.Fidu)))
  console.log("USDC ==", String(await config.getAddress(CONFIG_KEYS.USDC)))
  console.log("TreasuryReserve ==", String(await config.getAddress(CONFIG_KEYS.TreasuryReserve)))
  console.log("ProtocolAdmin ==", String(await config.getAddress(CONFIG_KEYS.ProtocolAdmin)))
  console.log("OneInch ==", String(await config.getAddress(CONFIG_KEYS.OneInch)))
  console.log("TrustedForwarder ==", String(await config.getAddress(CONFIG_KEYS.TrustedForwarder)))
  console.log("CUSDCContract ==", String(await config.getAddress(CONFIG_KEYS.CUSDCContract)))
  console.log("GoldfinchConfig ==", String(await config.getAddress(CONFIG_KEYS.GoldfinchConfig)))
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
