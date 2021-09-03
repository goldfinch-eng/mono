// /* globals ethers */
import {getSignerForAddress, INTEREST_DECIMALS, TRANCHES, USDCDecimals} from "./deployHelpers"
import {ethers} from "hardhat"
import {CONFIG_KEYS} from "./configKeys"
import hre from "hardhat"
const {getNamedAccounts} = hre
import deployedABIs from "../client/config/deployments_dev.json"
import {assertNonNullable} from "../utils/type"
import {GoldfinchFactory} from "../typechain/ethers"
import {impersonateAccount, MAINNET_MULTISIG} from "./mainnetForkingHelpers"
import {BigNumber} from "bignumber.js"

async function getAbi(contractName: string) {
  const chainId = process.env.HARDHAT_FORK === "mainnet" ? "1" : await hre.getChainId()
  const networkName = process.env.HARDHAT_FORK ?? process.env.HARDHAT_NETWORK
  return deployedABIs[chainId][networkName!].contracts[contractName].abi
}

async function getAddress(contractName: string) {
  const chainId = process.env.HARDHAT_FORK === "mainnet" ? "1" : await hre.getChainId()
  const networkName = process.env.HARDHAT_FORK ?? process.env.HARDHAT_NETWORK
  return deployedABIs[chainId][networkName!].contracts[contractName].address
}

async function getGoldfinchFactory(signerAddress: string) {
  const signer = await ethers.getSigner(signerAddress)
  const abi = await getAbi("GoldfinchFactory")
  const address = await getAddress("GoldfinchFactory")
  return (await ethers.getContractAt(abi, address, signer)) as GoldfinchFactory
}

/**
 *  Preview a TranchedPool. This is meant to be run on mainnet-forking so we can
 *  ensure that the pool looks correct and create pool-metadata, before creating a
 *  governance action for mainnet.
 */
async function main() {
  let signerAddress: string
  if (process.env.HARDHAT_FORK === "mainnet") {
    signerAddress = MAINNET_MULTISIG
    await impersonateAccount(hre, signerAddress)
  } else {
    const {protocolOwner} = await getNamedAccounts()
    signerAddress = protocolOwner!
  }

  assertNonNullable(process.env.BORROWER_ADDRESS)
  assertNonNullable(process.env.LIMIT)
  assertNonNullable(process.env.INTEREST_APR)
  assertNonNullable(process.env.PAYMENT_PERIOD_IN_DAYS)
  assertNonNullable(process.env.TERM_IN_DAYS)
  assertNonNullable(process.env.LATE_FEE_APR)

  const borrowerAddress = process.env.BORROWER_ADDRESS
  const juniorFeePercent = new BigNumber(20)
  const limit = new BigNumber(process.env.LIMIT).multipliedBy(USDCDecimals.toString())
  const interestApr = new BigNumber(process.env.INTEREST_APR).multipliedBy(INTEREST_DECIMALS.toString())
  const paymentPeriodInDays = new BigNumber(process.env.PAYMENT_PERIOD_IN_DAYS)
  const termInDays = new BigNumber(process.env.TERM_IN_DAYS)
  const lateFeeApr = new BigNumber(process.env.LATE_FEE_APR).multipliedBy(INTEREST_DECIMALS.toString())

  console.log("Creating borrower pool...")
  const goldfinchFactory = await getGoldfinchFactory(MAINNET_MULTISIG)
  let tx = await goldfinchFactory.createPool(
    borrowerAddress,
    juniorFeePercent.toString(),
    limit.toString(),
    interestApr.toString(),
    paymentPeriodInDays.toString(),
    termInDays.toString(),
    lateFeeApr.toString()
  )
  let res = await tx.wait()
  let poolCreatedEvent = res.events?.find((e) => e.event === "PoolCreated")
  console.log(`Created borrower pool ${poolCreatedEvent!.args![0]} with the following parameters:`)
  console.log("borrowerAddress:", borrowerAddress)
  console.log("juniorFeePercent:", juniorFeePercent.toString())
  console.log("limit:", limit.toString())
  console.log("interestApr:", interestApr.toString())
  console.log("paymentPeriodInDays:", paymentPeriodInDays.toString())
  console.log("termInDays:", termInDays.toString())
  console.log("lateFeeApr:", lateFeeApr.toString())
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
