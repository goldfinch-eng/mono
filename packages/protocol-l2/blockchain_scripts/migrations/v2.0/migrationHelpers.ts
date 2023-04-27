import {SECONDS_PER_DAY, BLOCKS_PER_DAY, BN} from "../../../test/testHelpers"
import hre from "hardhat"
const {artifacts, web3, getChainId} = hre
const IV1CreditLine = artifacts.require("IV1CreditLine")
import {MAINNET_GOVERNANCE_MULTISIG} from "../../mainnetForkingHelpers"
import {MAINNET_CHAIN_ID, isMainnetForking} from "../../deployHelpers"
import {asNonNullable, assertNonNullable, debug} from "@goldfinch-eng/utils"
import {getTruffleContract} from "../../deployHelpers"

interface BorrowerMetadata {
  addresses: string[]
  label: string
  owner: string
}
const borrowerCreditlines: {[chainId: string]: {[address: string]: BorrowerMetadata}} = {
  [MAINNET_CHAIN_ID]: {
    "0xEEE76fFacd818Bd54CEDACD5E970736c91Deb795": {
      addresses: ["0xEEE76fFacd818Bd54CEDACD5E970736c91Deb795", "0xa9f9ce97e5244ebe307dbcc4feb18422e63b38ee"],
      label: "QuickCheck $150k Creditline",
      owner: "0x8652854C25bd553d522d118AC2bee6FFA3Cce317",
    },
    "0x6dDC3a7233ecD5514607FB1a0E3475A7dA6E58ED": {
      addresses: ["0x4e38c33db5332975bd4dc63cfd9ff42b21eb2ad6", "0x6dDC3a7233ecD5514607FB1a0E3475A7dA6E58ED"],
      label: "QuickCheck $300k Creditline",
      owner: "0x8652854C25bd553d522d118AC2bee6FFA3Cce317",
    },
    "0x96b10e62695a915a8beea6c3d6842137c83d22b8": {
      addresses: ["0x96b10e62695a915a8beea6c3d6842137c83d22b8"],
      label: "QuickCheck $1M Creditline",
      owner: "0x8652854C25bd553d522d118AC2bee6FFA3Cce317",
    },
    "0x8b57ecdac654d32a6befc33204f4b041b459dff4": {
      addresses: ["0x2c3837122f9a5c88ad1d995eccda79c33d89fed4", "0x8b57ecdac654d32a6befc33204f4b041b459dff4"],
      label: "Aspire $150k Creditline",
      owner: "0xbD04f16cdd0e7E1ed8E4382AAb3f0F7B17672DdC",
    },
    "0xb2ad56df3bce9bad4d8f04be1fc0eda982a84f44": {
      addresses: ["0xdc5c5e6b86835b608066d119b428d21b988ff663", "0xb2ad56df3bce9bad4d8f04be1fc0eda982a84f44"],
      label: "Aspire $300k Creditline",
      owner: "0xbD04f16cdd0e7E1ed8E4382AAb3f0F7B17672DdC",
    },
    "0x7ec34e4075b6bfacce771144285a8e74bb8c309b": {
      addresses: ["0x7ec34e4075b6bfacce771144285a8e74bb8c309b"],
      label: "Aspire $2M Creditline",
      owner: "0xbD04f16cdd0e7E1ed8E4382AAb3f0F7B17672DdC",
    },
    "0x0039aB09f6691F5A7716890864A289903b3AE548": {
      addresses: ["0x443c2ea20cd50dbcefa1352af962d1b6fa486d81", "0x0039aB09f6691F5A7716890864A289903b3AE548"],
      label: "PayJoy $100k Creditline",
      owner: "0xC4aA3F35d54E6aAe7b32fBD239D309A3C805A156",
    },
    "0x306e330d084f7996f41bb113b5f0f15501c821a5": {
      addresses: [
        "0x306e330d084f7996f41bb113b5f0f15501c821a5",
        "0x93fdcd12ee3169721720ee71c87636b7b48632ea",
        "0x4eADbF3b1052539C9d7f451bAD8d2Ed7DC624A01",
      ],
      label: "Alamvest $1.205M Creditline",
      owner: "0x4bBD638eb377ea00b84fAc2aA24A769a1516eCb6",
    },
    // Eliminating this from the list, because I have fully repaid it and drawn down again,
    // Which is a case that messes up the migration and doesn't exist in "real" credit lines.
    // "0xc7b11c0Ab6aB785B1E4Cc73f3f33d7Afa75aD427": {
    //   addresses: ["0xc7b11c0Ab6aB785B1E4Cc73f3f33d7Afa75aD427"],
    //   label: "Blake Test CreditLine",
    //   owner: "0xBAc2781706D0aA32Fb5928c9a5191A13959Dc4AE",
    // },
    "0x43a18ccb14078dc4fd1134da39e52ac34ec08880": {
      addresses: ["0x43a18ccb14078dc4fd1134da39e52ac34ec08880"],
      label: "Mike's Test Creditline",
      owner: "0x0333119c9688Eb0c7805454cf5e101b883FD1BFa",
    },
    "0x46d2fcc53a6fe8fe5116b881c4f79cb1b3dce823": {
      addresses: ["0x46d2fcc53a6fe8fe5116b881c4f79cb1b3dce823"],
      label: "Sanjay's Test Creditline",
      owner: "0x3FeB1094eE48DB0B9aC25b82A3A34ABe16208590",
    },
    "0x71c9b1114829507bbe917a5a1239467f32444529": {
      addresses: ["0x71c9b1114829507bbe917a5a1239467f32444529"],
      label: "Mark's Test Creditline",
      owner: "0xeF3fAA47e1b0515f640c588a0bc3D268d5aa29B9",
    },
    "0xc2bdfc1b28025d7a699cfbc401c7f98a4ecd7107": {
      addresses: ["0xc2bdfc1b28025d7a699cfbc401c7f98a4ecd7107"],
      label: "Andrew's Test Creditline",
      owner: "0x139C9c156D049dd002b04A6471D3DE0AD1eAb256",
    },
    "0x2d47d54c2b8f59679af0d7351e01624a80fb8cb2": {
      addresses: ["0x2d47d54c2b8f59679af0d7351e01624a80fb8cb2"],
      label: "Obinna's Test Creditline",
      owner: "0x1F666ca6CeE68F6AfdD3eC0670A40a54F88c8E64",
    },
    "0x1357462a591edab37ddba9d903bf7f72eab6e215": {
      addresses: ["0x1357462a591edab37ddba9d903bf7f72eab6e215"],
      label: "Sam's Test Creditline",
      owner: "0x69f7A8242ecBDac84b05FD80DA9631E5d659F690",
    },
    "0xbdfffb9be1f45213582718b878e02f5cf38924b8": {
      addresses: ["0xbdfffb9be1f45213582718b878e02f5cf38924b8"],
      label: "Ian's Test Creditline",
      owner: "0xd4ad17f7F7f62915A1F225BB1CB88d2492F89769",
    },
  },
}

