import chai from "chai"
import hre from "hardhat"
import sinon from "sinon"
import AsPromised from "chai-as-promised"
import _ from "lodash"
chai.use(AsPromised)

import {getProtocolOwner, OWNER_ROLE, SIGNER_ROLE} from "@goldfinch-eng/protocol/blockchain_scripts/deployHelpers"
import {ethers, Signer, Wallet} from "ethers"
import {hardhat} from "@goldfinch-eng/protocol"
import {deployAllContracts} from "@goldfinch-eng/protocol/test/testHelpers"
import {assertNonNullable} from "@goldfinch-eng/utils"

const {deployments, web3} = hardhat
import {KycStatusResponse} from "@goldfinch-eng/functions/handlers/kycStatus"
import {main, FetchKYCFunction} from "../../unique-identity-signer"
import {TestUniqueIdentityInstance} from "packages/protocol/typechain/truffle"
import {UniqueIdentity} from "packages/protocol/typechain/ethers"
import {UNIQUE_IDENTITY_ABI} from "../../unique-identity-signer"
import axios from "axios"

function fetchStubbedKycStatus(kyc: KycStatusResponse): FetchKYCFunction {
  return async (_) => {
    return Promise.resolve(kyc)
  }
}

// Mock response for an approved individual
const APPROVED_KYC_STATUS_RESPONSE_INDIVIDUAL: KycStatusResponse = {
  address: "0xc34461018f970d343d5a25e4Ed28C4ddE6dcCc3F",
  status: "approved",
  countryCode: "CA",
  residency: "non-us",
  kycProvider: "parallelMarkets",
  type: "individual",
  identityStatus: "approved",
  accreditationStatus: "approved",
}

// Mock response for a failed individual
const FAILED_KYC_STATUS_RESPONSE_INDIVIDUAL: KycStatusResponse = {
  ...APPROVED_KYC_STATUS_RESPONSE_INDIVIDUAL,
  status: "failed",
  identityStatus: "approved",
  accreditationStatus: "failed",
}

// Mock response for an approved business
const APPROVED_KYC_STATUS_RESPONSE_BUSINESS: KycStatusResponse = {
  address: "0xc34461018f970d343d5a25e4Ed28C4ddE6dcCc3F",
  status: "approved",
  countryCode: "CA",
  residency: "non-us",
  kycProvider: "parallelMarkets",
  type: "business",
  identityStatus: "approved",
  accreditationStatus: "approved",
}

// Mock response for a failed business
const FAILED_KYC_STATUS_RESPONSE_BUSINESS: KycStatusResponse = {
  ...APPROVED_KYC_STATUS_RESPONSE_BUSINESS,
  status: "failed",
  identityStatus: "failed",
  accreditationStatus: "approved",
}

const TEST_ACCOUNT = {
  address: "0xc34461018f970d343d5a25e4Ed28C4ddE6dcCc3F",
  privateKey: "0x50f9c471e3c454b506f39536c06bde77233144784297a95d35896b3be3dfc9d8",
}

const setupTest = deployments.createFixture(async ({deployments, getNamedAccounts}) => {
  const {protocol_owner} = await getNamedAccounts()
  const [, anotherUser, anotherUser2] = await web3.eth.getAccounts()
  assertNonNullable(protocol_owner)
  assertNonNullable(anotherUser)
  assertNonNullable(anotherUser2)

  const {uniqueIdentity, go} = await deployAllContracts(deployments)
  return {uniqueIdentity, go, owner: protocol_owner, anotherUser, anotherUser2}
})

