import {findEnvLocal} from "@goldfinch-eng/utils/src/env"
import {program} from "commander"
import dotenv from "dotenv"
import fs from "fs"
import {isArrayOfJsonAccountedGrant, JsonAccountedGrant} from "../types"
dotenv.config({path: findEnvLocal()})

/**
 * Script for generating a JSON file containing an array of JsonAccountedGrant objects;
 * the file can be used as the input to the `generateMerkleRoot` script.
 *
 * This script expects as input an array of "template" JsonAccountedGrant objects, whose account
 * will be replaced using the addresses read from the MERKLE_DISTRIBUTOR_GRANT_RECIPIENTS
 * environment variable.
 */

export function generateMerkleDistributorGrants(templateJson: unknown): JsonAccountedGrant[] {
  if (!isArrayOfJsonAccountedGrant(templateJson)) {
    throw new Error("Invalid JSON.")
  }
  if (!templateJson.length) {
    throw new Error("Grants array must not be empty.")
  }

  const accounts = (process.env.MERKLE_DISTRIBUTOR_GRANT_RECIPIENTS || "").split(",").filter((val) => !!val)
  if (!accounts.length) {
    throw new Error("Accounts array must not be empty.")
  }

  const grants: JsonAccountedGrant[][] = accounts.map((account) =>
    templateJson.map(
      (grantTemplate): JsonAccountedGrant => ({
        ...grantTemplate,
        account,
      })
    )
  )

  return grants.reduce((acc, curr) => acc.concat(curr), [])
}

if (require.main === module) {
  program
    .version("0.0.0")
    .requiredOption(
      "-i, --input <path>",
      "input JSON file location containing an array of template JsonAccountedGrant objects"
    )

  program.parse(process.argv)

  const options = program.opts()
  const json = JSON.parse(fs.readFileSync(options.input, {encoding: "utf8"}))

  console.log(JSON.stringify(generateMerkleDistributorGrants(json), null, 2))
}
