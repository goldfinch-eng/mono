import {
  FLIGHT_ACADEMY_GRANT_REASON,
  GOLDFINCH_INVESTMENT_GRANT_REASON,
  LIQUIDITY_PROVIDER_GRANT_REASON,
  JsonAccountedGrant,
  MerkleDistributorInfo,
} from "../../../../blockchain_scripts/merkle/merkleDistributor/types"

export const TEST_MERKLE_DISTRIBUTOR_RECIPIENT_A = "0xd4ad17f7F7f62915A1F225BB1CB88d2492F89769"
export const TEST_MERKLE_DISTRIBUTOR_RECIPIENT_B = "0xb5c52599dFc7F9858F948f003362A7f4B5E678A5"

const accountedGrant0: JsonAccountedGrant = {
  account: TEST_MERKLE_DISTRIBUTOR_RECIPIENT_A,
  reason: FLIGHT_ACADEMY_GRANT_REASON,
  grant: {
    amount: "1000",
    vestingLength: "0",
    cliffLength: "0",
    vestingInterval: "1",
  },
}
const accountedGrant1: JsonAccountedGrant = {
  account: TEST_MERKLE_DISTRIBUTOR_RECIPIENT_A,
  reason: GOLDFINCH_INVESTMENT_GRANT_REASON,
  grant: {
    amount: "3000",
    vestingLength: "1000",
    cliffLength: "500",
    vestingInterval: "10",
  },
}
const accountedGrant2: JsonAccountedGrant = {
  account: TEST_MERKLE_DISTRIBUTOR_RECIPIENT_B,
  reason: LIQUIDITY_PROVIDER_GRANT_REASON,
  grant: {
    amount: "2000",
    vestingLength: "1000",
    cliffLength: "10",
    vestingInterval: "1",
  },
}
const accountedGrants: JsonAccountedGrant[] = [accountedGrant0, accountedGrant1, accountedGrant2]

export const merkleDistributorInfo: MerkleDistributorInfo = {
  merkleRoot: "0xe4ae86ff4bd44f7b22c0211a2586789fe681c08dc120392e15f014764e067268",
  amountTotal: "0x1770",
  grants: [
    {
      index: 0,
      account: accountedGrant2.account,
      reason: accountedGrant2.reason,
      grant: {
        amount: "0x07d0",
        vestingLength: "0x03e8",
        cliffLength: "0x0a",
        vestingInterval: "0x01",
      },
      proof: [
        "0x59de8fb9ee9b2ddd6405e0afe130edd276bd402bfba498f64af939f4eb731887",
        "0x73c0c5b1bbf2262ce75d0ccf114b603652cb64ca6082d314fc7fce7937b8eccc",
      ],
    },
    {
      index: 1,
      account: accountedGrant0.account,
      reason: accountedGrant0.reason,
      grant: {
        amount: "0x03e8",
        vestingLength: "0x00",
        cliffLength: "0x00",
        vestingInterval: "0x01",
      },
      proof: ["0xe8102b4ebba4c591cc7821ff0c64994d2670ee0c924bdcb2e7a23385b88205cf"],
    },
    {
      index: 2,
      account: accountedGrant1.account,
      reason: accountedGrant1.reason,
      grant: {
        amount: "0x0bb8",
        vestingLength: "0x03e8",
        cliffLength: "0x01f4",
        vestingInterval: "0x0a",
      },
      proof: [
        "0x67b32b2221828546911da0fb2bb914a20bcbe13c881eb70cc196e98feebdb3a8",
        "0x73c0c5b1bbf2262ce75d0ccf114b603652cb64ca6082d314fc7fce7937b8eccc",
      ],
    },
  ],
}

const fixtures: {
  input: JsonAccountedGrant[]
  output: MerkleDistributorInfo
} = {
  input: accountedGrants,
  output: merkleDistributorInfo,
}

export default fixtures
