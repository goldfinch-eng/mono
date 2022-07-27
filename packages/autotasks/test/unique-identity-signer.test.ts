import chai from "chai"
import hre from "hardhat"
import sinon from "sinon"
import AsPromised from "chai-as-promised"
chai.use(AsPromised)

import {getProtocolOwner, OWNER_ROLE, SIGNER_ROLE} from "@goldfinch-eng/protocol/blockchain_scripts/deployHelpers"
import {ethers, Signer} from "ethers"
import {hardhat} from "@goldfinch-eng/protocol"
import {BN, deployAllContracts} from "@goldfinch-eng/protocol/test/testHelpers"
import * as utils from "@goldfinch-eng/utils"
const {deployments, web3} = hardhat
import * as uniqueIdentitySigner from "../unique-identity-signer"
import {assertNonNullable} from "packages/utils/src/type"
import {TestUniqueIdentityInstance} from "packages/protocol/typechain/truffle"
import {UniqueIdentity} from "packages/protocol/typechain/ethers"
import {UniqueIdentityAbi} from "../unique-identity-signer"

const TEST_TIMEOUT = 30000

function fetchStubbedKycStatus(kyc: utils.KYC): utils.FetchKYCFunction {
  return async (_) => {
    return Promise.resolve(kyc)
  }
}

const fetchElligibleKycStatus: utils.FetchKYCFunction = fetchStubbedKycStatus({
  status: "approved",
  countryCode: "CA",
  residency: "non-us",
})

