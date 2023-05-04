import {promises as fs} from "fs"
import _, {Dictionary} from "lodash"
import {BigNumber} from "ethers"
import {asNonNullable, assertNonNullable} from "@goldfinch-eng/utils"
import hre from "hardhat"
const {ethers} = hre
import {bigVal, decimals, fiduToUSDC, usdcVal, USDC_DECIMALS} from "@goldfinch-eng/protocol/test/testHelpers"
import {getEthersContract, GFI_DECIMALS, ZERO_ADDRESS} from "../../deployHelpers"
import {Fidu, SeniorPool} from "@goldfinch-eng/protocol/typechain/ethers"

import {multicall, Call, MulticallResult} from "./multicall"
import path from "path"
import BN from "bn.js"
import {
  GOLDFINCH_ADVISOR_GRANT_REASON,
  CONTRIBUTOR_GRANT_REASON,
  GrantReason,
  JsonAccountedGrant,
  GOLDFINCH_INVESTMENT_GRANT_REASON,
} from "../../merkle/merkleDistributor/types"
import {BigNumber as BigNum} from "bignumber.js"
import {TOKEN_LAUNCH_TIME_IN_SECONDS} from "../../baseDeploy"

import {createObjectCsvWriter} from "csv-writer"

import testAddresses from "./testAddresses.json"

let excludeList: string[] = []

// Effectively disable exponentiation
BigNum.config({EXPONENTIAL_AT: 99})

import {parseCsv} from "./parseCsv"
import {Awaited} from "../../types"
import {generateMerkleRoot} from "../../merkle/merkleDistributor/generateMerkleRoot"
import {generateMerkleRoot as generateMerkleDirectRoot} from "../../merkle/merkleDirectDistributor/generateMerkleRoot"

const ONE_YEAR_IN_SECONDS = 365 * 24 * 60 * 60
const ONE_MONTH_IN_SECONDS = ONE_YEAR_IN_SECONDS / 12

export const VESTING_MERKLE_INFO_PATH = path.join(
  __dirname,
  "../../merkle/merkleDistributor/merkleDistributorInfo.json"
)
export const NO_VESTING_MERKLE_INFO_PATH = path.join(
  __dirname,
  "../../merkle/merkleDirectDistributor/merkleDirectDistributorInfo.json"
)

// Inputs
//
// Block number at which to take balance snapshot
const snapshotBlockNumber = 13805859
// Timestamp at which we expect to perform airdrop. This affects vesting schedules,
// since they're defined relative to block.timestamp
const airdropTimestamp = TOKEN_LAUNCH_TIME_IN_SECONDS

const cap = new BigNum(usdcVal("750").toString())
const vestingThreshold = new BigNum(usdcVal("9500").toString())
const communityLpTotalTokenAllocation = new BigNum(40000) // 4% (0.04) in USDC decimals

const gfiValuationUnderCap = usdcVal(98_000_000) // 98M
export const gfiTotalSupply = bigVal(114_285_714)
const gfiTotalSupplyBigNum = new BigNum(gfiTotalSupply.toString())

const traceUser = process.env.TRACE_USER?.toLowerCase()

async function getEarlyLPs() {
  if (!process.env.EARLY_LP_CSV) {
    console.warn("EARLY_LP_CSV envvar not defined")
    return {}
  }
  const earlyLPs = await parseCsv<{
    name: string
    old_address: string
    new_address: string
    vesting_tokens: string
    coinbase_custody: string
    USDC_investment: string
    lock_start: string
  }>(asNonNullable(process.env.EARLY_LP_CSV, "EARLY_LP_CSV envvar must be defined"))

  const earlyLpMapping: {
    [address: string]: {
      oldAddress: string
      vestingTokens: string
      useCoinbaseCustody: boolean
      usdcInvestment: string
      lockStart: string
    }
  } = {}
  for (const earlyLp of earlyLPs) {
    earlyLp.new_address = earlyLp.new_address.toLowerCase()
    earlyLp.old_address = earlyLp.old_address.toLowerCase()
    // Convert to atomic units
    earlyLp.vesting_tokens = new BigNum(earlyLp.vesting_tokens.replace(/,/g, ""))
      .multipliedBy(decimals.toString())
      .toString()
    // Sanitize and convert to atomic units
    earlyLp.USDC_investment = new BigNum(earlyLp.USDC_investment.replace(/,/g, "")).times(1e6).toFixed()

    if (earlyLpMapping[earlyLp.new_address]) {
      console.warn(`Early LP ${earlyLp.new_address} appears twice in CSV`)
      const {vesting_tokens, USDC_investment} = earlyLp

      const existingInfo = asNonNullable(earlyLpMapping[earlyLp.new_address])
      existingInfo.vestingTokens = new BigNum(existingInfo.vestingTokens).plus(vesting_tokens).toFixed(0)
      existingInfo.usdcInvestment = new BigNum(existingInfo.usdcInvestment).plus(USDC_investment).toFixed(0)
    } else {
      earlyLpMapping[earlyLp.new_address] = {
        oldAddress: earlyLp.old_address,
        useCoinbaseCustody: earlyLp.coinbase_custody === "TRUE",
        vestingTokens: earlyLp.vesting_tokens,
        usdcInvestment: earlyLp.USDC_investment,
        lockStart: earlyLp.lock_start,
      }
    }
  }

  const totalUsdcInvestment = _.reduce(
    Object.values(earlyLpMapping),
    (amt, lp) => amt.plus(new BigNum(lp.usdcInvestment)),
    new BigNum(0)
  )
  const expected = new BigNum(usdcVal(12_534_997).toString())
  assert(
    totalUsdcInvestment.eq(expected),
    `Parsed early LP investment != expected (found ${totalUsdcInvestment.toString()}; expected ${expected.toString()}`
  )

  return earlyLpMapping
}

