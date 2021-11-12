import {
  JsonAccountedDirectGrant,
  MerkleDirectDistributorInfo,
} from "../../../../blockchain_scripts/merkle/merkleDirectDistributor/types"

export const TEST_MERKLE_DIRECT_DISTRIBUTOR_RECIPIENT_A = "0xd4ad17f7F7f62915A1F225BB1CB88d2492F89769"
export const TEST_MERKLE_DIRECT_DISTRIBUTOR_RECIPIENT_B = "0xb5c52599dFc7F9858F948f003362A7f4B5E678A5"

const accountedGrant0: JsonAccountedDirectGrant = {
  account: TEST_MERKLE_DIRECT_DISTRIBUTOR_RECIPIENT_A,
  grant: {
    amount: "1000",
  },
}
const accountedGrant1: JsonAccountedDirectGrant = {
  account: TEST_MERKLE_DIRECT_DISTRIBUTOR_RECIPIENT_B,
  grant: {
    amount: "2000",
  },
}
const accountedGrants: JsonAccountedDirectGrant[] = [accountedGrant0, accountedGrant1]

export const merkleDirectDistributorInfo: MerkleDirectDistributorInfo = {
  merkleRoot: "0x07bdbde09cbab017c205db413d294c4d936a502ff5068199c683e7cad85ea008",
  amountTotal: "0x0bb8",
  grants: [
    {
      index: 0,
      account: accountedGrant1.account,
      grant: {
        amount: "0x07d0",
      },
      proof: ["0x7725724b56159fe03d2348eec5ccb2057e7eb8c09773325ae70d29a5eb41bae6"],
    },
    {
      index: 1,
      account: accountedGrant0.account,
      grant: {
        amount: "0x03e8",
      },
      proof: ["0xef364c7d355eb30a5f72ffc8c4a72b13d0b8f841899c4a24ccc6c178e337cf51"],
    },
  ],
}

const fixtures: {
  input: JsonAccountedDirectGrant[]
  output: MerkleDirectDistributorInfo
} = {
  input: accountedGrants,
  output: merkleDirectDistributorInfo,
}

export default fixtures