const borrowerAddresses = [
  "0xBAc2781706D0aA32Fb5928c9a5191A13959Dc4AE", // Blake
  "0x0333119c9688Eb0c7805454cf5e101b883FD1BFa", // Mike
  "0x3FeB1094eE48DB0B9aC25b82A3A34ABe16208590", // Sanjay
  "0xeF3fAA47e1b0515f640c588a0bc3D268d5aa29B9", // Mark
  "0x139C9c156D049dd002b04A6471D3DE0AD1eAb256", // Andrew
  "0x1F666ca6CeE68F6AfdD3eC0670A40a54F88c8E64", // Obinna
  "0x69f7A8242ecBDac84b05FD80DA9631E5d659F690", // Sam
  "0xd4ad17f7F7f62915A1F225BB1CB88d2492F89769", // Ian
  "0xC4aA3F35d54E6aAe7b32fBD239D309A3C805A156", // Payjoy
  "0xbD04f16cdd0e7E1ed8E4382AAb3f0F7B17672DdC", // Aspire
  "0x8652854C25bd553d522d118AC2bee6FFA3Cce317", // QuickCheck
  "0x4bBD638eb377ea00b84fAc2aA24A769a1516eCb6", // Almavest
]

async function migrateClToV2(clAddress, borrowerContract, pool, creditDesk) {
  const data = await getMigrationData(clAddress, pool)
  assertNonNullable(data)
  await creditDesk.migrateV1CreditLine(
    clAddress,
    borrowerContract,
    data.termEndTime,
    data.nextDueTime,
    data.interestAccruedAsOf,
    data.lastFullPaymentTime,
    data.totalInterestPaid,
    {from: MAINNET_GOVERNANCE_MULTISIG}
  )
}

async function calculateTermTimes(clAddress) {
  debug("cl address:", clAddress)
  const creditLine = await IV1CreditLine.at(clAddress)
  const termEndBlock = await creditLine.termEndBlock()
  let termInDays = await creditLine.termInDays()
  if (clAddress === "0x306e330d084f7996f41bb113b5f0f15501c821a5") {
    // This is the Alma creditline, which we bumped the maturity date on.
    // We didn't update the termInDays because we can't directly change that, and
    // we could achieve the same effect by upping the termEndBlock. So for expediency,
    // just doing a change here so we get the right term start block
    termInDays = new BN(1196)
  }
  const termStartBlock = termEndBlock.sub(new BN(BLOCKS_PER_DAY).mul(termInDays))
  const termStartTime = await getBlockTimestamp(termStartBlock)
  return {termEndTime: termStartTime + SECONDS_PER_DAY.toNumber() * termInDays.toNumber(), termStartTime}
}