async function fetchFiduBalances(addresses: string[]) {
  // Get Fidu balances as of blockNumber
  const fidu = await getEthersContract<Fidu>("Fidu")

  const chunkSize = 300
  const balanceOfCalls: Call[] = addresses.map((d: string) => {
    return {
      target: fidu.address,
      call: fidu.interface.functions["balanceOf(address)"],
      args: [d],
    }
  })
  const chunkedBalanceOfCalls = _.chunk(balanceOfCalls, chunkSize)
  const multicallResults: MulticallResult<BigNumber>[] = []

  for (let i = 0; i < chunkedBalanceOfCalls.length; i++) {
    console.log(`Multicall chunk ${i + 1} / ${chunkedBalanceOfCalls.length}...`)
    const calls = chunkedBalanceOfCalls[i]
    assertNonNullable(calls)
    const result = await multicall<BigNumber>(calls, {blockTag: snapshotBlockNumber})
    multicallResults.push(result)
  }

  const balances: BigNumber[] = _.flatten(multicallResults.map((r) => r.results))
  const addressToBalance = _.zipObject(addresses, balances.map(String))
  return addressToBalance
}

async function fetchFiduHolders() {
  const fidu = await getEthersContract<Fidu>("Fidu")

  const fiduTransfers = await fidu.queryFilter(fidu.filters.Transfer(), "earliest", snapshotBlockNumber)
  const potentialFiduHolders = _.uniq(fiduTransfers.map((t) => t.args.to)).filter((addr) => addr !== ZERO_ADDRESS)

  const fiduHolderToReceives: {[address: string]: typeof fiduTransfers} = {}
  for (const transfer of fiduTransfers) {
    if (!fiduHolderToReceives[transfer.args.to]) {
      fiduHolderToReceives[transfer.args.to] = []
    }

    asNonNullable(fiduHolderToReceives[transfer.args.to]).push(transfer)
  }

  console.log("# of potential fidu holders:", potentialFiduHolders.length)

  const addressToBalance = await fetchFiduBalances(potentialFiduHolders)

  // Filter out zero balances
  const fiduHolderToBalance: {[address: string]: string} = {}
  for (const address of Object.keys(addressToBalance)) {
    const balance = addressToBalance[address]
    assertNonNullable(balance)
    if (!BigNumber.from(balance).isZero()) {
      fiduHolderToBalance[address] = balance
    }
  }

  const fiduHolderToData: {[address: string]: {receives: typeof fiduTransfers; balance: string}} = {}

  for (const fiduHolder of Object.keys(fiduHolderToBalance)) {
    fiduHolderToData[fiduHolder] = {
      receives: asNonNullable(fiduHolderToReceives[fiduHolder]),
      balance: asNonNullable(fiduHolderToBalance[fiduHolder]),
    }
  }

  return fiduHolderToData
}

type FiduHolderDataMapping = Awaited<ReturnType<typeof fetchFiduHolders>>

function serializeFiduHolderToData(fiduHolderToData: FiduHolderDataMapping) {
  const serialized = _.mapValues(fiduHolderToData, (holderData) => {
    return {
      balance: holderData.balance,
      receives: holderData.receives.map((e) => {
        return {
          name: e.event,
          tx: e.transactionHash,
          blockNumber: e.blockNumber,
          args: {
            from: e.args.from,
            to: e.args.to,
            value: e.args.value.toString(),
          },
        }
      }),
    }
  })

  return _.mapKeys(serialized, (v, k) => k.toLowerCase())
}

async function getBlocks(blockNumbers: number[]) {
  let blockCache: {[blockNumber: number]: {timestamp: number}} = {}
  try {
    blockCache = JSON.parse(String(await fs.readFile(path.join(__dirname, "./blocks.json"))))
  } catch (e: any) {
    console.log(e)
  }

  const filteredBlockNumbers = blockNumbers.filter((blockNumber) => !blockCache[blockNumber])
  // Using infura or alchemy provider directly is both faster and bypasses hardhat provider's timeout, making batching possible
  const provider = new ethers.providers.InfuraProvider("mainnet", {
    projectId: process.env.INFURA_PROJECT_ID,
  })

  const blocksChunk = _.chunk(filteredBlockNumbers, 30)

  for (let chunk = 0; chunk < blocksChunk.length; chunk++) {
    console.log(`getBlock chunk ${chunk + 1} / ${blocksChunk.length}...`)
    const chunkBlockNumbers = asNonNullable(blocksChunk[chunk])

    const blocks = await Promise.all(chunkBlockNumbers.map((blockNumber) => provider.getBlock(blockNumber)))

    blocks.forEach((block) => {
      blockCache[block.number] = {timestamp: block.timestamp}
    })

    if (chunk % 10 === 0) {
      console.log("writing blocks.json")
      await fs.writeFile(path.join(__dirname, "./blocks.json"), JSON.stringify(blockCache, null, 2))
    }
  }

  console.log("writing blocks.json")
  await fs.writeFile(path.join(__dirname, "./blocks.json"), JSON.stringify(blockCache, null, 2))
  return blockCache
}

type SerializedFiduHolderData = ReturnType<typeof serializeFiduHolderToData>[string]

type WithDollarValue<T> = T & {
  dollarValue: string
}

type QualifyingAmounts = {
  uncapped: {
    dollarValue: string
  }
  capped: {
    dollarValue: string
  }
}

