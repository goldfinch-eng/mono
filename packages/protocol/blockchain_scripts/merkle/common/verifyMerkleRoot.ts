// SPDX-License-Identifier: GPL-3.0-only

import {assertNonNullable} from "@goldfinch-eng/utils"
import {BigNumber, utils} from "ethers"

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

const combinedHash = (
  pair: {first: Buffer; second: Buffer} | {first: undefined; second: Buffer} | {first: Buffer; second: undefined}
): Buffer => {
  if (!pair.first) {
    return pair.second
  }
  if (!pair.second) {
    return pair.first
  }

  return Buffer.from(
    utils.solidityKeccak256(["bytes32", "bytes32"], [pair.first, pair.second].sort(Buffer.compare)).slice(2),
    "hex"
  )
}

type BaseGrant = {[key: string]: BigNumber}

export type GrantTypesAndValues = {types: string[]; values: BigNumber[]}

function toNode<G extends BaseGrant>(
  index: number,
  account: string,
  grant: G,
  getGrantTypesAndValues: (grant: G) => GrantTypesAndValues
): Buffer {
  const {types: grantTypes, values: grantValues} = getGrantTypesAndValues(grant)
  if (grantTypes.length !== grantValues.length) {
    throw new Error("Failed to extract types and values for node from grant.")
  }

  const types = ["uint256", "address"].concat(grantTypes)
  const baseValues: Array<string | number | BigNumber> = [index, account]
  const values = baseValues.concat(grantValues)
  const pairHex = utils.solidityKeccak256(types, values)
  return Buffer.from(pairHex.slice(2), "hex")
}

function verifyProof<G extends BaseGrant>(
  index: number,
  account: string,
  grant: G,
  getGrantTypesAndValues: (grant: G) => GrantTypesAndValues,
  proof: Buffer[],
  root: Buffer
): boolean {
  let pair = toNode(index, account, grant, getGrantTypesAndValues)
  for (const item of proof) {
    pair = combinedHash({first: pair, second: item})
  }

  return pair.equals(root)
}

const getNextLayer = (elements: Buffer[]): Buffer[] => {
  return elements.reduce<Buffer[]>((layer, el, idx, arr) => {
    if (idx % 2 === 0) {
      // Hash the current element with its pair element
      layer.push(combinedHash({first: el, second: arr[idx + 1]}))
    }

    return layer
  }, [])
}

export type ParsedGrantInfo<G extends BaseGrant> = {
  index: number
  account: string
  grant: G
}

function getRoot<G extends BaseGrant>(
  parsed: ParsedGrantInfo<G>[],
  getGrantTypesAndValues: (grant: G) => GrantTypesAndValues
): Buffer {
  let nodes = parsed
    .map((parsedInfo) => toNode(parsedInfo.index, parsedInfo.account, parsedInfo.grant, getGrantTypesAndValues))
    // sort by lexicographical order
    .sort(Buffer.compare)

  // deduplicate any elements
  nodes = nodes.filter((el, idx): boolean => {
    if (idx) {
      const prevEl = nodes[idx - 1]
      assertNonNullable(prevEl)
      return !prevEl.equals(el)
    } else {
      return true
    }
  })

  const layers: Buffer[][] = []
  layers.push(nodes)

  // Get next layer until we reach the root
  let _layer: Buffer[] | undefined = layers[layers.length - 1]
  assertNonNullable(_layer)
  let layer: Buffer[] = _layer
  while (layer.length > 1) {
    layers.push(getNextLayer(layer))

    _layer = layers[layers.length - 1]
    assertNonNullable(_layer)
    layer = _layer
  }

  const root = layer[0]
  assertNonNullable(root)
  return root
}

export type VerificationResult = {
  reconstructedMerkleRoot: string
  matchesRootInJson: boolean
}

export type GrantInfo<G extends BaseGrant> = {
  index: number
  account: string
  grant: {[key in keyof G]: string}
  proof: string[]
}

type DistributorInfo<G extends BaseGrant> = {
  merkleRoot: string
  amountTotal: string
  grants: GrantInfo<G>[]
}

export function verifyMerkleRoot<G extends BaseGrant>(
  json: unknown,
  isDistributorInfo: (json: unknown) => json is DistributorInfo<G>,
  parseGrantInfo: (info: GrantInfo<G>) => ParsedGrantInfo<G>,
  getGrantTypesAndValues: (grant: G) => GrantTypesAndValues
): VerificationResult {
  if (!isDistributorInfo(json)) {
    throw new Error("Invalid JSON.")
  }

  const merkleRootHex = json.merkleRoot
  const merkleRoot = Buffer.from(merkleRootHex.slice(2), "hex")

  const parsed: ParsedGrantInfo<G>[] = []
  let valid = true

  json.grants.forEach((info: GrantInfo<G>) => {
    const proof = info.proof.map((p: string) => Buffer.from(p.slice(2), "hex"))
    const parsedInfo: ParsedGrantInfo<G> = parseGrantInfo(info)
    parsed.push(parsedInfo)
    if (
      verifyProof(parsedInfo.index, parsedInfo.account, parsedInfo.grant, getGrantTypesAndValues, proof, merkleRoot)
    ) {
      console.log("Verified proof for", info.index, info.account)
    } else {
      console.log("Verification for", info.index, info.account, "failed")
      valid = false
    }
  })

  if (!valid) {
    throw new Error("Failed validation for 1 or more proofs")
  }
  console.log("Done!")

  const rootHex = `0x${getRoot(parsed, getGrantTypesAndValues).toString("hex")}`
  return {
    reconstructedMerkleRoot: rootHex,
    matchesRootInJson: rootHex === merkleRootHex,
  }
}
