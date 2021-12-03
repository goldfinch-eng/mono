import {
  FLIGHT_ACADEMY_DIRECT_GRANT_REASON,
  JsonAccountedDirectGrant,
  MerkleDirectDistributorInfo,
} from "../../../../blockchain_scripts/merkle/merkleDirectDistributor/types"

export const TEST_MERKLE_DIRECT_DISTRIBUTOR_RECIPIENT_A = "0xd4ad17f7F7f62915A1F225BB1CB88d2492F89769"
export const TEST_MERKLE_DIRECT_DISTRIBUTOR_RECIPIENT_B = "0xb5c52599dFc7F9858F948f003362A7f4B5E678A5"

const accountedGrant0: JsonAccountedDirectGrant = {
  account: TEST_MERKLE_DIRECT_DISTRIBUTOR_RECIPIENT_A,
  reason: FLIGHT_ACADEMY_DIRECT_GRANT_REASON,
  grant: {
    amount: "1000",
  },
}
const accountedGrant1: JsonAccountedDirectGrant = {
  account: TEST_MERKLE_DIRECT_DISTRIBUTOR_RECIPIENT_A,
  reason: FLIGHT_ACADEMY_DIRECT_GRANT_REASON,
  grant: {
    amount: "3000",
  },
}
const accountedGrant2: JsonAccountedDirectGrant = {
  account: TEST_MERKLE_DIRECT_DISTRIBUTOR_RECIPIENT_B,
  reason: FLIGHT_ACADEMY_DIRECT_GRANT_REASON,
  grant: {
    amount: "2000",
  },
}
const accountedGrants: JsonAccountedDirectGrant[] = [accountedGrant0, accountedGrant1, accountedGrant2]

export const merkleDirectDistributorInfo: MerkleDirectDistributorInfo = {
  merkleRoot: "0x511e1628933bd68ad4eb62ff4bbec21bea72d5305cb5b421d5b8742a7b22c235",
  amountTotal: "0x1770",
  grants: [
    {
      index: 0,
      account: accountedGrant2.account,
      reason: accountedGrant2.reason,
      grant: {
        amount: "0x07d0",
      },
      proof: ["0x08eeb896964f4eb5c03602f111f1b8d3a7b80a177037c9b9a1e985ddfc71096b"],
    },
    {
      index: 1,
      account: accountedGrant0.account,
      reason: accountedGrant0.reason,
      grant: {
        amount: "0x03e8",
      },
      proof: [
        "0x432f84707ecf0aae803fb91ff905d0213afcb4f74923521f47e7fc4f5cfae295",
        "0xef364c7d355eb30a5f72ffc8c4a72b13d0b8f841899c4a24ccc6c178e337cf51",
      ],
    },
    {
      index: 2,
      account: accountedGrant1.account,
      reason: accountedGrant1.reason,
      grant: {
        amount: "0x0bb8",
      },
      proof: [
        "0x7725724b56159fe03d2348eec5ccb2057e7eb8c09773325ae70d29a5eb41bae6",
        "0xef364c7d355eb30a5f72ffc8c4a72b13d0b8f841899c4a24ccc6c178e337cf51",
      ],
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