async function calculateCommunityRewards({
  fiduHoldersWithDollarValue,
  earlyLPs,
  traceUser,
}: {
  fiduHoldersWithDollarValue: Dictionary<WithDollarValue<SerializedFiduHolderData>>
  earlyLPs: Awaited<ReturnType<typeof getEarlyLPs>>
  traceUser?: string
}) {
  const holderQualifyingAmounts: Dictionary<QualifyingAmounts> = {}
  for (const address of Object.keys(fiduHoldersWithDollarValue)) {
    const holderData = fiduHoldersWithDollarValue[address]
    assertNonNullable(holderData)

    if (excludeList.includes(address.toLowerCase())) {
      console.log("[Community LP]", `Excluding address ${address}`)
      continue
    }

    // Exclude early LP amount from community LP reward
    let dollarValueToConsider = new BigNum(holderData.dollarValue)
    const earlyLP = earlyLPs[address] || Object.values(earlyLPs).find((e) => e.oldAddress === address)
    if (earlyLP) {
      dollarValueToConsider = BigNum.max(dollarValueToConsider.minus(earlyLP.usdcInvestment), new BigNum(0))
      const fourPercent = new BigNum(String(4e16))
      if (dollarValueToConsider.multipliedBy(String(1e18)).div(holderData.dollarValue).gt(fourPercent)) {
        console.log(
          "[Commmunity LP]",
          "Early LP in community airdrop",
          address,
          "dollarValue",
          new BigNum(holderData.dollarValue).dividedBy(1e6).toString(),
          "usdcInvestment",
          new BigNum(earlyLP.usdcInvestment).dividedBy(1e6).toString(),
          "dollarValueToConsider",
          new BigNum(dollarValueToConsider).dividedBy(1e6).toString()
        )
      } else {
        dollarValueToConsider = new BigNum(0)
      }
    }

    const capped: QualifyingAmounts["capped"] = {
      dollarValue: BigNum.min(dollarValueToConsider, cap).toString(),
    }

    const uncapped: QualifyingAmounts["uncapped"] = {
      dollarValue: dollarValueToConsider.minus(new BigNum(capped.dollarValue)).toString(),
    }

    holderQualifyingAmounts[address] = {capped, uncapped}
  }

  if (traceUser) {
    console.log(
      "Trace user: ",
      traceUser,
      "holderQualifyingAmounts",
      holderQualifyingAmounts[traceUser],
      "dolalrValue of fidu",
      fiduHoldersWithDollarValue[traceUser]?.dollarValue
    )
  }

  let totalCappedDollarValue = new BigNum(0)
  for (const address of Object.keys(holderQualifyingAmounts)) {
    const qualifyingAmounts = holderQualifyingAmounts[address]
    assertNonNullable(qualifyingAmounts)

    totalCappedDollarValue = totalCappedDollarValue.plus(new BigNum(qualifyingAmounts.capped.dollarValue))
  }
  const percentOfGfiSupplyForCapped = totalCappedDollarValue
    .multipliedBy(USDC_DECIMALS.toString())
    .div(gfiValuationUnderCap.toString())
    .toString()
  const percentOfGfiSupplyForUncapped = communityLpTotalTokenAllocation.minus(percentOfGfiSupplyForCapped).toString()
  assert(
    new BigNum(percentOfGfiSupplyForCapped).plus(percentOfGfiSupplyForUncapped).eq(communityLpTotalTokenAllocation),
    "Percent of capped and uncapped do not match total % community allocation"
  )

  let totalUncappedDollarValue = new BigNum(0)
  for (const address of Object.keys(holderQualifyingAmounts)) {
    const qualifyingAmounts = holderQualifyingAmounts[address]
    assertNonNullable(qualifyingAmounts)

    totalUncappedDollarValue = totalUncappedDollarValue.plus(new BigNum(qualifyingAmounts.uncapped.dollarValue))
  }

  const totalGfiSupplyForUncapped = gfiTotalSupplyBigNum
    .multipliedBy(percentOfGfiSupplyForUncapped)
    .div(USDC_DECIMALS.toString())
  const totalGfiSupplyForCapped = gfiTotalSupplyBigNum
    .multipliedBy(percentOfGfiSupplyForCapped)
    .div(USDC_DECIMALS.toString())

  console.log("totalCappedDollarValue", totalCappedDollarValue.toString())
  console.log(
    "avg capped dollar value",
    totalCappedDollarValue.div(new BigNum(Object.keys(holderQualifyingAmounts).length)).toString()
  )
  console.log("totalUncappedDollarValue", totalUncappedDollarValue.toString())
  console.log(
    "totalDollarValue (to consider for community LP grant)",
    totalCappedDollarValue.plus(totalUncappedDollarValue).toString()
  )
  console.log(
    "avg total dollar value",
    totalCappedDollarValue
      .plus(totalUncappedDollarValue)
      .div(new BigNum(Object.keys(holderQualifyingAmounts).length))
      .toString()
  )
  console.log(
    "total fidu dollar value (all holders, including early LPs)",
    _.reduce(
      Object.values(fiduHoldersWithDollarValue),
      (amt, fiduHolder) => amt.plus(new BigNum(fiduHolder.dollarValue)),
      new BigNum(0)
    ).toString()
  )
  console.log("gfiValuationUnderCap", gfiValuationUnderCap.toString())
  console.log("% of gfi supply for capped", percentOfGfiSupplyForCapped.toString())
  console.log("Gfi supply for capped", totalGfiSupplyForCapped.toString())

  console.log("% of gfi supply for uncapped", percentOfGfiSupplyForUncapped.toString())
  console.log("Gfi supply for uncapped", totalGfiSupplyForUncapped.toString())

  const holdersNoVesting: Dictionary<QualifyingAmounts> = {}
  const holdersVesting: Dictionary<QualifyingAmounts> = {}
  for (const address of Object.keys(holderQualifyingAmounts)) {
    const qualifyingAmounts = holderQualifyingAmounts[address]
    assertNonNullable(qualifyingAmounts)

    const amount = new BigNum(qualifyingAmounts.capped.dollarValue).plus(
      new BigNum(qualifyingAmounts.uncapped.dollarValue)
    )
    if (amount.lte(vestingThreshold)) {
      holdersNoVesting[address] = qualifyingAmounts
    } else {
      holdersVesting[address] = qualifyingAmounts
    }
  }

  console.log("# of total holders", Object.keys(holderQualifyingAmounts).length)
  console.log("# of holders with no vesting", Object.keys(holdersNoVesting).length)
  console.log("# of holders with vesting", Object.keys(holdersVesting).length)

  const noVestingGrants: JsonAccountedGrant[] = []
  const vestingGrants: JsonAccountedGrant[] = []

  const holderToFirstReceive = _.mapValues(fiduHoldersWithDollarValue, (data) => {
    const firstReceive = data.receives[0]
    assertNonNullable(firstReceive)
    return firstReceive
  })

  const receiveBlockNumbers = _.uniq(Object.values(holderToFirstReceive).map((e: any) => e.blockNumber))
  console.log(`${receiveBlockNumbers.length} receive blocks for ${Object.keys(holderToFirstReceive).length} receives`)
  const blocks = await getBlocks(receiveBlockNumbers)

  // For holdersVesting, add their capped grant to noVestingGrants, and their uncapped grant to vestingGrants
  for (const [address, qualifyingAmount] of Object.entries(holdersVesting) as any) {
    const cappedGrantAmount = totalGfiSupplyForCapped
      .multipliedBy(new BigNum(qualifyingAmount.capped.dollarValue))
      .div(totalCappedDollarValue)

    if (!cappedGrantAmount.isZero()) {
      noVestingGrants.push({
        account: address.trim(),
        reason: "liquidity_provider",
        grant: {
          amount: cappedGrantAmount.toFixed(0),
          vestingLength: "0",
          cliffLength: "0",
          vestingInterval: "0",
        },
      })
    }

    const firstReceive = holderToFirstReceive[address]
    assertNonNullable(firstReceive)
    const firstReceiveBlock = blocks[firstReceive.blockNumber]
    assertNonNullable(firstReceiveBlock)

    const vestingInterval = ONE_MONTH_IN_SECONDS
    const vestingLength = ONE_YEAR_IN_SECONDS
    const cliffLength = 0

    // How far are they already into the vesting schedule?
    const elapsedVestingLength = airdropTimestamp - firstReceiveBlock.timestamp

    // How much vesting do they have left?
    let vestingLeft = Math.max(vestingLength - elapsedVestingLength, 0)

    // edge case to handle lp's that started vesting historically previous to launch date
    // to get past the communityRewards.ts vestingLength.mod(vestingInterval) == 0 stmt
    if (vestingLeft % vestingInterval != 0) {
      vestingLeft = new BigNum(vestingLeft)
        .div(new BigNum(vestingInterval))
        .multipliedBy(new BigNum(vestingInterval))
        .toNumber()
    }

    const uncappedGrantAmount = totalGfiSupplyForUncapped
      .multipliedBy(new BigNum(qualifyingAmount.uncapped.dollarValue))
      .div(totalUncappedDollarValue)

    if (!uncappedGrantAmount.isZero()) {
      vestingGrants.push({
        account: address.trim(),
        reason: "liquidity_provider",
        grant: {
          amount: uncappedGrantAmount.toFixed(0),
          vestingLength: vestingLeft.toFixed(0),
          cliffLength: cliffLength.toFixed(0),
          vestingInterval: vestingInterval.toFixed(0),
        },
      })
    }

    if (traceUser && address === traceUser) {
      console.log("Trace user: ", traceUser, {
        uncappedGrantAmount: uncappedGrantAmount.toFixed(0),
        cappedGrantAmount: cappedGrantAmount.toFixed(0),
        vestingLength: vestingLeft.toFixed(0),
      })
    }
  }

  // For holdersNoVesting, add both their capped and uncapped as a single grant to noVestingGrants
  for (const [address, qualifyingAmount] of Object.entries(holdersNoVesting) as any) {
    const uncappedGrantAmount = totalGfiSupplyForUncapped
      .multipliedBy(new BigNum(qualifyingAmount.uncapped.dollarValue))
      .div(totalUncappedDollarValue)

    const cappedGrantAmount = totalGfiSupplyForCapped
      .multipliedBy(new BigNum(qualifyingAmount.capped.dollarValue))
      .div(totalCappedDollarValue)

    const grantAmount = uncappedGrantAmount.plus(cappedGrantAmount)
    if (!grantAmount.isZero()) {
      noVestingGrants.push({
        account: address.trim(),
        reason: "liquidity_provider",
        grant: {
          amount: grantAmount.toFixed(0),
          vestingLength: "0",
          cliffLength: "0",
          vestingInterval: "0",
        },
      })
    }
  }

  return {
    vestingGrants,
    noVestingGrants,
  }
}

