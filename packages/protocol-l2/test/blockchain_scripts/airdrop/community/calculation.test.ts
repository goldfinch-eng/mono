import {combineGrants} from "@goldfinch-eng/protocol/blockchain_scripts/airdrop/community/calculation"
import {
  FLIGHT_ACADEMY_AND_LIQUIDITY_PROVIDER_GRANT_REASON,
  JsonAccountedGrant,
} from "@goldfinch-eng/protocol/blockchain_scripts/merkle/merkleDistributor/types"
import {asNonNullable} from "@goldfinch-eng/utils"

describe("airdrop calculation", async () => {
  describe("combineGrants", async () => {
    it("combines grants using reason", async () => {
      const testGrants: JsonAccountedGrant[] = [
        {
          account: "0xtest1",
          reason: "liquidity_provider",
          grant: {
            amount: "1",
            vestingLength: "0",
            cliffLength: "0",
            vestingInterval: "0",
          },
        },
        {
          account: "0xtest1",
          reason: "liquidity_provider",
          grant: {
            amount: "9",
            vestingLength: "0",
            cliffLength: "0",
            vestingInterval: "0",
          },
        },
        {
          account: "0xtest2",
          reason: "liquidity_provider",
          grant: {
            amount: "9",
            vestingLength: "0",
            cliffLength: "0",
            vestingInterval: "0",
          },
        },
      ]
      const combinedGrants = combineGrants({
        grants: testGrants,
        reason: FLIGHT_ACADEMY_AND_LIQUIDITY_PROVIDER_GRANT_REASON,
      })

      expect(combinedGrants.length).to.equal(2)
      const grant1 = asNonNullable(combinedGrants[0])
      const grant2 = asNonNullable(combinedGrants[1])

      // Two 0xtest1 grants should be combined
      expect(grant1.account).to.equal("0xtest1")
      expect(grant1.grant.amount).to.equal("10")
      expect(grant1.reason).to.equal(FLIGHT_ACADEMY_AND_LIQUIDITY_PROVIDER_GRANT_REASON)
      expect(grant1.grant.vestingInterval).to.equal("0")
      expect(grant1.grant.vestingLength).to.equal("0")
      expect(grant1.grant.cliffLength).to.equal("0")

      // Single 0xtest2 grant should remain
      expect(grant2.account).to.eq("0xtest2")
      expect(grant2.grant.amount).to.eq("9")
      expect(grant2.reason).to.equal("liquidity_provider")
      expect(grant2.grant.vestingInterval).to.equal("0")
      expect(grant2.grant.vestingLength).to.equal("0")
      expect(grant2.grant.cliffLength).to.equal("0")
    })
  })
})
