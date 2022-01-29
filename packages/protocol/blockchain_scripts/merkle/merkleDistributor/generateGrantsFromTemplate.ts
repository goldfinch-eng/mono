import {findEnvLocal} from "@goldfinch-eng/utils/src/env"
import {program} from "commander"
import dotenv from "dotenv"
import fs from "fs"
import {isArrayOfJsonAccountedGrant, JsonAccountedGrant} from "./types"
dotenv.config({path: findEnvLocal()})

/**
 * Script for generating a JSON blob containing an array of JsonAccountedGrant objects;
 * the blob can be saved to a file and used as the input to the `generateMerkleRoot` script.
 *
 * This script expects as input an array of "template" JsonAccountedGrant objects, whose account
 * will be replaced using the addresses read from the MERKLE_GRANT_RECIPIENTS
 * environment variable, falling back to the address read from the TEST_USER environment variable.
 */

export function generateGrantsFromTemplate(templateJson: unknown): JsonAccountedGrant[] {
  if (!isArrayOfJsonAccountedGrant(templateJson)) {
    throw new Error("Invalid JSON.")
  }
  if (!templateJson.length) {
    throw new Error("Grants array must not be empty.")
  }

  const accounts = (process.env.MERKLE_GRANT_RECIPIENTS || process.env.TEST_USER || "")
    .split(",")
    .filter((val) => !!val)
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

  console.log(JSON.stringify(generateGrantsFromTemplate(json), null, 2))
}
