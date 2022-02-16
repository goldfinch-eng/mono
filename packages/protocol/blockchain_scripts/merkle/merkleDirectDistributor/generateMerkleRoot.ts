import {BigNumber} from "ethers"
import {program} from "commander"
import fs from "fs"
import {parseGrants} from "./parseGrants"
import {
  AccountedDirectGrant,
  isArrayOfAccountedDirectGrant,
  isArrayOfJsonAccountedDirectGrant,
  JsonAccountedDirectGrant,
  MerkleDirectDistributorInfo,
} from "./types"

/**
 * Script for generating the publicly-releasable info about a rewards distribution,
 * from a JSON file containing an array of JsonAccountedDirectGrant objects.
 *
 * The `merkleRoot` value in the output of this script is suitable for use in
 * the deployment of a MerkleDirectDistributor contract.
 */

export function generateMerkleRoot(json: unknown): MerkleDirectDistributorInfo {
  if (!isArrayOfJsonAccountedDirectGrant(json)) {
    throw new Error("Invalid JSON.")
  }

  if (!json.length) {
    throw new Error("Grants array must not be empty.")
  }

  const accountedDirectGrants: AccountedDirectGrant[] = json.map((info: JsonAccountedDirectGrant) => ({
    account: info.account,
    reason: info.reason,
    grant: {
      amount: BigNumber.from(info.grant.amount),
    },
  }))

  if (!isArrayOfAccountedDirectGrant(accountedDirectGrants)) {
    throw new Error("Failed to parse accounted direct grants.")
  }

  return parseGrants(accountedDirectGrants)
}

if (require.main === module) {
  program
    .version("0.0.0")
    .requiredOption(
      "-i, --input <path>",
      "input JSON file location containing an array of JsonAccountedDirectGrant objects"
    )
    .requiredOption("-o, --output <path>", "output JSON file location containing a MerkleDirectDistributorInfo object")

  program.parse(process.argv)

  const options = program.opts()
  const json = JSON.parse(fs.readFileSync(options.input, {encoding: "utf8"}))

  fs.writeFileSync(options.output, JSON.stringify(generateMerkleRoot(json), null, 2), {encoding: "utf8"})
}
