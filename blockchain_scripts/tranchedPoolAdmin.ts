// /* globals ethers */
import {getSignerForAddress, TRANCHES} from "./deployHelpers"
import {ethers} from "hardhat"
import {CONFIG_KEYS} from "./configKeys"
const hre = require("hardhat")
const {getNamedAccounts} = hre
const deployedABIs = require("../client/config/deployments_dev.json")

async function main() {
  const {protocolOwner} = await getNamedAccounts()

  const poolAddress = process.env.POOL
  const action = process.env.ACTION

  if (!poolAddress || !action) {
    throw new Error("Must specify an POOL and an ACTION")
  }

  const pool = await getPool(poolAddress, protocolOwner)


  if (action === "lockJunior") {
    await lockJunior(pool)
  } else if (action === "investSenior") {
    await investSeniorAndLock(pool)
  } else if (action === "lockAndInvest") {
    await lockJunior(pool)
    await investSeniorAndLock(pool)
  }
  console.log("Done")
}

async function lockJunior(pool) {
  const juniorTrancheLockedUntil = parseInt((await pool.getTranche(TRANCHES.Junior))[4])

  if (juniorTrancheLockedUntil !== 0) {
    throw new Error("Junior tranche already locked")
  }
  let txn = await pool.lockJuniorCapital()
  await txn.wait()
  console.log(`Locked the junior tranche for ${pool.address}`)
}

async function investSeniorAndLock(pool) {
  const juniorTrancheLockedUntil = parseInt((await pool.getTranche(TRANCHES.Junior))[4])
  const seniorTranchedLockedUntil = parseInt((await pool.getTranche(TRANCHES.Senior))[4])

  if (juniorTrancheLockedUntil === 0) {
    throw new Error("Junior tranche must be locked first")
  }
  if (seniorTranchedLockedUntil !== 0) {
    throw new Error("Senior tranche already locked")
  }

  const seniorFund = await getFund(pool, pool.signer)
  let txn = await seniorFund.invest(pool.address)
  await txn.wait()
  console.log(`Senior fund invested into ${pool.address}`)

  txn = await pool.lockPool()
  await txn.wait()
  console.log(`Pool locked`)
}

async function getPool(contractAddress, signerAddress) {
  const signer = await getSignerForAddress(signerAddress)
  const  abi = await getAbi("TranchedPool")
  return await ethers.getContractAt(abi, contractAddress, signer)
}

async function getFund(pool, signerAddress) {
  const signer = await getSignerForAddress(signerAddress)
  const configAddress = await pool.config()
  const configABI = await getAbi("GoldfinchConfig")
  const config = await ethers.getContractAt(configABI, configAddress, signer)

  const fundAddress = await config.getAddress(CONFIG_KEYS.SeniorFund)
  const fundABI = await getAbi("SeniorFund")
  return await ethers.getContractAt(fundABI, fundAddress, signer)
}

async function getAbi(contractName) {
  const chainId = await hre.getChainId()
  const networkName = chainId === "31337" ? "localhost" : process.env.HARDHAT_NETWORK
  const abi = deployedABIs[chainId][networkName!].contracts[contractName].abi
  return abi
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
