import {promises as fs} from "fs"
import {BigNumber as BigNum} from "bignumber.js"
import {parseCsv} from "../community/parseCsv"
import {program} from "commander"
import {decimals} from "@goldfinch-eng/protocol/test/testHelpers"
import {JsonAccountedGrant, BACKER_GRANT_REASON} from "../../merkle/merkleDistributor/types"
import {BACKER_DIRECT_GRANT_REASON} from "../../merkle/merkleDirectDistributor/types"
import {combineGrants} from "../community/calculation"

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
  immediatelyAvailable: BigNum
  vesting: BigNum
}

function sanitizeData(data: RawCSV[]): PreparedRow[] {
  let duplicates = 0
  const addresses = new Set<string>()
  data.forEach((d) => {
    if (addresses.has(d["Backer Address"])) {
      console.log("Duplicate address", d["Backer Address"])
      duplicates++
    }

    addresses.add(d["Backer Address"])
  })

  console.log("Total duplicate addresses", duplicates)

  const toBigInt = (s: string) => new BigNum(s.replace(/,/g, "")).multipliedBy(decimals.toString())

  return data.map((row) => ({
    backerAddress: row["Backer Address"],
    immediatelyAvailable: toBigInt(row["Immeditely available"]),
    vesting: toBigInt(row["Unlocks over 12 months"]),
  }))
}

async function saveImmediateData(grants: JsonAccountedGrant[], path: string) {
  console.log(`Saving ${grants.length} rows for no-vesting data to ${path}`)
  await fs.writeFile(path, JSON.stringify(grants, null, 2))
}

async function saveVestingData(grants: JsonAccountedGrant[], path: string) {
  console.log(`Saving ${grants.length} rows for vesting data to ${path}`)
  await fs.writeFile(path, JSON.stringify(grants, null, 2))
}

async function main(inputFile: string, immediatelyAvailableFile: string, vestingFile: string) {
  const data = await parseCsv<RawCSV>(inputFile)
  const sanitizedData = sanitizeData(data)

  const immediatelyAvailableGrants: JsonAccountedGrant[] = sanitizedData
    .filter((row) => !row.immediatelyAvailable.isZero())
    .map((row) => ({
      account: row.backerAddress,
      reason: BACKER_DIRECT_GRANT_REASON,
      grant: {
        amount: row.immediatelyAvailable.toFixed(),
        cliffLength: "0",
        vestingInterval: "0",
        vestingLength: "0",
      },
    }))

  const vestingGrants: JsonAccountedGrant[] = sanitizedData
    .filter((row) => !row.vesting.isZero())
    .map((row) => ({
      account: row.backerAddress,
      reason: BACKER_GRANT_REASON,
      grant: {
        amount: row.vesting.toFixed(),
        cliffLength: "0",
        vestingInterval: "2628000", //  1 month
        vestingLength: "31536000", // 12 months
      },
    }))

  const immediatelyAvailableCombinedGrants = combineGrants({
    grants: immediatelyAvailableGrants,
    reason: BACKER_DIRECT_GRANT_REASON,
  })

  const vestingCombinedGrants = combineGrants({
    grants: vestingGrants,
    reason: BACKER_GRANT_REASON,
  })

  await Promise.all([
    saveImmediateData(immediatelyAvailableCombinedGrants, immediatelyAvailableFile),
    saveVestingData(vestingCombinedGrants, vestingFile),
  ])
}

if (require.main === module) {
  program
    .version("0.0.0")
    .requiredOption("-i, --input <path>", "input CSV file with grants")
    .requiredOption("-a, --available <path>", "output CSV file with data for immediately available tokens")
    .requiredOption("-v, --vesting <path>", "output CSV file with data for tokens available with vesting")

  program.parse(process.argv)

  const options = program.opts()
  main(options.input, options.available, options.vesting)
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
}
