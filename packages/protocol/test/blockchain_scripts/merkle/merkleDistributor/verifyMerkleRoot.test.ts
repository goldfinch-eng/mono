import {generateMerkleRoot} from "../../../../blockchain_scripts/merkle/merkleDistributor/generateMerkleRoot"
import {
  JsonAccountedGrant,
  MerkleDistributorInfo,
  MerkleDistributorGrantInfo,
} from "../../../../blockchain_scripts/merkle/merkleDistributor/types"
import {verifyMerkleRoot} from "../../../../blockchain_scripts/merkle/merkleDistributor/verifyMerkleRoot"
import {assertNonEmptyArray, assertNonNullable} from "@goldfinch-eng/utils"
import {genDifferentHexString} from "../../../testHelpers"
import fixtures from "./fixtures"

const genInvalidMerkleDistributorInfo = (
  genInvalidLastGrantInfo: (lastGrantInfo: MerkleDistributorGrantInfo) => MerkleDistributorGrantInfo
): MerkleDistributorInfo => {
  const grants = fixtures.output.grants.slice()
  const last = grants[grants.length - 1]
  assertNonNullable(last)
  const invalidLastGrantInfo = genInvalidLastGrantInfo(last)
  grants[grants.length - 1] = invalidLastGrantInfo
  const json: MerkleDistributorInfo = {
    ...fixtures.output,
    grants,
  }
  return json
}

describe("verifyMerkleRoot", () => {
  it("rejects invalid JSON", async () => {
    const json = {
      ...fixtures.output,
      merkleRoot: 1001,
    }
    expect(() => verifyMerkleRoot(json)).to.throw("Invalid JSON.")
  })

  it("rejects an invalid index for a grant", async () => {
    const json = genInvalidMerkleDistributorInfo((lastGrantInfo) => ({
      ...lastGrantInfo,
      index: lastGrantInfo.index + 1,
    }))
    expect(() => verifyMerkleRoot(json)).to.throw("Failed validation for 1 or more proofs")
  })

  it("rejects an invalid amount for a grant", async () => {
    const json = genInvalidMerkleDistributorInfo((lastGrantInfo) => ({
      ...lastGrantInfo,
      grant: {
        ...lastGrantInfo.grant,
        amount: genDifferentHexString(lastGrantInfo.grant.amount),
      },
    }))
    expect(() => verifyMerkleRoot(json)).to.throw("Failed validation for 1 or more proofs")
  })

  it("rejects an invalid vestingLength for a grant", async () => {
    const json = genInvalidMerkleDistributorInfo((lastGrantInfo) => ({
      ...lastGrantInfo,
      grant: {
        ...lastGrantInfo.grant,
        vestingLength: genDifferentHexString(lastGrantInfo.grant.vestingLength),
      },
    }))
    expect(() => verifyMerkleRoot(json)).to.throw("Failed validation for 1 or more proofs")
  })

  it("rejects an invalid cliffLength for a grant", async () => {
    const json = genInvalidMerkleDistributorInfo((lastGrantInfo) => ({
      ...lastGrantInfo,
      grant: {
        ...lastGrantInfo.grant,
        cliffLength: genDifferentHexString(lastGrantInfo.grant.cliffLength),
      },
    }))
    expect(() => verifyMerkleRoot(json)).to.throw("Failed validation for 1 or more proofs")
  })

  it("rejects an invalid vestingInterval for a grant", async () => {
    const json = genInvalidMerkleDistributorInfo((lastGrantInfo) => ({
      ...lastGrantInfo,
      grant: {
        ...lastGrantInfo.grant,
        vestingInterval: genDifferentHexString(lastGrantInfo.grant.vestingInterval),
      },
    }))
    expect(() => verifyMerkleRoot(json)).to.throw("Failed validation for 1 or more proofs")
  })

  it("rejects an invalid (empty) proof array for a grant", async () => {
    const json = genInvalidMerkleDistributorInfo((lastGrantInfo) => ({
      ...lastGrantInfo,
      proof: [],
    }))
    expect(() => verifyMerkleRoot(json)).to.throw("Failed validation for 1 or more proofs")
  })

  it("rejects an invalid (empty) proof string for a grant", async () => {
    const json = genInvalidMerkleDistributorInfo((lastGrantInfo) => {
      const invalidProof: string[] = lastGrantInfo.proof.slice()
      assertNonEmptyArray(invalidProof)
      invalidProof[invalidProof.length - 1] = web3.utils.asciiToHex("")
      return {
        ...lastGrantInfo,
        proof: invalidProof,
      }
    })
    expect(() => verifyMerkleRoot(json)).to.throw("invalid value for bytes32")
  })

  it("rejects an invalid (non-empty) proof string for a grant", async () => {
    const json = genInvalidMerkleDistributorInfo((lastGrantInfo) => {
      const invalidProof: string[] = lastGrantInfo.proof.slice()
      const lastElement = invalidProof[invalidProof.length - 1]
      assertNonNullable(lastElement)
      invalidProof[invalidProof.length - 1] = genDifferentHexString(lastElement)
      return {
        ...lastGrantInfo,
        proof: invalidProof,
      }
    })
    expect(() => verifyMerkleRoot(json)).to.throw("Failed validation for 1 or more proofs")
  })

  it("rejects an invalid root", async () => {
    const differentRoot = genDifferentHexString(fixtures.output.merkleRoot)
    const json: MerkleDistributorInfo = {
      ...fixtures.output,
      merkleRoot: differentRoot,
    }

    expect(() => verifyMerkleRoot(json)).to.throw("Failed validation for 1 or more proofs")
  })

  it("verifies a valid root", async () => {
    const json: MerkleDistributorInfo = fixtures.output

    const verificationResult = verifyMerkleRoot(json)
    expect(verificationResult).to.eql({
      reconstructedMerkleRoot: json.merkleRoot,
      matchesRootInJson: true,
    })
  })

  it("verifies a root generated by `generateMerkleRoot()`", async () => {
    const json: JsonAccountedGrant[] = fixtures.input
    const merkleDistributorInfo = generateMerkleRoot(json)
    expect(merkleDistributorInfo).to.eql(fixtures.output)
    const verificationResult = verifyMerkleRoot(merkleDistributorInfo)
    expect(verificationResult).to.eql({
      reconstructedMerkleRoot: merkleDistributorInfo.merkleRoot,
      matchesRootInJson: true,
    })
  })
})
