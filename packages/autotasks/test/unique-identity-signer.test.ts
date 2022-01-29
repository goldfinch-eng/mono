import chai from "chai"
import AsPromised from "chai-as-promised"
chai.use(AsPromised)

import {OWNER_ROLE, SIGNER_ROLE} from "@goldfinch-eng/protocol/blockchain_scripts/deployHelpers"
import {ethers, Signer} from "ethers"
import {hardhat} from "@goldfinch-eng/protocol"
import {BN, deployAllContracts, toEthers} from "@goldfinch-eng/protocol/test/testHelpers"
const {deployments, web3} = hardhat
import * as uniqueIdentitySigner from "../unique-identity-signer"
import {assertNonNullable} from "packages/utils/src/type"
import {TestUniqueIdentityInstance} from "packages/protocol/typechain/truffle"
import {UniqueIdentity} from "packages/protocol/typechain/ethers"
import {FetchKYCFunction, KYC} from "../unique-identity-signer"

const TEST_TIMEOUT = 30000

function fetchStubbedKycStatus(kyc: KYC): FetchKYCFunction {
  return async (_) => {
    return Promise.resolve(kyc)
  }
}

const fetchElligibleKycStatus: FetchKYCFunction = fetchStubbedKycStatus({
  status: "approved",
  countryCode: "CA",
})

describe("unique-identity-signer", () => {
  let owner: string
  let anotherUser: string
  let uniqueIdentity: TestUniqueIdentityInstance
  let ethersUniqueIdentity: UniqueIdentity
  let signer: Signer
  let network: ethers.providers.Network
  let fetchKYCFunction: FetchKYCFunction

  const setupTest = deployments.createFixture(async ({deployments, getNamedAccounts}) => {
    const {protocol_owner} = await getNamedAccounts()
    const [, anotherUser] = await web3.eth.getAccounts()
    assertNonNullable(protocol_owner)
    assertNonNullable(anotherUser)

    const {uniqueIdentity, go} = await deployAllContracts(deployments)
    return {uniqueIdentity, go, owner: protocol_owner, anotherUser}
  })

  beforeEach(async () => {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;({uniqueIdentity, owner, anotherUser} = await setupTest())
    ethersUniqueIdentity = await toEthers<UniqueIdentity>(uniqueIdentity)
    signer = ethersUniqueIdentity.signer
    assertNonNullable(signer.provider, "Signer provider is null")
    network = await signer.provider.getNetwork()

    await uniqueIdentity.grantRole(OWNER_ROLE, owner, {from: owner})
    await uniqueIdentity.grantRole(SIGNER_ROLE, await signer.getAddress(), {from: owner})
  })

  describe("main", async () => {
    it("forwards signature headers to the KYC function", async () => {
      const fetchFunction: FetchKYCFunction = ({auth, chainId}) => {
        // No other headers should be present
        expect(auth).to.deep.equal({
          "x-goldfinch-address": anotherUser,
          "x-goldfinch-signature": "test_signature",
          "x-goldfinch-signature-block-num": "fake_block_number",
        })
        return fetchElligibleKycStatus({auth, chainId})
      }

      const auth = {
        "x-some-random-header": "test",
        "x-goldfinch-address": anotherUser,
        "x-goldfinch-signature": "test_signature",
        "x-goldfinch-signature-block-num": "fake_block_number",
      }

      // Run handler
      await expect(
        uniqueIdentitySigner.main({
          auth,
          signer,
          network,
          uniqueIdentity: ethersUniqueIdentity,
          fetchKYCStatus: fetchFunction,
        })
      ).to.be.fulfilled
    })

    describe("KYC is inelligible", async () => {
      describe("countryCode is US", async () => {
        beforeEach(() => {
          fetchKYCFunction = fetchStubbedKycStatus({
            status: "approved",
            countryCode: "US",
          })
        })

        it("throws an error", async () => {
          const auth = {
            "x-goldfinch-address": anotherUser,
            "x-goldfinch-signature": "test_signature",
            "x-goldfinch-signature-block-num": "fake_block_number",
          }

          await expect(
            uniqueIdentitySigner.main({
              auth,
              signer,
              network,
              uniqueIdentity: ethersUniqueIdentity,
              fetchKYCStatus: fetchKYCFunction,
            })
          ).to.be.rejectedWith(/Does not meet mint requirements/)
        })
      })

      describe("countryCode is empty", async () => {
        beforeEach(() => {
          fetchKYCFunction = fetchStubbedKycStatus({
            status: "approved",
            countryCode: "",
          })
        })

        it("throws an error", async () => {
          const auth = {
            "x-goldfinch-address": anotherUser,
            "x-goldfinch-signature": "test_signature",
            "x-goldfinch-signature-block-num": "fake_block_number",
          }

          await expect(
            uniqueIdentitySigner.main({
              auth,
              signer,
              network,
              uniqueIdentity: ethersUniqueIdentity,
              fetchKYCStatus: fetchKYCFunction,
            })
          ).to.be.rejectedWith(/Does not meet mint requirements/)
        })
      })

      describe("KYC is not approved", async () => {
        beforeEach(() => {
          fetchKYCFunction = fetchStubbedKycStatus({
            status: "failed",
            countryCode: "CA",
          })
        })

        it("throws an error", async () => {
          const auth = {
            "x-goldfinch-address": anotherUser,
            "x-goldfinch-signature": "test_signature",
            "x-goldfinch-signature-block-num": "fake_block_number",
          }

          await expect(
            uniqueIdentitySigner.main({
              auth,
              signer,
              network,
              uniqueIdentity: ethersUniqueIdentity,
              fetchKYCStatus: fetchKYCFunction,
            })
          ).to.be.rejectedWith(/Does not meet mint requirements/)
        })
      })
    })

    describe("KYC is elligible", async () => {
      beforeEach(() => {
        fetchKYCFunction = fetchElligibleKycStatus
      })

      it("returns a signature that can be used to mint", async () => {
        const auth = {
          "x-goldfinch-address": anotherUser,
          "x-goldfinch-signature": "test_signature",
          "x-goldfinch-signature-block-num": "fake_block_number",
        }
        await uniqueIdentity.setSupportedUIDTypes([0], [true])

        let result = await uniqueIdentitySigner.main({
          auth,
          signer,
          network,
          uniqueIdentity: ethersUniqueIdentity,
          fetchKYCStatus: fetchKYCFunction,
        })

        await uniqueIdentity.mint(0, result.expiresAt, result.signature, {
          from: anotherUser,
          value: web3.utils.toWei("0.00083"),
        })
        expect(await uniqueIdentity.balanceOf(anotherUser, 0)).to.bignumber.eq(new BN(1))

        // Indirectly test that the nonce is correctly used, thereby allowing the burn to succeed
        result = await uniqueIdentitySigner.main({
          auth,
          signer,
          network,
          uniqueIdentity: ethersUniqueIdentity,
          fetchKYCStatus: fetchKYCFunction,
        })

        await uniqueIdentity.burn(anotherUser, 0, result.expiresAt, result.signature, {from: anotherUser})
        expect(await uniqueIdentity.balanceOf(anotherUser, 0)).to.bignumber.eq(new BN(0))
      }).timeout(TEST_TIMEOUT)
    })
  })
})
