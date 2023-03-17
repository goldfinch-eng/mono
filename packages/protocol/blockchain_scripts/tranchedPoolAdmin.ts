// /* globals ethers */
import {TRANCHES} from "./deployHelpers"
import {ethers} from "hardhat"
import {CONFIG_KEYS} from "./configKeys"
import {MAINNET_GOVERNANCE_MULTISIG} from "./mainnetForkingHelpers"
import {Borrower, CreditLine, SeniorPool, TranchedPool} from "../typechain/ethers"
import {Signer} from "ethers"
import hre from "hardhat"
const {getNamedAccounts} = hre
import deployedABIs from "../deployments/all_dev.json"
import {assertNonNullable} from "@goldfinch-eng/utils"
import {impersonateAccount} from "./helpers/impersonateAccount"

async function main() {
  let signerAddress: string
  if (process.env.HARDHAT_FORK === "mainnet") {
    signerAddress = MAINNET_GOVERNANCE_MULTISIG
    await impersonateAccount(hre, signerAddress)
  } else {
    const {protocolOwner} = await getNamedAccounts()
    assertNonNullable(protocolOwner)
    signerAddress = protocolOwner
  }

  const poolAddress = process.env.POOL
  const action = process.env.ACTION

  if (!poolAddress || !action) {
    throw new Error("Must specify an POOL and an ACTION")
  }

  const tranchedPool = await getPool(poolAddress, signerAddress)

  if (action === "lockJunior") {
    await lockJunior(tranchedPool)
  } else if (action === "investSenior") {
    await investSeniorAndLock(tranchedPool)
  } else if (action === "lockAndInvest") {
    await lockJunior(tranchedPool)
    await investSeniorAndLock(tranchedPool)
  } else if (action === "assess") {
    await tranchedPool.assess()
  } else if (action == "investJuniorAndLock") {
    await investJuniorAndLock(tranchedPool)
  } else if (action == "drawdown") {
    await drawdown(tranchedPool)
  }

  console.log("Done")
}

async function drawdown(tranchedPool: TranchedPool) {
  assertNonNullable(process.env.END_BORROWER)

  const endBorrower = process.env.END_BORROWER
  await impersonateAccount(hre, endBorrower)

  const creditLineAddress = await tranchedPool.creditLine()
  const creditLine = await getCreditLine(creditLineAddress, endBorrower)
  const limit = await creditLine.limit()

  const borrowerAddress = await creditLine.borrower()
  const borrower = await getBorrower(borrowerAddress, endBorrower)

  await borrower.drawdown(tranchedPool.address, limit, endBorrower)
  console.log(`Drew down ${limit.toString()} as ${endBorrower} (${borrowerAddress}) from pool ${tranchedPool.address}`)
}

async function lockJunior(pool) {
  const juniorTrancheLockedUntil = parseInt((await pool.getTranche(TRANCHES.Junior))[4])

  if (juniorTrancheLockedUntil !== 0) {
    throw new Error("Junior tranche already locked")
  }
  const txn = await pool.lockJuniorCapital()
  await txn.wait()
  console.log(`Locked the junior tranche for ${pool.address}`)
}

async function investJuniorAndLock(tranchedPool: TranchedPool) {
  const seniorPool = await getSeniorPool(tranchedPool, tranchedPool.signer)
  const creditLineAddress = await tranchedPool.creditLine()
  const creditLine = await getCreditLine(creditLineAddress, tranchedPool.signer)
  // @ts-expect-error Ignore broken call to function that has been removed.
  await seniorPool.investJunior(tranchedPool.address, await creditLine.limit())
  await tranchedPool.lockJuniorCapital()
  await tranchedPool.lockPool()
}

async function investSeniorAndLock(tranchedPool) {
  const juniorTrancheLockedUntil = parseInt((await tranchedPool.getTranche(TRANCHES.Junior))[4])
  const seniorTranchedLockedUntil = parseInt((await tranchedPool.getTranche(TRANCHES.Senior))[4])

  if (juniorTrancheLockedUntil === 0) {
    throw new Error("Junior tranche must be locked first")
  }
  if (seniorTranchedLockedUntil !== 0) {
    throw new Error("Senior tranche already locked")
  }

  const seniorPool = await getSeniorPool(tranchedPool, tranchedPool.signer)

  const estimatedInvestment = await seniorPool.estimateInvestment(tranchedPool.address)
  let txn

  if (estimatedInvestment.isZero()) {
    console.log(`Senior pool investment not required`)
  } else {
    txn = await seniorPool.invest(tranchedPool.address)
    await txn.wait()
    console.log(`Senior pool invested into ${tranchedPool.address}`)
  }

  txn = await tranchedPool.lockPool()
  await txn.wait()
  console.log(`TranchedPool locked`)
}

async function getPool(contractAddress, signerAddress) {
  const signer = typeof signerAddress === "string" ? await ethers.getSigner(signerAddress) : signerAddress
  const abi = await getAbi("TranchedPool")
  return (await ethers.getContractAt(abi, contractAddress, signer)) as TranchedPool
}

async function getCreditLine(contractAddress, signerAddress) {
  const signer = typeof signerAddress === "string" ? await ethers.getSigner(signerAddress) : signerAddress
  const abi = await getAbi("TranchedPool")
  return (await ethers.getContractAt(abi, contractAddress, signer)) as CreditLine
}

async function getBorrower(contractAddress: string, signerAddress: string | Signer) {
  const signer = typeof signerAddress === "string" ? await ethers.getSigner(signerAddress) : signerAddress
  const abi = await getAbi("Borrower")
  return (await ethers.getContractAt(abi, contractAddress, signer)) as Borrower
}

async function getSeniorPool(pool, signerAddress) {
  const signer = typeof signerAddress === "string" ? await ethers.getSigner(signerAddress) : signerAddress
  const configAddress = await pool.config()
  const configABI = await getAbi("GoldfinchConfig")
  const config = await ethers.getContractAt(configABI, configAddress, signer)

  const poolAddress = await config.getAddress(CONFIG_KEYS.SeniorPool)
  const poolABI = await getAbi("SeniorPool")
  return (await ethers.getContractAt(poolABI, poolAddress, signer)) as SeniorPool
}

async function getAbi(contractName) {
  const chainId = process.env.HARDHAT_FORK === "mainnet" ? "1" : await hre.getChainId()
  const networkName = process.env.HARDHAT_FORK ?? process.env.HARDHAT_NETWORK
  assertNonNullable(networkName)
  return deployedABIs[chainId].find((i: {name: string}) => i.name === networkName).contracts[contractName].abi
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
