import {program} from "commander"
import fs from "fs"
import {BigNumber, utils} from "ethers"
import {Grant, isMerkleDistributorInfo, MerkleDistributorGrantInfo} from "./types"
import {assertNonNullable} from "../../utils/type"

/**
 * Script for verifying the Merkle root of a rewards distribution, from the publicly-released JSON file
 * containing the info about the distribution. Has no dependencies on the code used to generate the Merkle
 * root that was deployed to production. Suitable for public release, so that anyone can verify that the
 * rewards distribution consists exclusively of the grant details in the JSON file.
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

const toNode = (index: number | BigNumber, account: string, grant: Grant): Buffer => {
  const pairHex = utils.solidityKeccak256(
    ["uint256", "address", "uint256", "uint256", "uint256", "uint256"],
    [index, account, grant.amount, grant.vestingLength, grant.cliffLength, grant.vestingInterval]
  )
  return Buffer.from(pairHex.slice(2), "hex")
}

const verifyProof = (
  index: number | BigNumber,
  account: string,
  grant: Grant,
  proof: Buffer[],
  root: Buffer
): boolean => {
  let pair = toNode(index, account, grant)
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

type ParsedGrantInfo = {
  index: number
  account: string
  grant: Grant
}

const getRoot = (parsed: ParsedGrantInfo[]): Buffer => {
  let nodes = parsed
    .map((parsedInfo) => toNode(parsedInfo.index, parsedInfo.account, parsedInfo.grant))
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

type VerificationResult = {
  reconstructedMerkleRoot: string
  rootMatchesJson: boolean
}

export function verifyMerkleRoot(json: unknown): VerificationResult {
  if (!isMerkleDistributorInfo(json)) {
    throw new Error("Invalid JSON.")
  }

  const merkleRootHex = json.merkleRoot
  const merkleRoot = Buffer.from(merkleRootHex.slice(2), "hex")

  const parsed: ParsedGrantInfo[] = []
  let valid = true

  json.grants.forEach((info: MerkleDistributorGrantInfo) => {
    assertNonNullable(info)
    const proof = info.proof.map((p: string) => Buffer.from(p.slice(2), "hex"))
    const parsedInfo: ParsedGrantInfo = {
      index: info.index,
      account: info.account,
      grant: {
        amount: BigNumber.from(info.grant.amount),
        vestingLength: BigNumber.from(info.grant.vestingLength),
        cliffLength: BigNumber.from(info.grant.cliffLength),
        vestingInterval: BigNumber.from(info.grant.vestingInterval),
      },
    }
    parsed.push(parsedInfo)
    if (verifyProof(parsedInfo.index, parsedInfo.account, parsedInfo.grant, proof, merkleRoot)) {
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

  // Root
  const root = getRoot(parsed).toString("hex")
  return {
    reconstructedMerkleRoot: root,
    rootMatchesJson: root === merkleRootHex.slice(2),
  }
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

  console.log("Reconstructed Merkle root", result.reconstructedMerkleRoot)
  console.log("Root matches the one read from the JSON?", result.rootMatchesJson)
}
