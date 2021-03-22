/* global ethers */
const hre = require("hardhat")
const {MAINNET_MULTISIG, impersonateAccount, getExistingContracts} = require("./mainnetForkingHelpers.js")
const {MAINNET_CUSDC_ADDRESS, getUSDCAddress} = require("./deployHelpers.js")

async function main() {
  if (hre.network.name !== "localhost") {
    throw new Error(
      "Non local network detected. This script only works for MAINNET_FORKING." +
        " Please pass '--network localhost' and try again."
    )
  }
  await impersonateAccount(hre, MAINNET_MULTISIG)
  const signer = await ethers.provider.getSigner(MAINNET_MULTISIG)
  const contracts = await getExistingContracts(["Pool"], null, signer)
  const pool = (await ethers.getContractAt("Pool", contracts.Pool.ProxyContract.address)).connect(signer)
  await sweepToCompound(pool, signer)
}

async function sweepToCompound(pool, signer, logger = console.log) {
  const cUSDC = await ethers.getContractAt("TestERC20", MAINNET_CUSDC_ADDRESS)
  const USDC = await ethers.getContractAt("TestERC20", getUSDCAddress("mainnet"))

  let USDCBalance = await USDC.balanceOf(pool.address)
  let cUSDCBalance = await cUSDC.balanceOf(pool.address)
  console.log("CUSDC Balance is:", String(cUSDCBalance))
  console.log("USDC Balance is:", String(USDCBalance))

  logger("Sweeping all funds to Compound...")
  await (await pool.sweepToCompound()).wait()
  logger("Done sweeping...")
  USDCBalance = await USDC.balanceOf(pool.address)
  cUSDCBalance = await cUSDC.balanceOf(pool.address)
  console.log("CUSDC Balance is:", String(cUSDCBalance))
  console.log("USDC Balance is:", String(USDCBalance))
  logger("Done")
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

module.exports = sweepToCompound