async function calculateEarlyLpRewards({
  fiduHoldersWithDollarValue,
  earlyLPs,
  traceUser,
}: {
  fiduHoldersWithDollarValue: Dictionary<WithDollarValue<SerializedFiduHolderData>>
  earlyLPs: Awaited<ReturnType<typeof getEarlyLPs>>
  traceUser?: string
}) {
  const vestingGrants: JsonAccountedGrant[] = []

  // Handle early LP grants
  for (const address of Object.keys(earlyLPs)) {
    const earlyLP = earlyLPs[address]
    assertNonNullable(earlyLP)

    if (excludeList.includes(address.toLowerCase())) {
      console.log("[Early LP]", `Excluding address ${address}`)
      continue
    }

    const fiduHolder = fiduHoldersWithDollarValue[address] || fiduHoldersWithDollarValue[earlyLP.oldAddress]
    if (!fiduHolder) {
      console.warn("[Early LP]", `Skipping early LP ${address} due to not holding FIDU`)
      continue
    }

    if (new BigNum(fiduHolder.dollarValue).lt(new BigNum(earlyLP.usdcInvestment))) {
      console.warn(
        "[Early LP]",
        `Early LP ${address} has less FIDU than initial investment`,
        "fidu dollar value",
        fiduHolder.dollarValue,
        "usdc investment",
        earlyLP.usdcInvestment
      )
      continue
    }

    if (earlyLP.useCoinbaseCustody) {
      console.warn("[Early LP]", `Skipping early LP ${earlyLP.oldAddress} due to coinbase custody`)
      continue
    }

    if (!ethers.utils.isAddress(earlyLP.oldAddress) || !ethers.utils.isAddress(address)) {
      console.warn(`[Early LP] Skipping early LP ${earlyLP.oldAddress} due to invalid address`)
      continue
    }

    const vestingInterval = ONE_MONTH_IN_SECONDS // 1 month in seconds
    const vestingLength = ONE_YEAR_IN_SECONDS / 2 // 6 months in seconds

    vestingGrants.push({
      account: address.trim(),
      reason: "liquidity_provider",
      grant: {
        amount: new BigNum(earlyLP.vestingTokens).toFixed(0),
        vestingLength: vestingLength.toFixed(0),
        cliffLength: "0",
        vestingInterval: vestingInterval.toFixed(0),
      },
    })
  }

  return {vestingGrants}
}