describe("unique-identity-signer parallel markets", () => {
  let owner: string
  let anotherUser: string
  let uniqueIdentity: TestUniqueIdentityInstance
  let ethersUniqueIdentity: UniqueIdentity
  let signer: Signer
  let anotherUserSigner: Signer
  let network: ethers.providers.Network
  let validAuthAnotherUser
  let latestBlockNum: number
  let wallet
  const sandbox = sinon.createSandbox()

  beforeEach(async () => {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;({uniqueIdentity, owner, anotherUser} = await setupTest())
    signer = hre.ethers.provider.getSigner(await getProtocolOwner())
    anotherUserSigner = hre.ethers.provider.getSigner(anotherUser)
    ethersUniqueIdentity = new ethers.Contract(uniqueIdentity.address, UNIQUE_IDENTITY_ABI, signer) as UniqueIdentity
    assertNonNullable(signer.provider, "Signer provider is null")
    network = await signer.provider.getNetwork()

    await uniqueIdentity.grantRole(OWNER_ROLE, owner, {from: owner})
    await uniqueIdentity.grantRole(SIGNER_ROLE, await signer.getAddress(), {from: owner})
    sandbox.stub(axios, "post").resolves({status: 200})

    wallet = new Wallet(TEST_ACCOUNT.privateKey)
    latestBlockNum = (await signer.provider?.getBlock("latest"))?.number as number
    const currentBlock = await signer.provider?.getBlock(latestBlockNum)
    assertNonNullable(currentBlock)
    validAuthAnotherUser = {
      "x-goldfinch-address": anotherUser,
      "x-goldfinch-signature": await anotherUserSigner.signMessage(`Sign in to Goldfinch: ${latestBlockNum}`),
      "x-goldfinch-signature-plaintext": await wallet.signMessage(`Sign in to Goldfinch: ${latestBlockNum}`),
      "x-goldfinch-signature-block-num": latestBlockNum.toString(),
    }
  })

  afterEach(() => {
    sandbox.restore()
  })

  describe("KYC is ineligible", () => {
    describe("countryCode is null", () => {
      it("throws an error", async () => {
        const auth = {
          "x-goldfinch-address": TEST_ACCOUNT.address,
          "x-goldfinch-signature": await wallet.signMessage(`Sign in to Goldfinch: ${latestBlockNum}`),
          "x-goldfinch-signature-block-num": latestBlockNum.toString(),
          "x-goldfinch-signature-plaintext": `Sign in to Goldfinch: ${latestBlockNum}`,
        }

        await expect(
          main({
            auth,
            signer,
            network,
            uniqueIdentity: ethersUniqueIdentity,
            fetchKYCStatus: fetchStubbedKycStatus({
              ...APPROVED_KYC_STATUS_RESPONSE_INDIVIDUAL,
              countryCode: null,
            }),
          })
        ).to.be.rejectedWith(/Does not meet mint requirements: missing countryCode/)
      })
    })

    describe("countryCode is empty", () => {
      it("throws an error", async () => {
        const auth = {
          "x-goldfinch-address": TEST_ACCOUNT.address,
          "x-goldfinch-signature": await wallet.signMessage(`Sign in to Goldfinch: ${latestBlockNum}`),
          "x-goldfinch-signature-block-num": latestBlockNum.toString(),
          "x-goldfinch-signature-plaintext": `Sign in to Goldfinch: ${latestBlockNum}`,
        }

        await expect(
          main({
            auth,
            signer,
            network,
            uniqueIdentity: ethersUniqueIdentity,
            fetchKYCStatus: fetchStubbedKycStatus({
              ...APPROVED_KYC_STATUS_RESPONSE_INDIVIDUAL,
              countryCode: "",
            }),
          })
        ).to.be.rejectedWith(/Does not meet mint requirements: missing countryCode/)
      })
    })

    describe("KYC is not approved", () => {
      describe("individual", () => {
        it("throws an error", async () => {
          const auth = {
            "x-goldfinch-address": TEST_ACCOUNT.address,
            "x-goldfinch-signature": await wallet.signMessage(`Sign in to Goldfinch: ${latestBlockNum}`),
            "x-goldfinch-signature-block-num": latestBlockNum.toString(),
            "x-goldfinch-signature-plaintext": `Sign in to Goldfinch: ${latestBlockNum}`,
          }

          await expect(
            main({
              auth,
              signer,
              network,
              uniqueIdentity: ethersUniqueIdentity,
              fetchKYCStatus: fetchStubbedKycStatus(FAILED_KYC_STATUS_RESPONSE_INDIVIDUAL),
            })
          ).to.be.rejectedWith(/Does not meet mint requirements: status/)
        })
      })

      describe("business", () => {
        it("throws an error", async () => {
          const auth = {
            "x-goldfinch-address": TEST_ACCOUNT.address,
            "x-goldfinch-signature": await wallet.signMessage(`Sign in to Goldfinch: ${latestBlockNum}`),
            "x-goldfinch-signature-block-num": latestBlockNum.toString(),
            "x-goldfinch-signature-plaintext": `Sign in to Goldfinch: ${latestBlockNum}`,
          }

          await expect(
            main({
              auth,
              signer,
              network,
              uniqueIdentity: ethersUniqueIdentity,
              fetchKYCStatus: fetchStubbedKycStatus(FAILED_KYC_STATUS_RESPONSE_BUSINESS),
            })
          ).to.be.rejectedWith(/Does not meet mint requirements: status/)
        })
      })
    })

    describe("residency is missing", () => {
      it("does not throw an error", async () => {
        const auth = {
          "x-goldfinch-address": TEST_ACCOUNT.address,
          "x-goldfinch-signature": await wallet.signMessage(`Sign in to Goldfinch: ${latestBlockNum}`),
          "x-goldfinch-signature-plaintext": `Sign in to Goldfinch: ${latestBlockNum}`,
          "x-goldfinch-signature-block-num": latestBlockNum.toString(),
        }

        await expect(
          main({
            auth,
            signer,
            network,
            uniqueIdentity: ethersUniqueIdentity,
            fetchKYCStatus: fetchStubbedKycStatus({
              ...APPROVED_KYC_STATUS_RESPONSE_INDIVIDUAL,
              residency: null,
            }),
          })
        ).to.be.fulfilled
      })
    })
  })

  describe("KYC is eligible", () => {
    it("throws an error if linking their KYC to their recipient fails", async () => {
      sandbox.restore()
      sandbox.stub(axios, "post").throws({response: {status: 500, data: "Link kyc failed"}})

      await uniqueIdentity.setSupportedUIDTypes(["1"], [true])
      const kycStatusResponse = _.cloneDeep(APPROVED_KYC_STATUS_RESPONSE_INDIVIDUAL)
      kycStatusResponse.countryCode = "US"

      await expect(
        main({
          auth: validAuthAnotherUser,
          signer,
          network,
          uniqueIdentity: ethersUniqueIdentity,
          fetchKYCStatus: fetchStubbedKycStatus(kycStatusResponse),
        })
      ).to.eventually.be.rejectedWith('Error in request to /linkUserToUid.\nstatus: 500\ndata: "Link kyc failed"')
    })

    it("returns valid sig for us accredited individual", async () => {
      await uniqueIdentity.setSupportedUIDTypes(["1"], [true])

      const kycStatusResponse = _.cloneDeep(APPROVED_KYC_STATUS_RESPONSE_INDIVIDUAL)
      kycStatusResponse.countryCode = "US"

      const result = await main({
        auth: validAuthAnotherUser,
        signer,
        network,
        uniqueIdentity: ethersUniqueIdentity,
        fetchKYCStatus: fetchStubbedKycStatus(kycStatusResponse),
      })

      // Mint US-Accredited UID
      await expect(
        uniqueIdentity.mint("1", result.expiresAt, result.signature, {
          from: anotherUser,
          value: await uniqueIdentity.MINT_COST_PER_TOKEN(),
        })
      ).to.be.fulfilled
    })

    it("returns a valid sig for us accredited legacy individual", async () => {
      await uniqueIdentity.setSupportedUIDTypes(["1"], [true])
      const kycStatusResponse = _.cloneDeep(APPROVED_KYC_STATUS_RESPONSE_INDIVIDUAL)
      kycStatusResponse.countryCode = "US"
      kycStatusResponse.accreditationStatus = "legacy"
      kycStatusResponse.identityStatus = "legacy"

      const result = await main({
        auth: validAuthAnotherUser,
        signer,
        network,
        uniqueIdentity: ethersUniqueIdentity,
        fetchKYCStatus: fetchStubbedKycStatus(kycStatusResponse),
      })

      // Mint US-Accredited UID
      await expect(
        uniqueIdentity.mint("1", result.expiresAt, result.signature, {
          from: anotherUser,
          value: await uniqueIdentity.MINT_COST_PER_TOKEN(),
        })
      ).to.be.fulfilled
    })

    it("returns valid sig for us non-accredited individual", async () => {
      await uniqueIdentity.setSupportedUIDTypes(["2"], [true])

      const kycStatusResponse = _.cloneDeep(APPROVED_KYC_STATUS_RESPONSE_INDIVIDUAL)
      kycStatusResponse.countryCode = "US"
      kycStatusResponse.accreditationStatus = "unaccredited"

      const result = await main({
        auth: validAuthAnotherUser,
        signer,
        network,
        uniqueIdentity: ethersUniqueIdentity,
        fetchKYCStatus: fetchStubbedKycStatus(kycStatusResponse),
      })

      // Mint US-Accredited UID
      await expect(
        uniqueIdentity.mint("2", result.expiresAt, result.signature, {
          from: anotherUser,
          value: await uniqueIdentity.MINT_COST_PER_TOKEN(),
        })
      ).to.be.fulfilled
    })

    it("returns valid sig for us accredited business", async () => {
      await uniqueIdentity.setSupportedUIDTypes(["3"], [true])

      const kycStatusResponse = _.cloneDeep(APPROVED_KYC_STATUS_RESPONSE_BUSINESS)
      kycStatusResponse.countryCode = "US"
      kycStatusResponse.accreditationStatus = "approved"

      const result = await main({
        auth: validAuthAnotherUser,
        signer,
        network,
        uniqueIdentity: ethersUniqueIdentity,
        fetchKYCStatus: fetchStubbedKycStatus(kycStatusResponse),
      })

      // Mint US-Accredited UID
      await expect(
        uniqueIdentity.mint("3", result.expiresAt, result.signature, {
          from: anotherUser,
          value: await uniqueIdentity.MINT_COST_PER_TOKEN(),
        })
      ).to.be.fulfilled
    })

    it("returns a valid sig for legacy us accredited bussines", async () => {
      await uniqueIdentity.setSupportedUIDTypes(["3"], [true])

      const kycStatusResponse = _.cloneDeep(APPROVED_KYC_STATUS_RESPONSE_BUSINESS)
      kycStatusResponse.countryCode = "US"
      kycStatusResponse.accreditationStatus = "legacy"
      kycStatusResponse.identityStatus = "legacy"

      const result = await main({
        auth: validAuthAnotherUser,
        signer,
        network,
        uniqueIdentity: ethersUniqueIdentity,
        fetchKYCStatus: fetchStubbedKycStatus(kycStatusResponse),
      })

      // Mint US-Accredited UID
      await expect(
        uniqueIdentity.mint("3", result.expiresAt, result.signature, {
          from: anotherUser,
          value: await uniqueIdentity.MINT_COST_PER_TOKEN(),
        })
      ).to.be.fulfilled
    })

    it("reverts for us non-accredited business", async () => {
      const kycStatusResponse = _.cloneDeep(APPROVED_KYC_STATUS_RESPONSE_BUSINESS)
      kycStatusResponse.countryCode = "US"
      kycStatusResponse.accreditationStatus = "unaccredited"

      await expect(
        main({
          auth: validAuthAnotherUser,
          signer,
          network,
          uniqueIdentity: ethersUniqueIdentity,
          fetchKYCStatus: fetchStubbedKycStatus(kycStatusResponse),
        })
      ).to.be.rejectedWith(`Non-accredited US businesses are not eligible for UID`)
    })
    it("returns valid sig for non-us accredited business", async () => {
      await uniqueIdentity.setSupportedUIDTypes(["4"], [true])

      const kycStatusResponse = _.cloneDeep(APPROVED_KYC_STATUS_RESPONSE_BUSINESS)

      const result = await main({
        auth: validAuthAnotherUser,
        signer,
        network,
        uniqueIdentity: ethersUniqueIdentity,
        fetchKYCStatus: fetchStubbedKycStatus(kycStatusResponse),
      })

      await expect(
        uniqueIdentity.mint("4", result.expiresAt, result.signature, {
          from: anotherUser,
          value: await uniqueIdentity.MINT_COST_PER_TOKEN(),
        })
      ).to.be.fulfilled
    })
    it("returns valid sig for non-us non-accredited business", async () => {
      await uniqueIdentity.setSupportedUIDTypes(["4"], [true])

      const kycStatusResponse = _.cloneDeep(APPROVED_KYC_STATUS_RESPONSE_BUSINESS)
      kycStatusResponse.accreditationStatus = "unaccredited"

      const result = await main({
        auth: validAuthAnotherUser,
        signer,
        network,
        uniqueIdentity: ethersUniqueIdentity,
        fetchKYCStatus: fetchStubbedKycStatus(kycStatusResponse),
      })

      await expect(
        uniqueIdentity.mint("4", result.expiresAt, result.signature, {
          from: anotherUser,
          value: await uniqueIdentity.MINT_COST_PER_TOKEN(),
        })
      ).to.be.fulfilled
    })

    it("returns a valid sig for non-us legacy businesses", async () => {
      await uniqueIdentity.setSupportedUIDTypes(["4"], [true])

      const kycStatusResponse = _.cloneDeep(APPROVED_KYC_STATUS_RESPONSE_BUSINESS)
      kycStatusResponse.accreditationStatus = "legacy"
      kycStatusResponse.identityStatus = "legacy"

      const result = await main({
        auth: validAuthAnotherUser,
        signer,
        network,
        uniqueIdentity: ethersUniqueIdentity,
        fetchKYCStatus: fetchStubbedKycStatus(kycStatusResponse),
      })

      await expect(
        uniqueIdentity.mint("4", result.expiresAt, result.signature, {
          from: anotherUser,
          value: await uniqueIdentity.MINT_COST_PER_TOKEN(),
        })
      ).to.be.fulfilled
    })
  })
})
