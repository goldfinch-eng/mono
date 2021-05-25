/* global web3 */
const {SECONDS_PER_DAY, BLOCKS_PER_DAY, BN} = require("../../test/testHelpers.js")
const hre = require("hardhat")
const {artifacts} = hre
const IV1CreditLine = artifacts.require("IV1CreditLine")

const borrowerAddresses = {
  "0xEEE76fFacd818Bd54CEDACD5E970736c91Deb795": {
    addresses: ["0xEEE76fFacd818Bd54CEDACD5E970736c91Deb795", "0xa9f9ce97e5244ebe307dbcc4feb18422e63b38ee"],
    label: "QuickCheck $150k Creditline",
  },
  "0x6dDC3a7233ecD5514607FB1a0E3475A7dA6E58ED": {
    addresses: ["0x4e38c33db5332975bd4dc63cfd9ff42b21eb2ad6", "0x6dDC3a7233ecD5514607FB1a0E3475A7dA6E58ED"],
    label: "QuickCheck $300k Creditline",
  },
  "0x2c3837122f9a5c88ad1d995eccda79c33d89fed4": {
    addresses: ["0x2c3837122f9a5c88ad1d995eccda79c33d89fed4"],
    label: "Aspire $150k Creditline",
  },
  "0xdc5c5e6b86835b608066d119b428d21b988ff663": {
    addresses: ["0xdc5c5e6b86835b608066d119b428d21b988ff663"],
    label: "Aspire $300k Creditline",
  },
  "0x0039aB09f6691F5A7716890864A289903b3AE548": {
    addresses: ["0x443c2ea20cd50dbcefa1352af962d1b6fa486d81", "0x0039aB09f6691F5A7716890864A289903b3AE548"],
    label: "PayJoy $100k Creditline",
  },
  "0xc7b11c0Ab6aB785B1E4Cc73f3f33d7Afa75aD427": {
    addresses: ["0xc7b11c0Ab6aB785B1E4Cc73f3f33d7Afa75aD427"],
    label: "Blake Test CreditLine",
  },
}

async function calculateTermTimes(clAddress) {
  const creditLine = await IV1CreditLine.at(clAddress)
  const termEndBlock = await creditLine.termEndBlock()
  const termInDays = await creditLine.termInDays()
  const termStartBlock = termEndBlock.sub(new BN(BLOCKS_PER_DAY).mul(termInDays))
  const termStartTime = (await web3.eth.getBlock(String(termStartBlock))).timestamp
  return {termEndTime: termStartTime + SECONDS_PER_DAY * termInDays.toNumber(), termStartTime}
}

async function calculateNextDueTime(clAddress, termStartTime) {
  const creditLine = await IV1CreditLine.at(clAddress)
  const nextDueBlock = await creditLine.nextDueBlock()
  const termInDays = await creditLine.termInDays()
  const termEndBlock = await creditLine.termEndBlock()
  const termStartBlock = termEndBlock.sub(new BN(BLOCKS_PER_DAY).mul(termInDays))
  const percentComplete =
    nextDueBlock.sub(termStartBlock).toNumber() / termInDays.mul(new BN(BLOCKS_PER_DAY)).toNumber()
  const percentCompleteInDays = percentComplete * termInDays
  return termStartTime + percentCompleteInDays * SECONDS_PER_DAY
}

async function getBlockTimestamp(blockNumber) {
  // Mainnet forking has a bug where it's claiming invalid signature when
  // attempting to call getBlock on this blockNumber. Lower block numbers work just fine
  // Not sure what's going on, but confirmed calling idential code on actual mainnet works
  // as expected. Don't want to fight with Hardhat right now, so hardcoding the true result
  if (blockNumber === 12430756) {
    return 1620971896
  }
  if (blockNumber == 12332752) {
    return 1619664127
  }
  return (await web3.eth.getBlock(String(blockNumber))).timestamp
}

async function getMigrationData(clAddress, pool) {
  const cl = await IV1CreditLine.at(clAddress)
  const {termEndTime, termStartTime} = await calculateTermTimes(clAddress)
  const nextDueTime = await calculateNextDueTime(clAddress, termStartTime)
  const interestAccruedAsOf = await getInterestAccruedAsOf(clAddress, termStartTime)
  const lastFullPaymentTime = await getBlockTimestamp((await cl.lastFullPaymentBlock()).toNumber())
  const {totalInterestPaid, totalPrincipalPaid} = await calculateTotalPaid(
    pool,
    "0x6dDC3a7233ecD5514607FB1a0E3475A7dA6E58ED"
  )
  return {
    termEndTime,
    termStartTime,
    nextDueTime,
    interestAccruedAsOf,
    lastFullPaymentTime,
    totalInterestPaid,
    totalPrincipalPaid,
  }
}

async function getInterestAccruedAsOf(clAddress, termStartTime) {
  const creditLine = await IV1CreditLine.at(clAddress)
  const interestAccruedAsOfBlock = await creditLine.interestAccruedAsOfBlock()
  const termInDays = await creditLine.termInDays()
  const termInBlocks = termInDays.mul(new BN(BLOCKS_PER_DAY))
  const startBlock = (await creditLine.termEndBlock()).sub(termInBlocks)
  const fractionOfPeriod = interestAccruedAsOfBlock.sub(startBlock).toNumber() / termInBlocks.toNumber()
  const secondsIntoPeriod = fractionOfPeriod * termInDays.toNumber() * SECONDS_PER_DAY
  return termStartTime + secondsIntoPeriod
}

async function calculateTotalPaid(pool, creditLine) {
  // I verified this appears to return the right amounts, based on events
  // received for the quick check creditline, cross checked with
  // https://docs.google.com/spreadsheets/d/1trna25FAnzBtTDnWoBC9-JMZ-PRn-I87jNc7o9KLrto/edit#gid=0
  const otherPool = await artifacts.require("TestPool").at(pool.address)
  const web3Pool = new web3.eth.Contract(otherPool.abi, pool.address)
  const info = borrowerAddresses[creditLine]
  const events = await getPoolEvents(web3Pool, info.addresses)
  const totalInterestPaid = events
    .filter((val) => val.event === "InterestCollected")
    .reduce(
      (sum, curVal) => sum.add(new BN(curVal.returnValues.poolAmount)).add(new BN(curVal.returnValues.reserveAmount)),
      new BN(0)
    )
  const totalPrincipalPaid = events
    .filter((val) => val.event === "PrincipalCollected")
    .reduce((sum, curVal) => sum.add(new BN(curVal.returnValues.amount)), new BN(0))
  return {totalInterestPaid, totalPrincipalPaid}
}

async function getPoolEvents(web3Pool, addresses, events = ["InterestCollected", "PrincipalCollected"]) {
  const [interestCollected, principalCollected] = await Promise.all(
    events.map((eventName) => {
      return web3Pool.getPastEvents(eventName, {
        filter: {payer: addresses},
        fromBlock: 10360444, // Roughly May, 2020, well before we launched the protocol
        to: "latest",
      })
    })
  )
  return interestCollected.concat(principalCollected).filter((n) => n)
}

module.exports = {
  calculateNextDueTime: calculateNextDueTime,
  calculateTermTimes: calculateTermTimes,
  calculateTotalPaid: calculateTotalPaid,
  getBlockTimestamp: getBlockTimestamp,
  getInterestAccruedAsOf: getInterestAccruedAsOf,
  getMigrationData: getMigrationData,
}