async function getFlightAcademyParticipants() {
  if (!process.env.FLIGHT_ACADEMY_CSV) {
    console.warn("FLIGHT_ACADEMY_CSV envvar not defined")
    return {}
  }

  const flightAcademy = await parseCsv<{
    address: string
    vesting_tokens: string
    immediate_tokens: string
  }>(asNonNullable(process.env.FLIGHT_ACADEMY_CSV, "FLIGHT_ACADEMY_CSV envvar must be defined"))

  const mapping: {
    [address: string]: {
      vestingTokens: string
      immediateTokens: string
    }
  } = {}

  for (const participant of flightAcademy) {
    const vestingTokens = new BigNum(participant.vesting_tokens.replace(/,/g, ""))
      .multipliedBy(decimals.toString())
      .toString()
    const immediateTokens = new BigNum(participant.immediate_tokens.replace(/,/g, ""))
      .multipliedBy(decimals.toString())
      .toString()

    if (mapping[participant.address]) {
      console.warn(`Flight academy ${participant.address} appears twice in CSV`)

      const existingInfo = asNonNullable(mapping[participant.address])
      existingInfo.vestingTokens = new BigNum(existingInfo.vestingTokens).plus(vestingTokens).toString()
      existingInfo.immediateTokens = new BigNum(existingInfo.immediateTokens).plus(immediateTokens).toString()
    } else {
      mapping[participant.address] = {
        vestingTokens,
        immediateTokens,
      }
    }
  }

  return mapping
}

async function getInvestorGrants(): Promise<JsonAccountedGrant[]> {
  const rawInvestors = await parseCsv<{
    Address: string
    Name: string
    coinbase_custody: string
    vesting_tokens: string
  }>(asNonNullable(process.env.INVESTORS_CSV, "INVESTORS_CSV envvar must be defined"))

  const isElligible = ({Name, Address, coinbase_custody}) => {
    const isElligible = Address != "NO_ADDRESS_GIVEN" && coinbase_custody != "TRUE"

    if (!isElligible) {
      console.log(
        `[Investor] excluding investor "${Name}" because they either didn't provide an address or they are using coinbase custody`
      )
    }

    return isElligible
  }

  const investors = rawInvestors.filter(isElligible).map(({Address, vesting_tokens}) => {
    const sanitzedTokens = vesting_tokens.replace(/,/g, "")
    return {
      address: Address,
      tokens: new BigNum(sanitzedTokens),
    }
  })

  // 3 years
  const vestingLength = new BigNum(ONE_YEAR_IN_SECONDS).multipliedBy(new BigNum("3")).toFixed(0)
  // monthly
  const vestingInterval = new BigNum(ONE_MONTH_IN_SECONDS).toFixed(0)
  // 6 months
  const cliffLength = new BigNum(ONE_MONTH_IN_SECONDS).multipliedBy(new BigNum("6")).toFixed(0)

  return investors.map(({address, tokens}) => ({
    account: address.trim(),
    reason: GOLDFINCH_INVESTMENT_GRANT_REASON,
    grant: {
      amount: tokens.multipliedBy(new BigNum(GFI_DECIMALS.toString())).toFixed(0),
      vestingInterval,
      cliffLength,
      vestingLength,
    },
  }))
}

async function getContractorGrants(): Promise<{
  noVestingGrants: JsonAccountedGrant[]
  vestingGrants: JsonAccountedGrant[]
}> {
  type RawContractor = {
    address: string
    tokens: string
    vesting_length: string
    vesting_interval: string
    cliff_length: string
  }

  type Contractor = {
    address: string
    tokens: BigNum
    vestingLength: BigNum
    vestingInterval: BigNum
    cliffLength: BigNum
  }

  const rawContractors = await parseCsv<RawContractor>(
    asNonNullable(process.env.CONTRACTORS_CSV, "CONTRACTORS_CSV envvar must be defined")
  )

  const rawContractorToContractor = ({
    address,
    tokens,
    vesting_interval,
    vesting_length,
    cliff_length,
  }: RawContractor): Contractor => ({
    address,
    tokens: new BigNum(tokens.replace(/,/g, "")).multipliedBy(GFI_DECIMALS.toString()),
    vestingInterval: new BigNum(vesting_interval),
    vestingLength: new BigNum(vesting_length),
    cliffLength: new BigNum(cliff_length),
  })

  const contractors = rawContractors.map(rawContractorToContractor)

  const grants = contractors.map(
    ({address, tokens, vestingInterval, vestingLength, cliffLength}: Contractor): JsonAccountedGrant => ({
      account: address,
      reason: "contributor",
      grant: {
        amount: tokens.toFixed(0),
        cliffLength: cliffLength.toFixed(0),
        vestingInterval: vestingInterval.toFixed(0),
        vestingLength: vestingLength.toFixed(0),
      },
    })
  )

  const isImmediateGrant = (g: JsonAccountedGrant): boolean => g.grant.vestingLength === "0"
  const isVestingGrant = (g: JsonAccountedGrant): boolean => !isImmediateGrant(g)

  const vestingGrants = grants.filter(isVestingGrant)
  const noVestingGrants = grants.filter(isImmediateGrant)

  return {vestingGrants, noVestingGrants}
}

