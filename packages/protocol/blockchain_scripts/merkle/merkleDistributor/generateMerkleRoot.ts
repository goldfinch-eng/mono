import {BigNumber} from "ethers"
import {program} from "commander"
import fs from "fs"
import {parseGrants} from "./parseGrants"
import {
  AccountedGrant,
  isArrayOfAccountedGrant,
  isArrayOfJsonAccountedGrant,
  JsonAccountedGrant,
  MerkleDistributorInfo,
} from "./types"

/**
 * Script for generating the publicly-releasable info about a rewards distribution,
 * from a JSON file containing an array of JsonAccountedGrant objects.
 *
 * The `merkleRoot` value in the output of this script is suitable for use in
 * the deployment of a MerkleDistributor contract.
 */

export function generateMerkleRoot(json: unknown): MerkleDistributorInfo {
  if (!isArrayOfJsonAccountedGrant(json)) {
    throw new Error("Invalid JSON.")
  }

  if (!json.length) {
    throw new Error("Grants array must not be empty.")
  }

  const accountedGrants: AccountedGrant[] = json.map((info: JsonAccountedGrant) => ({
    account: info.account,
    reason: info.reason,
    grant: {
      amount: BigNumber.from(info.grant.amount),
      vestingLength: BigNumber.from(info.grant.vestingLength),
      cliffLength: BigNumber.from(info.grant.cliffLength),
      vestingInterval: BigNumber.from(info.grant.vestingInterval),
    },
  }))

  if (!isArrayOfAccountedGrant(accountedGrants)) {
    throw new Error("Failed to parse accounted grants.")
  }

  return parseGrants(accountedGrants)
}

if (require.main === module) {
  program
    .version("0.0.0")
    .requiredOption("-i, --input <path>", "input JSON file location containing an array of JsonAccountedGrant objects")
    .requiredOption("-o, --output <path>", "output JSON file location containing a MerkleDistributorInfo object")

  program.parse(process.argv)

  const options = program.opts()
  const json = JSON.parse(fs.readFileSync(options.input, {encoding: "utf8"}))

  fs.writeFileSync(options.output, JSON.stringify(generateMerkleRoot(json), null, 2), {encoding: "utf8"})
}
