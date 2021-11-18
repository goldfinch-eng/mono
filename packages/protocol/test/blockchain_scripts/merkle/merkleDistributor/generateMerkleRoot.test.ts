import {generateMerkleRoot} from "../../../../blockchain_scripts/merkle/merkleDistributor/generateMerkleRoot"
import {JsonAccountedGrant, MerkleDistributorInfo} from "../../../../blockchain_scripts/merkle/merkleDistributor/types"
import fixtures from "./fixtures"

describe("generateMerkleRoot", () => {
  it("rejects invalid JSON", async () => {
    const json = [
      {
        account: "0xd4ad17f7F7f62915A1F225BB1CB88d2492F89769",
        grant: {
          amount: 1000,
          vestingLength: 0,
          cliffLength: 0,
          vestingInterval: 1,
        },
      },
    ]
    expect(() => generateMerkleRoot(json)).to.throw("Invalid JSON.")
  })

  it("rejects empty grants info", async () => {
    const json: JsonAccountedGrant[] = []
    expect(() => generateMerkleRoot(json)).to.throw("Grants array must not be empty.")
  })

  it("generates the Merkle root, amount total, and grant details of the rewards distribution", async () => {
    const json: JsonAccountedGrant[] = fixtures.input
    const expectedMerkleDistributorInfo: MerkleDistributorInfo = fixtures.output

    const merkleDistributorInfo = generateMerkleRoot(json)
    expect(merkleDistributorInfo).to.eql(expectedMerkleDistributorInfo)
  })
})