async function getAdvisorGrants(): Promise<JsonAccountedGrant[]> {
  const rawAdvisors = await parseCsv<{name: string; address: string; coinbase_custody: string; tokens: string}>(
    asNonNullable(process.env.ADVISORS_CSV, "ADVISORS_CSV envvar must be defined")
  )

  const advisorIsElligible = ({name, address, coinbase_custody}) => {
    const isElligible = address != "NO_ADDRESS_GIVEN" && coinbase_custody.toLowerCase() != "true"
    if (!isElligible) {
      console.log(
        `[Advisor] skipping advisor "${name}" because they either didnt provide an address or are using coinbase custody`
      )
    }

    return isElligible
  }

  const advisors = rawAdvisors
    // advisors with no address given are having their allocations sent to coinbase custody
    .filter(advisorIsElligible)
    .map(({address, tokens}) => {
      const sanitizedTokenStr = tokens.replace(/,/g, "")
      return {address, tokens: new BigNum(sanitizedTokenStr)}
    })

  // 3 years
  const vestingLength = new BigNum(ONE_YEAR_IN_SECONDS).multipliedBy(new BigNum("3")).toFixed(0)
  // 1 month
  const vestingInterval = new BigNum(ONE_MONTH_IN_SECONDS).toFixed(0)
  // 6 months
  const cliffLength = new BigNum(ONE_MONTH_IN_SECONDS).multipliedBy(new BigNum("6")).toFixed(0)

  return advisors.map(({address, tokens}) => ({
    account: address.trim(),
    reason: GOLDFINCH_ADVISOR_GRANT_REASON,
    grant: {
      amount: tokens.multipliedBy(GFI_DECIMALS.toString()).toFixed(0),
      vestingInterval,
      vestingLength,
      cliffLength,
    },
  }))
}

async function getContributorGrants(): Promise<{
  vestingGrants: JsonAccountedGrant[]
  noVestingGrants: JsonAccountedGrant[]
}> {
  const rawContributors = await parseCsv<{address: string; immediate_tokens: string; vesting_tokens: string}>(
    asNonNullable(process.env.CONTRIBUTORS_CSV, "CONTRIBUTORS_CSV ennvar must be defined")
  )

  const contributors = rawContributors.map(({address, immediate_tokens, vesting_tokens}) => {
    const sanitizedImmediateTokens = immediate_tokens.replace(/,/g, "")
    const sanitizedVestingTokens = vesting_tokens.replace(/,/g, "")

    return {
      address,
      immediateTokens: new BigNum(sanitizedImmediateTokens),
      vestingTokens: new BigNum(sanitizedVestingTokens),
    }
  })

  const makeImmediateGrant = (address, tokens: BigNum): JsonAccountedGrant => ({
    account: address.trim(),
    reason: CONTRIBUTOR_GRANT_REASON,
    grant: {
      amount: tokens.multipliedBy(GFI_DECIMALS.toString()).toFixed(0),
      vestingInterval: "0",
      vestingLength: "0",
      cliffLength: "0",
    },
  })

  // two years
  const vestingLength = new BigNum(ONE_YEAR_IN_SECONDS).multipliedBy(new BigNum(2)).toFixed(0)
  // monthly vesting interval
  const vestingInterval = new BigNum(ONE_YEAR_IN_SECONDS).dividedBy(new BigNum(12)).toFixed(0)
  const cliffLength = "0"

  const makeVestingGrant = (address, tokens: BigNum): JsonAccountedGrant => ({
    account: address.trim(),
    reason: CONTRIBUTOR_GRANT_REASON,
    grant: {
      amount: tokens.multipliedBy(GFI_DECIMALS.toString()).toFixed(0),
      vestingInterval,
      cliffLength,
      vestingLength,
    },
  })

  const allGrants = _.flatMap(contributors, ({address, immediateTokens, vestingTokens}) => [
    !immediateTokens.isZero() ? makeImmediateGrant(address, immediateTokens) : undefined,
    !vestingTokens.isZero() ? makeVestingGrant(address, vestingTokens) : undefined,
  ]).filter((x) => x !== undefined) as JsonAccountedGrant[]

  const isVestingGrant = (grant: JsonAccountedGrant) => grant.grant.vestingLength !== "0"
  const isNoVestingGrant = (grant: JsonAccountedGrant) => !isVestingGrant(grant)

  const vestingGrants = allGrants.filter(isVestingGrant)
  const noVestingGrants = allGrants.filter(isNoVestingGrant)

  return {vestingGrants, noVestingGrants}
}

async function calculateFlightAcademyRewards() {
  const participants = await getFlightAcademyParticipants()

  const noVestingGrants: JsonAccountedGrant[] = []
  const vestingGrants: JsonAccountedGrant[] = []

  // Vesting start time is token launch time by default
  const vestingInterval = ONE_MONTH_IN_SECONDS // 1 month in seconds
  const vestingLength = ONE_YEAR_IN_SECONDS * 2 // 2 year in seconds

  for (const address of Object.keys(participants)) {
    const participant = asNonNullable(participants[address])

    if (excludeList.includes(address.toLowerCase())) {
      console.log("[FA]", `Excluding address ${address}`)
      continue
    }

    if (!new BigNum(participant.vestingTokens).isZero()) {
      vestingGrants.push({
        account: address.trim(),
        reason: "flight_academy",
        grant: {
          amount: participant.vestingTokens,
          vestingLength: vestingLength.toFixed(0),
          cliffLength: "0",
          vestingInterval: vestingInterval.toFixed(0),
        },
      })
    }

    if (!new BigNum(participant.immediateTokens).isZero()) {
      noVestingGrants.push({
        account: address.trim(),
        reason: "flight_academy",
        grant: {
          amount: participant.immediateTokens,
          vestingLength: "0",
          cliffLength: "0",
          vestingInterval: "0",
        },
      })
    }
  }

  return {vestingGrants, noVestingGrants}
}