describe("unique-identity-signer", () => {
  let owner: string
  let anotherUser: string
  let uniqueIdentity: TestUniqueIdentityInstance
  let ethersUniqueIdentity: UniqueIdentity
  let signer: Signer
  let network: ethers.providers.Network
  let fetchKYCFunction: utils.FetchKYCFunction
  const sandbox = sinon.createSandbox()

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
    signer = hre.ethers.provider.getSigner(await getProtocolOwner())
    ethersUniqueIdentity = new ethers.Contract(uniqueIdentity.address, UniqueIdentityAbi, signer) as UniqueIdentity
    assertNonNullable(signer.provider, "Signer provider is null")
    network = await signer.provider.getNetwork()

    await uniqueIdentity.grantRole(OWNER_ROLE, owner, {from: owner})
    await uniqueIdentity.grantRole(SIGNER_ROLE, await signer.getAddress(), {from: owner})
  })

  afterEach(() => {
    sandbox.restore()
  })

  describe("main", () => {
    it("forwards signature headers to the KYC function", async () => {
      const fetchFunction: utils.FetchKYCFunction = ({auth, chainId}) => {
        // No other headers should be present
        expect(auth).to.deep.equal({
          "x-goldfinch-address": anotherUser,
          "x-goldfinch-signature": "test_signature",
          "x-goldfinch-signature-plaintext": "plaintext",
          "x-goldfinch-signature-block-num": "fake_block_number",
        })
        return fetchElligibleKycStatus({auth, chainId})
      }

      const auth = {
        "x-some-random-header": "test",
        "x-goldfinch-address": anotherUser,
        "x-goldfinch-signature": "test_signature",
        "x-goldfinch-signature-plaintext": "plaintext",
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

    describe("auth headers", () => {
      let auth
      beforeEach(() => {
        auth = {
          "x-goldfinch-address": anotherUser,
          "x-goldfinch-signature": "test_signature",
          "x-goldfinch-signature-plaintext": "plaintext",
          "x-goldfinch-signature-block-num": "fake_block_number",
        }
      })

      describe("missing x-goldfinch-signature", () => {
        it("throws an error", async () => {
          delete auth["x-goldfinch-signature"]
          await expect(
            uniqueIdentitySigner.main({
              auth,
              signer,
              network,
              uniqueIdentity: ethersUniqueIdentity,
              fetchKYCStatus: fetchKYCFunction,
            })
          ).to.be.rejectedWith(/auth does not conform/)
        })
      })

      describe("missing x-goldfinch-signature-block-num", () => {
        it("throws an error", async () => {
          delete auth["x-goldfinch-signature-block-num"]
          await expect(
            uniqueIdentitySigner.main({
              auth,
              signer,
              network,
              uniqueIdentity: ethersUniqueIdentity,
              fetchKYCStatus: fetchKYCFunction,
            })
          ).to.be.rejectedWith(/auth does not conform/)
        })
      })

      describe("missing x-goldfinch-address", () => {
        it("throws an error", async () => {
          delete auth["x-goldfinch-address"]
          await expect(
            uniqueIdentitySigner.main({
              auth,
              signer,
              network,
              uniqueIdentity: ethersUniqueIdentity,
              fetchKYCStatus: fetchKYCFunction,
            })
          ).to.be.rejectedWith(/auth does not conform/)
        })
      })

      describe("missing x-goldfinch-signature-plaintext", () => {
        it("throws an error", async () => {
          delete auth["x-goldfinch-signature-plaintext"]
          await expect(
            uniqueIdentitySigner.main({
              auth,
              signer,
              network,
              uniqueIdentity: ethersUniqueIdentity,
              fetchKYCStatus: fetchKYCFunction,
            })
          ).to.be.rejectedWith(/auth does not conform/)
        })
      })
    })

    describe("KYC is inelligible", () => {
      describe("countryCode is empty", () => {
        beforeEach(() => {
          fetchKYCFunction = fetchStubbedKycStatus({
            status: "approved",
            countryCode: "",
            residency: "us",
          })
        })

        it("throws an error", async () => {
          const auth = {
            "x-goldfinch-address": anotherUser,
            "x-goldfinch-signature": "test_signature",
            "x-goldfinch-signature-plaintext": "plaintext",
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
          ).to.be.rejectedWith(/Does not meet mint requirements: countryCode/)
        })
      })

      describe("KYC is not approved", () => {
        beforeEach(() => {
          fetchKYCFunction = fetchStubbedKycStatus({
            status: "failed",
            countryCode: "CA",
            residency: "non-us",
          })
        })

        it("throws an error", async () => {
          const auth = {
            "x-goldfinch-address": anotherUser,
            "x-goldfinch-signature": "test_signature",
            "x-goldfinch-signature-plaintext": "plaintext",
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
          ).to.be.rejectedWith(/Does not meet mint requirements: status/)
        })
      })

      describe("residency is missing", () => {
        beforeEach(() => {
          fetchKYCFunction = fetchStubbedKycStatus({
            status: "approved",
            countryCode: "CA",
            residency: undefined,
          })
        })

        it("does not throw an error", async () => {
          const auth = {
            "x-goldfinch-address": anotherUser,
            "x-goldfinch-signature": "test_signature",
            "x-goldfinch-signature-plaintext": "plaintext",
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
          ).to.be.fulfilled
        })
      })
    })

    describe("KYC is elligible", () => {
      describe("countryCode is US", () => {
        beforeEach(() => {
          fetchKYCFunction = fetchStubbedKycStatus({
            status: "approved",
            countryCode: "US",
            residency: "us",
          })
        })

        describe("non accredited investor", () => {
          it("returns a signature that can be used to mint", async () => {
            const nonUSIdType = await uniqueIdentity.ID_TYPE_0()
            const usAccreditedIdType = await uniqueIdentity.ID_TYPE_1()
            const usNonAccreditedIdType = await uniqueIdentity.ID_TYPE_2()
            const auth = {
              "x-goldfinch-address": anotherUser,
              "x-goldfinch-signature": "test_signature",
              "x-goldfinch-signature-plaintext": "plaintext",
              "x-goldfinch-signature-block-num": "fake_block_number",
            }
            await uniqueIdentity.setSupportedUIDTypes([usNonAccreditedIdType], [true])

            let result = await uniqueIdentitySigner.main({
              auth,
              signer,
              network,
              uniqueIdentity: ethersUniqueIdentity,
              fetchKYCStatus: fetchKYCFunction,
            })

            // mint non-accredited investor
            await uniqueIdentity.mint(usNonAccreditedIdType, result.expiresAt, result.signature, {
              from: anotherUser,
              value: web3.utils.toWei("0.00083"),
            })
            expect(await uniqueIdentity.balanceOf(anotherUser, nonUSIdType)).to.bignumber.eq(new BN(0))
            expect(await uniqueIdentity.balanceOf(anotherUser, usAccreditedIdType)).to.bignumber.eq(new BN(0))
            expect(await uniqueIdentity.balanceOf(anotherUser, usNonAccreditedIdType)).to.bignumber.eq(new BN(1))

            // Indirectly test that the nonce is correctly used, thereby allowing the burn to succeed
            result = await uniqueIdentitySigner.main({
              auth,
              signer,
              network,
              uniqueIdentity: ethersUniqueIdentity,
              fetchKYCStatus: fetchKYCFunction,
            })

            await uniqueIdentity.burn(anotherUser, usNonAccreditedIdType, result.expiresAt, result.signature, {
              from: anotherUser,
            })
            expect(await uniqueIdentity.balanceOf(anotherUser, nonUSIdType)).to.bignumber.eq(new BN(0))
            expect(await uniqueIdentity.balanceOf(anotherUser, usAccreditedIdType)).to.bignumber.eq(new BN(0))
            expect(await uniqueIdentity.balanceOf(anotherUser, usNonAccreditedIdType)).to.bignumber.eq(new BN(0))
          }).timeout(TEST_TIMEOUT)
        })

        describe("US accredited investor", () => {
          it("returns a signature that can be used to mint", async () => {
            const nonUSIdType = await uniqueIdentity.ID_TYPE_0()
            const usAccreditedIdType = await uniqueIdentity.ID_TYPE_1()
            const usNonAccreditedIdType = await uniqueIdentity.ID_TYPE_2()
            // stub as accredited investor
            const getIDType = () => usAccreditedIdType.toNumber()
            const auth = {
              "x-goldfinch-address": anotherUser,
              "x-goldfinch-signature": "test_signature",
              "x-goldfinch-signature-plaintext": "plaintext",
              "x-goldfinch-signature-block-num": "fake_block_number",
            }
            await uniqueIdentity.setSupportedUIDTypes([usAccreditedIdType], [true])

            let result = await uniqueIdentitySigner.main({
              auth,
              signer,
              network,
              uniqueIdentity: ethersUniqueIdentity,
              fetchKYCStatus: fetchKYCFunction,
              getIDType,
            })

            // mint accredited investor
            await uniqueIdentity.mint(usAccreditedIdType, result.expiresAt, result.signature, {
              from: anotherUser,
              value: web3.utils.toWei("0.00083"),
            })
            expect(await uniqueIdentity.balanceOf(anotherUser, nonUSIdType)).to.bignumber.eq(new BN(0))
            expect(await uniqueIdentity.balanceOf(anotherUser, usAccreditedIdType)).to.bignumber.eq(new BN(1))
            expect(await uniqueIdentity.balanceOf(anotherUser, usNonAccreditedIdType)).to.bignumber.eq(new BN(0))

            // Indirectly test that the nonce is correctly used, thereby allowing the burn to succeed
            result = await uniqueIdentitySigner.main({
              auth,
              signer,
              network,
              uniqueIdentity: ethersUniqueIdentity,
              fetchKYCStatus: fetchKYCFunction,
              getIDType,
            })

            await uniqueIdentity.burn(anotherUser, usAccreditedIdType, result.expiresAt, result.signature, {
              from: anotherUser,
            })
            expect(await uniqueIdentity.balanceOf(anotherUser, nonUSIdType)).to.bignumber.eq(new BN(0))
            expect(await uniqueIdentity.balanceOf(anotherUser, usAccreditedIdType)).to.bignumber.eq(new BN(0))
            expect(await uniqueIdentity.balanceOf(anotherUser, usNonAccreditedIdType)).to.bignumber.eq(new BN(0))
          }).timeout(TEST_TIMEOUT)
        })
      })

      describe("countryCode is non US", () => {
        beforeEach(() => {
          fetchKYCFunction = fetchElligibleKycStatus
        })

        it("returns a signature that can be used to mint", async () => {
          const auth = {
            "x-goldfinch-address": anotherUser,
            "x-goldfinch-signature": "test_signature",
            "x-goldfinch-signature-plaintext": "plaintext",
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
          expect(await uniqueIdentity.balanceOf(anotherUser, 1)).to.bignumber.eq(new BN(0))
          expect(await uniqueIdentity.balanceOf(anotherUser, 2)).to.bignumber.eq(new BN(0))

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
          expect(await uniqueIdentity.balanceOf(anotherUser, 1)).to.bignumber.eq(new BN(0))
          expect(await uniqueIdentity.balanceOf(anotherUser, 2)).to.bignumber.eq(new BN(0))
        }).timeout(TEST_TIMEOUT)
      })
    })
  })

  describe("caseInsensitiveIncludes", () => {
    it("case insensitively matches an array element", () => {
      const data = [
        "0x11Cb600E4740C052855B942dC13648d7dF1503E5",
        "0x7Fb2EdA1a56BAEC8a5f1764948D3B1de03059950",
        "0x47BdbA50F035bAF1Bd9A41Da3cD7fc6bc198049f",
        "0xD98a107A56c2DE8aFD8416a5AeF3Fb63Ea277B07",
        "0xdCA313c4Df33c2142B2aDf202D6AbF4Fa56e1d41",
        "0x55d601F005ae4984314951F9219D097d91EedCae",
        "0x111B46bFAe308Be4570Cb9F17d051B58022D7c89",
        "0X8F40DCD6BA523561A8A497001896330965520FA4",
      ]

      const testAddress = "0X8F40DCD6ba523561a8a497001896330965520FA4"
      const testAddressLowerCase = testAddress.toLowerCase()
      const testAddressUppwerCase = testAddress.toUpperCase()
      const notInTheArray = "0X8F40DCD6ba523561a8a497001896330965520000"

      expect(utils.caseInsensitiveIncludes(data, testAddress)).to.be.true
      expect(utils.caseInsensitiveIncludes(data, testAddressLowerCase)).to.be.true
      expect(utils.caseInsensitiveIncludes(data, testAddressUppwerCase)).to.be.true
      expect(utils.caseInsensitiveIncludes(data, notInTheArray)).to.be.false
    })
  })

  describe("eligible json files", () => {
    it("checks for duplicates", () => {
      const data = [utils.USAccreditedIndividualsList, utils.USAccreditedEntitiesList, utils.NonUSEntitiesList]
      data.reduce((acc, curr) => {
        if (acc.some((x) => curr.includes(x))) {
          throw new Error("Array intersection")
        }
        return [...acc, ...curr]
      })
      return true
    })
  })
})
