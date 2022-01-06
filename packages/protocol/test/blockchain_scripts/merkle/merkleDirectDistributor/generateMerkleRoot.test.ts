import {generateMerkleRoot} from "../../../../blockchain_scripts/merkle/merkleDirectDistributor/generateMerkleRoot"
import {
  JsonAccountedDirectGrant,
  MerkleDirectDistributorInfo,
} from "../../../../blockchain_scripts/merkle/merkleDirectDistributor/types"
import fixtures from "./fixtures"

describe("generateMerkleRoot", () => {
  it("rejects invalid JSON", async () => {
    const json = [
      {
        account: "0xd4ad17f7F7f62915A1F225BB1CB88d2492F89769",
        grant: {
          amount: 1000,
        },
      },
    ]
    expect(() => generateMerkleRoot(json)).to.throw("Invalid JSON.")
  })

  it("rejects empty grants info", async () => {
    const json: JsonAccountedDirectGrant[] = []
    expect(() => generateMerkleRoot(json)).to.throw("Grants array must not be empty.")
  })

  it("generates the Merkle root, amount total, and grant details of the rewards distribution", async () => {
    const json: JsonAccountedDirectGrant[] = fixtures.input
    const expectedMerkleDistributorInfo: MerkleDirectDistributorInfo = fixtures.output

    const merkleDistributorInfo = generateMerkleRoot(json)
    expect(merkleDistributorInfo).to.eql(expectedMerkleDistributorInfo)
  })
})