async function calculateTestGrants() {
  const noVestingGrants: JsonAccountedGrant[] = []
  const vestingGrants: JsonAccountedGrant[] = []

  for (const testAddress of testAddresses) {
    noVestingGrants.push({
      account: testAddress,
      reason: "liquidity_provider",
      grant: {
        amount: new BigNum(String(1e16)).toString(),
        vestingLength: "0",
        cliffLength: "0",
        vestingInterval: "0",
      },
    })

    noVestingGrants.push({
      account: testAddress,
      reason: "flight_academy",
      grant: {
        amount: new BigNum(String(1e16)).toString(),
        vestingLength: "0",
        cliffLength: "0",
        vestingInterval: "0",
      },
    })

    vestingGrants.push({
      account: testAddress,
      reason: "liquidity_provider",
      grant: {
        amount: new BigNum(String(1e16)).toString(),
        vestingLength: "600",
        cliffLength: "0",
        vestingInterval: "60",
      },
    })

    vestingGrants.push({
      account: testAddress,
      reason: "flight_academy",
      grant: {
        amount: new BigNum(String(1e16)).toString(),
        vestingLength: "86400",
        cliffLength: "0",
        vestingInterval: "3600",
      },
    })
  }

  return {
    noVestingGrants,
    vestingGrants,
  }
}

export function combineGrants({
  grants,
  reason,
}: {
  grants: JsonAccountedGrant[]
  reason: GrantReason
}): JsonAccountedGrant[] {
  const addressesToGrants: {[address: string]: JsonAccountedGrant[]} = {}
  for (const grant of grants) {
    if (addressesToGrants[grant.account.toLowerCase()]) {
      asNonNullable(addressesToGrants[grant.account.toLowerCase()]).push(grant)
    } else {
      addressesToGrants[grant.account.toLowerCase()] = [grant]
    }
  }

  const combinedGrants: JsonAccountedGrant[] = []
  for (const [address, grants] of Object.entries(addressesToGrants)) {
    if (grants.length > 1) {
      const vestingParametersGrant = grants[0]
      assertNonNullable(vestingParametersGrant)
      const amount = _.reduce(
        grants,
        (amt, grant) => {
          if (
            grant.grant.vestingLength !== vestingParametersGrant.grant.vestingLength ||
            grant.grant.cliffLength !== vestingParametersGrant.grant.cliffLength ||
            grant.grant.vestingInterval !== vestingParametersGrant.grant.vestingInterval
          ) {
            throw new Error("Vesting doesn't match for combined grants")
          }
          return amt.plus(new BigNum(grant.grant.amount))
        },
        new BigNum(0)
      )
      combinedGrants.push({
        account: address.trim(),
        reason,
        grant: {
          amount: amount.toString(),
          vestingLength: vestingParametersGrant.grant.vestingLength,
          cliffLength: vestingParametersGrant.grant.cliffLength,
          vestingInterval: vestingParametersGrant.grant.vestingInterval,
        },
      })
    } else {
      combinedGrants.push(asNonNullable(grants[0]))
    }
  }

  return combinedGrants
}

export type DebugInfo = {
  fiduHoldersWithDollarValue: Dictionary<WithDollarValue<SerializedFiduHolderData>>
  earlyLPs: Awaited<ReturnType<typeof getEarlyLPs>>
  contractorGrants?: Awaited<ReturnType<typeof getContractorGrants>>
  advisorGrants?: Awaited<ReturnType<typeof getAdvisorGrants>>
  contributorGrants?: Awaited<ReturnType<typeof getContributorGrants>>
  investorGrants?: Awaited<ReturnType<typeof getInvestorGrants>>
  communityGrants?: Awaited<ReturnType<typeof calculateCommunityRewards>>
  earlyLpGrants?: Awaited<ReturnType<typeof calculateEarlyLpRewards>>
  flightAcademyGrants?: Awaited<ReturnType<typeof calculateFlightAcademyRewards>>
  testGrants?: Awaited<ReturnType<typeof calculateTestGrants>>
  vestingGrants?: JsonAccountedGrant[]
  noVestingGrants?: JsonAccountedGrant[]
}