async function calculateNextDueTime(clAddress, termStartTime) {
  const creditLine = await IV1CreditLine.at(clAddress)
  const nextDueBlock = await creditLine.nextDueBlock()
  let termInDays = await creditLine.termInDays()
  if (clAddress === "0x306e330d084f7996f41bb113b5f0f15501c821a5") {
    // This is the Alma creditline, which we bumped the maturity date on.
    // We didn't update the termInDays because we can't directly change that, and
    // we could achieve the same effect by upping the termEndBlock. So for expediency,
    // just doing a change here so we get the right term start block
    termInDays = new BN(1196)
  }
  const termEndBlock = await creditLine.termEndBlock()
  const termStartBlock = termEndBlock.sub(new BN(BLOCKS_PER_DAY).mul(termInDays))
  const percentComplete =
    nextDueBlock.sub(termStartBlock).toNumber() / termInDays.mul(new BN(BLOCKS_PER_DAY)).toNumber()
  const percentCompleteInDays = percentComplete * termInDays
  return termStartTime + percentCompleteInDays * SECONDS_PER_DAY.toNumber()
}

async function getBlockTimestamp(blockNumber) {
  // Mainnet forking has a bug where it's claiming invalid signature when
  // attempting to call getBlock on this blockNumber. Lower block numbers work just fine
  // Not sure what's going on, but confirmed calling idential code on actual mainnet works
  // as expected. Don't want to fight with Hardhat right now, so hardcoding the true result
  if (blockNumber.eq(new BN(12430756))) {
    return 1620971896
  }
  if (blockNumber.eq(new BN(12332752))) {
    return 1619664127
  }
  if (blockNumber.eq(new BN(12359067))) {
    return 1620041245
  }
  const block = await web3.eth.getBlock(String(blockNumber))
  if (block === null) {
    throw new Error(`block ${String(blockNumber)} is null!`)
  }
  return parseInt(String(block.timestamp))
}

async function getMigrationData(clAddress, pool) {
  const cl = await IV1CreditLine.at(clAddress)
  if ((await cl.balance()).toNumber() === 0) {
    return null
  }
  const {termEndTime, termStartTime} = await calculateTermTimes(clAddress)
  const nextDueTime = await calculateNextDueTime(clAddress, termStartTime)
  const interestAccruedAsOf = await getInterestAccruedAsOf(clAddress, termStartTime)
  const lastFullPaymentBlock = await cl.lastFullPaymentBlock()
  const lastFullPaymentTime = await getBlockTimestamp(lastFullPaymentBlock)
  const {totalInterestPaid, totalPrincipalPaid} = await calculateTotalPaid(pool, clAddress)
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
  let termInDays = await creditLine.termInDays()
  if (clAddress === "0x306e330d084f7996f41bb113b5f0f15501c821a5") {
    // This is the Alma creditline, which we bumped the maturity date on.
    // We didn't update the termInDays because we can't directly change that, and
    // we could achieve the same effect by upping the termEndBlock. So for expediency,
    // just doing a change here so we get the right term start block
    termInDays = new BN(1196)
  }
  const termInBlocks = termInDays.mul(new BN(BLOCKS_PER_DAY))
  const startBlock = (await creditLine.termEndBlock()).sub(termInBlocks)
  const fractionOfPeriod = interestAccruedAsOfBlock.sub(startBlock).toNumber() / termInBlocks.toNumber()
  const secondsIntoPeriod = fractionOfPeriod * termInDays.toNumber() * SECONDS_PER_DAY.toNumber()
  return termStartTime + secondsIntoPeriod
}

async function calculateTotalPaid(pool, creditLine) {
  // I verified this appears to return the right amounts, based on events
  // received for the quick check creditline, cross checked with
  // https://docs.google.com/spreadsheets/d/1trna25FAnzBtTDnWoBC9-JMZ-PRn-I87jNc7o9KLrto/edit#gid=0
  const otherPool = await getTruffleContract("Pool", {at: pool.address})
  const chainId = isMainnetForking() ? MAINNET_CHAIN_ID : await getChainId()
  const web3Pool = new web3.eth.Contract(otherPool.abi, pool.address)
  const info = asNonNullable(borrowerCreditlines[chainId])[creditLine]
  assertNonNullable(info)
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

export {
  calculateNextDueTime,
  calculateTermTimes,
  calculateTotalPaid,
  getBlockTimestamp,
  getInterestAccruedAsOf,
  getMigrationData,
  migrateClToV2,
  borrowerCreditlines,
  borrowerAddresses,
}
