import {promises as fs} from "fs"
import {BigNumber as BigNum} from "bignumber.js"
import {parseCsv} from "../community/parseCsv"
import {program} from "commander"
import {decimals} from "@goldfinch-eng/protocol/test/testHelpers"
import {
  LIQUIDITY_PROVIDER_GRANT_REASON,
} from "@goldfinch-eng/protocol/blockchain_scripts/merkle/merkleDistributor/types"

async function getNotVestedContracts() {}

interface RawCSV {
  poolName: string
  poolAddress: string
  backerAddress: string
  usdcAmount: string
  cappedAirdropGFI: string
  uncappedAirdropGFI: string
  riskBonusGFI: string
  modeledLiqMiningGFI: string
  totalGfiDistribution: string
  immediatelyAvailable: string
  unlocksOver12months: string
  returnAtPrice: string
}

interface PreparedRow {
  backerAddress: string
  immediatelyAvailable: BigNum,
  vesting: BigNum
}

function sanitizeData(data: RawCSV[]): PreparedRow[] {
  const toBigInt = (s: string) => new BigNum(s.replace(/,/g, ""))
    .multipliedBy(decimals.toString())

  return data.map(row => ({
      backerAddress: row['Backer Address'],
      immediatelyAvailable: toBigInt(row['Immeditely available']),
      vesting: toBigInt(row['Unlocks over 12 months']),
  }))
}

async function saveImmediateData(data: PreparedRow[], path: string) {
  console.log(`Saving ${data.length} rows for no-vesting data to ${path}`)
  await fs.writeFile(path, JSON.stringify(data.map(row => ({
    account: row.backerAddress,
    reason: LIQUIDITY_PROVIDER_GRANT_REASON,
    grant: {
      amount: row.immediatelyAvailable.toFixed(),
      cliffLength: "0",
      vestingInterval: "0",
      vestingLength: "0",
    }
  })), null, 2))
}

async function saveVestingData(data: PreparedRow[], path: string) {
  console.log(`Saving ${data.length} rows for no-vesting data to ${path}`)
  await fs.writeFile(path, JSON.stringify(data.map(row => ({
    account: row.backerAddress,
    reason: LIQUIDITY_PROVIDER_GRANT_REASON,
    grant: {
      amount: row.vesting.toFixed(),
      cliffLength: "0",
      vestingInterval: "2628000",  //  1 month
      vestingLength:  "31536000",  // 12 months
    }
  })), null, 2))
}

async function main(inputFile: string, immediatelyAvailableFile: string, vestingFile: string) {
  const data = await parseCsv<RawCSV>(inputFile)
  const sanitizedData = sanitizeData(data)
  await Promise.all([
    saveImmediateData(sanitizedData.filter(row => !row.immediatelyAvailable.isZero()), immediatelyAvailableFile),
    saveVestingData(sanitizedData.filter(row => !row.vesting.isZero()), vestingFile)
  ])
}

if (require.main === module) {
  program
    .version("0.0.0")
    .requiredOption("-i, --input <path>", "input CSV file with grants")
    .requiredOption("-a, --available <path>", "ourput CSV file with data for immediately available tokens")
    .requiredOption("-v, --vesting <path>", "ourput CSV file with data for tokens available with vesting")

  program.parse(process.argv)

  const options = program.opts()
  main(options.input, options.available, options.vesting)
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
}