async function main() {
  excludeList = (
    await parseCsv<{
      address: string
    }>(asNonNullable(process.env.EXCLUDE_CSV, "EXCLUDE_CSV envvar must be defined"))
  ).map((row) => row.address.trim())

  // // Get current fidu holders, save to a file
  // const fiduHolderToData = serializeFiduHolderToData(await fetchFiduHolders())
  // await fs.writeFile(path.join(__dirname, "./fiduHolderToData.json"), JSON.stringify(fiduHolderToData, null, 2))

  const fiduHolderToData = JSON.parse(String(await fs.readFile(path.join(__dirname, "./fiduHolderToData.json")))) as {
    [address: string]: SerializedFiduHolderData
  }

  console.log("getting advisor grants")
  const advisorGrants = await getAdvisorGrants()
  console.log("getting investor grants")
  const investorGrants = await getInvestorGrants()
  console.log("getting contributor grants")
  const contributorGrants = await getContributorGrants()
  console.log("getting early LP")
  const earlyLPs = await getEarlyLPs()
  console.log("getting contractor grants")
  const contractorGrants = await getContractorGrants()

  if (traceUser) {
    console.log("Trace user: ", traceUser, "balance", fiduHolderToData[traceUser]?.balance)
  }

  const seniorPool = await getEthersContract<SeniorPool>("SeniorPool")
  // // Uncomment to use dollar value of shares
  const sharePrice = await seniorPool.sharePrice({blockTag: snapshotBlockNumber})
  // const sharePrice = bigVal(1)
  console.log("sharePrice", sharePrice.toString())

  const fiduHoldersWithDollarValue: Dictionary<WithDollarValue<SerializedFiduHolderData>> = {}
  for (const address of Object.keys(fiduHolderToData)) {
    const holderData = fiduHolderToData[address]
    assertNonNullable(holderData)

    const dollarValue = fiduToUSDC(
      new BN(
        new BigNum(holderData.balance)
          .multipliedBy(new BigNum(sharePrice.toString()))
          .div(decimals.toString())
          .toFixed(0)
      )
    )

    fiduHoldersWithDollarValue[address] = {
      ...holderData,
      dollarValue: dollarValue.toString(),
    }
  }

  const debugInfo: DebugInfo = {
    fiduHoldersWithDollarValue,
    earlyLPs,
  }

  const communityGrants = await calculateCommunityRewards({
    fiduHoldersWithDollarValue,
    earlyLPs,
    traceUser,
  })

  const earlyLpGrants = await calculateEarlyLpRewards({
    fiduHoldersWithDollarValue,
    earlyLPs,
    traceUser,
  })

  const flightAcademyGrants = await calculateFlightAcademyRewards()

  const testGrants = await calculateTestGrants()

  debugInfo.communityGrants = communityGrants
  debugInfo.earlyLpGrants = earlyLpGrants
  debugInfo.flightAcademyGrants = flightAcademyGrants
  debugInfo.testGrants = testGrants

  const noVestingGrants: JsonAccountedGrant[] = []
  const vestingGrants: JsonAccountedGrant[] = []

  noVestingGrants.push(
    ...contractorGrants.noVestingGrants,
    ...contributorGrants.noVestingGrants,
    ...combineGrants({
      grants: _.concat(
        communityGrants.noVestingGrants,
        flightAcademyGrants.noVestingGrants,
        testGrants.noVestingGrants
      ),
      reason: "flight_academy_and_liquidity_provider",
    })
  )

  vestingGrants.push(...contractorGrants.vestingGrants)
  vestingGrants.push(...contributorGrants.vestingGrants)
  vestingGrants.push(...investorGrants)
  vestingGrants.push(...advisorGrants)
  vestingGrants.push(...communityGrants.vestingGrants)
  vestingGrants.push(...earlyLpGrants.vestingGrants)
  vestingGrants.push(...flightAcademyGrants.vestingGrants)
  vestingGrants.push(...testGrants.vestingGrants)

  debugInfo.contractorGrants = contractorGrants
  debugInfo.investorGrants = investorGrants
  debugInfo.contributorGrants = contributorGrants
  debugInfo.advisorGrants = advisorGrants
  debugInfo.vestingGrants = vestingGrants
  debugInfo.noVestingGrants = noVestingGrants

  console.log("Writing grants files")
  await fs.writeFile(path.join(__dirname, "./grants.no_vesting.json"), JSON.stringify(noVestingGrants, null, 2))
  await fs.writeFile(path.join(__dirname, "./grants.vesting.json"), JSON.stringify(vestingGrants, null, 2))

  console.log("Writing merkle roots")
  const vestingMerkleInfo = generateMerkleRoot(vestingGrants)
  await fs.writeFile(VESTING_MERKLE_INFO_PATH, JSON.stringify(vestingMerkleInfo, null, 2))
  const noVestingMerkleInfo = generateMerkleDirectRoot(noVestingGrants)
  await fs.writeFile(NO_VESTING_MERKLE_INFO_PATH, JSON.stringify(noVestingMerkleInfo, null, 2))

  console.log("Writing debug info")
  await fs.writeFile(path.join(__dirname, "./debug.json"), JSON.stringify(debugInfo, null, 2))

  await writeDebugCsv(debugInfo as Required<DebugInfo>)
}

async function writeDebugCsv(debugInfo: Required<DebugInfo>) {
  const headers = [
    "account",
    "reason",
    "amount_gfi",
    "amount_atomic",
    "vesting",
    "vesting_length",
    "cliff_length",
    "vesting_interval",
    "account_fidu_balance",
    "account_fidu_balance_atomic",
    "account_fidu_balance_dollar_value",
    "account_first_receive_tx",
  ]

  const csvWriter = createObjectCsvWriter({
    path: path.join(__dirname, "./debug.csv"),
    header: headers.map((h) => ({id: h, title: h})),
  })

  const grantToRecord = (g: JsonAccountedGrant, reasonOverride?: string) => ({
    account: g.account,
    reason: reasonOverride ?? g.reason,
    amount_atomic: g.grant.amount,
    amount_gfi: new BigNum(g.grant.amount).dividedBy(1e18).toFixed(18),
    vesting: g.grant.vestingLength !== "0",
    vesting_length: g.grant.vestingLength,
    vesting_interval: g.grant.vestingInterval,
    cliff_length: g.grant.cliffLength,
    account_fidu_balance: new BigNum(debugInfo.fiduHoldersWithDollarValue[g.account]?.balance || "0")
      .dividedBy(1e18)
      .toString(),
    account_fidu_balance_atomic: debugInfo.fiduHoldersWithDollarValue[g.account]?.balance || "0",
    account_fidu_balance_dollar_value: new BigNum(debugInfo.fiduHoldersWithDollarValue[g.account]?.dollarValue || "0")
      .dividedBy(1e6)
      .toString(),
    account_first_receive_tx: debugInfo.fiduHoldersWithDollarValue[g.account]?.receives[0]?.tx,
  })

  const records = _.concat(
    debugInfo.contractorGrants.vestingGrants.map((g) => grantToRecord(g, "contractor")),
    debugInfo.contractorGrants.noVestingGrants.map((g) => grantToRecord(g, "contractor")),
    debugInfo.communityGrants.vestingGrants.map((g) => grantToRecord(g)),
    debugInfo.communityGrants.noVestingGrants.map((g) => grantToRecord(g)),
    debugInfo.earlyLpGrants.vestingGrants.map((g) => grantToRecord(g, "early_lp")),
    debugInfo.flightAcademyGrants.vestingGrants.map((g) => grantToRecord(g)),
    debugInfo.flightAcademyGrants.noVestingGrants.map((g) => grantToRecord(g)),
    debugInfo.testGrants.vestingGrants.map((g) => grantToRecord(g, "test_grant")),
    debugInfo.testGrants.noVestingGrants.map((g) => grantToRecord(g, "test_grant")),
    debugInfo.advisorGrants.map((g) => grantToRecord(g)),
    debugInfo.investorGrants.map((g) => grantToRecord(g)),
    debugInfo.contributorGrants.noVestingGrants.map((g) => grantToRecord(g)),
    debugInfo.contributorGrants.vestingGrants.map((g) => grantToRecord(g))
  )

  await csvWriter.writeRecords(records)
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
