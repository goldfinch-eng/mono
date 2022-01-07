// SPDX-License-Identifier: GPL-3.0-only

import {program} from "commander"
import {BigNumber} from "ethers"
import fs from "fs"
import {
  GrantInfo,
  GrantTypesAndValues,
  VerificationResult,
  verifyMerkleRoot as _verifyMerkleRoot,
} from "../common/verifyMerkleRoot"
import {DirectGrant, isMerkleDirectDistributorInfo} from "./types"

/**
 * Script for verifying the Merkle root of a rewards distribution, from the publicly-released JSON file
 * containing the info about the distribution. Has no dependencies on the code (i.e. the `generateMerkleRoot`
 * script) used to generate the Merkle root that was deployed to production. Suitable for public release,
 * so that anyone can verify that the rewards distribution consists exclusively of the grant details in
 * the JSON file.
 *
 * Adapted from https://github.com/Uniswap/merkle-distributor/blob/c3255bfa2b684594ecd562cacd7664b0f18330bf/scripts/verify-merkle-root.ts,
 * which is licensed under the GPL v3.0 license.
 */

const getGrantTypesAndValues = (grant: DirectGrant): GrantTypesAndValues => ({
  types: ["uint256"],
  values: [grant.amount],
})

const parseGrantInfo = (info: GrantInfo<DirectGrant>) => ({
  index: info.index,
  account: info.account,
  grant: {
    amount: BigNumber.from(info.grant.amount),
  },
})

export function verifyMerkleRoot(json: unknown): VerificationResult {
  return _verifyMerkleRoot(json, isMerkleDirectDistributorInfo, parseGrantInfo, getGrantTypesAndValues)
}

if (require.main === module) {
  program
    .version("0.0.0")
    .requiredOption(
      "-i, --input <path>",
      "input JSON file location containing the Merkle proof for each grant and the Merkle root"
    )

  program.parse(process.argv)

  const options = program.opts()
  const json = JSON.parse(fs.readFileSync(options.input, {encoding: "utf8"}))

  const result = verifyMerkleRoot(json)

  console.log("Reconstructed Merkle root:", result.reconstructedMerkleRoot)
  if (result.matchesRootInJson) {
    console.log("Reconstructed root matches root from JSON.")
  } else {
    throw new Error("Reconstructed root does not match root from JSON.")
  }
}
