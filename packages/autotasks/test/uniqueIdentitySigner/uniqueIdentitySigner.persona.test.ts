import chai from "chai"
import hre from "hardhat"
import sinon from "sinon"
import _ from "lodash"
import AsPromised from "chai-as-promised"
chai.use(AsPromised)

import {getProtocolOwner, OWNER_ROLE, SIGNER_ROLE} from "@goldfinch-eng/protocol/blockchain_scripts/deployHelpers"
import {ethers, Signer, Wallet} from "ethers"
import {hardhat} from "@goldfinch-eng/protocol"
import {BN, deployAllContracts} from "@goldfinch-eng/protocol/test/testHelpers"
import {assertNonNullable, presignedBurnMessage} from "@goldfinch-eng/utils"

const {deployments, web3} = hardhat
import {KycStatusResponse} from "@goldfinch-eng/functions/handlers/kycStatus"
import {main, FetchKYCFunction} from "../../unique-identity-signer"
import {TestUniqueIdentityInstance} from "packages/protocol/typechain/truffle"
import {UniqueIdentity} from "packages/protocol/typechain/ethers"
import {UNIQUE_IDENTITY_ABI} from "../../unique-identity-signer"
import axios from "axios"

const TEST_TIMEOUT = 30000

function fetchStubbedKycStatus(kyc: KycStatusResponse): FetchKYCFunction {
  return async (_) => {
    return Promise.resolve(kyc)
  }
}

const KYC_STATUS_RESPONSE: KycStatusResponse = {
  address: "0xc34461018f970d343d5a25e4Ed28C4ddE6dcCc3F",
  status: "approved",
  identityStatus: "approved",
  accreditationStatus: "unaccredited",
  countryCode: "CA",
  residency: "non-us",
  kycProvider: "persona",
  type: "individual",
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

describe("unique-identity-signer persona", () => {
  let owner: string
  let anotherUser: string
  let anotherUser2: string
  let uniqueIdentity: TestUniqueIdentityInstance
  let ethersUniqueIdentity: UniqueIdentity
  let signer: Signer
  let anotherUserSigner: Signer
  let network: ethers.providers.Network
  let validAuthAnotherUser
  let latestBlockNum: number
  let validExpiryTimestamp: number
  let wallet
  const sandbox = sinon.createSandbox()

  beforeEach(async () => {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;({uniqueIdentity, owner, anotherUser, anotherUser2} = await setupTest())
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
    validExpiryTimestamp = currentBlock.timestamp + 100000
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
    describe("countryCode is empty", () => {
      it("throws an error", async () => {
        const kycStatusResponse = _.cloneDeep(KYC_STATUS_RESPONSE)
        kycStatusResponse.countryCode = ""

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
            fetchKYCStatus: fetchStubbedKycStatus(kycStatusResponse),
          })
        ).to.be.rejectedWith(/Does not meet mint requirements: missing countryCode/)
      })
    })

    describe("KYC is not approved", () => {
      it("throws an error", async () => {
        const kycStatusResponse = _.cloneDeep(KYC_STATUS_RESPONSE)
        kycStatusResponse.status = "failed"

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
            fetchKYCStatus: fetchStubbedKycStatus(kycStatusResponse),
          })
        ).to.be.rejectedWith(/Does not meet mint requirements: status/)
      })
    })

    describe("residency is missing", () => {
      it("does not throw an error", async () => {
        const kycStatusResponse = _.cloneDeep(KYC_STATUS_RESPONSE)
        kycStatusResponse.residency = "null"

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
            fetchKYCStatus: fetchStubbedKycStatus(kycStatusResponse),
          })
        ).to.be.fulfilled
      })
    })
  })

  describe("KYC is eligible", () => {
    describe("countryCode is US", () => {
      const kycStatusResponse: KycStatusResponse = {
        ...KYC_STATUS_RESPONSE,
        countryCode: "US",
        residency: "us",
      }

      describe("non accredited investor", () => {
        it("returns a signature that can be used to mint", async () => {
          await uniqueIdentity.setSupportedUIDTypes(["2"], [true])

          const result = await main({
            auth: validAuthAnotherUser,
            signer,
            network,
            uniqueIdentity: ethersUniqueIdentity,
            fetchKYCStatus: fetchStubbedKycStatus(kycStatusResponse),
          })

          // mint non-accredited investor
          await uniqueIdentity.mint("2", result.expiresAt, result.signature, {
            from: anotherUser,
            value: await uniqueIdentity.MINT_COST_PER_TOKEN(),
          })

          expect(await uniqueIdentity.balanceOf(anotherUser, "2")).to.bignumber.eq(new BN(1))

          // Indirectly test that the nonce is correctly used, thereby allowing the burn to succeed

          const burnPresigMessage = presignedBurnMessage(
            anotherUser,
            2,
            validExpiryTimestamp,
            uniqueIdentity.address,
            1,
            network.chainId
          )
          const burnSig = await signer.signMessage(burnPresigMessage)

          await uniqueIdentity.burn(anotherUser, "2", validExpiryTimestamp, burnSig, {
            from: anotherUser,
          })
          expect(await uniqueIdentity.balanceOf(anotherUser, "2")).to.bignumber.eq(new BN(0))
        }).timeout(TEST_TIMEOUT)

        it("returns a signature that can be used to mintTo", async () => {
          await uniqueIdentity.setSupportedUIDTypes(["2"], [true])

          const result = await main({
            auth: validAuthAnotherUser,
            signer,
            network,
            mintToAddress: anotherUser2,
            uniqueIdentity: ethersUniqueIdentity,
            fetchKYCStatus: fetchStubbedKycStatus(kycStatusResponse),
          })

          // mint non-accredited investor
          await uniqueIdentity.mintTo(anotherUser2, "2", result.expiresAt, result.signature, {
            from: anotherUser,
            value: await uniqueIdentity.MINT_COST_PER_TOKEN(),
          })

          expect(await uniqueIdentity.balanceOf(anotherUser2, "2")).to.bignumber.eq(new BN(1))
        }).timeout(TEST_TIMEOUT)

        it("throws an error if linking their KYC to their recipient fails", async () => {
          sandbox.restore()
          sandbox.stub(axios, "post").throws({response: {status: 500, data: "Link kyc failed"}})
          await expect(
            main({
              auth: validAuthAnotherUser,
              signer,
              network,
              uniqueIdentity: ethersUniqueIdentity,
              mintToAddress: anotherUser2,
              fetchKYCStatus: fetchStubbedKycStatus(kycStatusResponse),
            })
          ).to.eventually.be.rejectedWith('Error in request to /linkUserToUid.\nstatus: 500\ndata: "Link kyc failed"')
        })
      })
    })

    describe("countryCode is non US", () => {
      it("returns a signature that can be used to mint", async () => {
        await uniqueIdentity.setSupportedUIDTypes([0], [true])

        const result = await main({
          auth: validAuthAnotherUser,
          signer,
          network,
          uniqueIdentity: ethersUniqueIdentity,
          fetchKYCStatus: fetchStubbedKycStatus(KYC_STATUS_RESPONSE),
        })

        await uniqueIdentity.mint(0, result.expiresAt, result.signature, {
          from: anotherUser,
          value: await uniqueIdentity.MINT_COST_PER_TOKEN(),
        })
        expect(await uniqueIdentity.balanceOf(anotherUser, 0)).to.bignumber.eq(new BN(1))
        expect(await uniqueIdentity.balanceOf(anotherUser, 1)).to.bignumber.eq(new BN(0))
        expect(await uniqueIdentity.balanceOf(anotherUser, 2)).to.bignumber.eq(new BN(0))

        // Indirectly test that the nonce is correctly used, thereby allowing the burn to succeed
        const burnPresigMessage = presignedBurnMessage(
          anotherUser,
          0,
          validExpiryTimestamp,
          uniqueIdentity.address,
          1,
          network.chainId
        )
        const burnSig = await signer.signMessage(burnPresigMessage)

        await uniqueIdentity.burn(anotherUser, 0, validExpiryTimestamp, burnSig, {from: anotherUser})
        expect(await uniqueIdentity.balanceOf(anotherUser, 0)).to.bignumber.eq(new BN(0))
        expect(await uniqueIdentity.balanceOf(anotherUser, 1)).to.bignumber.eq(new BN(0))
        expect(await uniqueIdentity.balanceOf(anotherUser, 2)).to.bignumber.eq(new BN(0))
      }).timeout(TEST_TIMEOUT)

      it("returns a signature that can be used to mintTo", async () => {
        const auth = {
          "x-goldfinch-address": anotherUser,
          "x-goldfinch-signature": await anotherUserSigner.signMessage(`Sign in to Goldfinch: ${latestBlockNum}`),
          "x-goldfinch-signature-block-num": `${latestBlockNum}`,
          "x-goldfinch-signature-plaintext": `Sign in to Goldfinch: ${latestBlockNum}`,
        }
        await uniqueIdentity.setSupportedUIDTypes([0], [true])

        const result = await main({
          auth,
          signer,
          network,
          uniqueIdentity: ethersUniqueIdentity,
          mintToAddress: anotherUser2,
          fetchKYCStatus: fetchStubbedKycStatus(KYC_STATUS_RESPONSE),
        })

        await uniqueIdentity.mintTo(anotherUser2, 0, result.expiresAt, result.signature, {
          from: anotherUser,
          value: await uniqueIdentity.MINT_COST_PER_TOKEN(),
        })
        expect(await uniqueIdentity.balanceOf(anotherUser2, 0)).to.bignumber.eq(new BN(1))
        expect(await uniqueIdentity.balanceOf(anotherUser2, 1)).to.bignumber.eq(new BN(0))
        expect(await uniqueIdentity.balanceOf(anotherUser2, 2)).to.bignumber.eq(new BN(0))
      }).timeout(TEST_TIMEOUT)

      it("throws an error if linking their KYC to their recipient fails", async () => {
        sandbox.restore()
        sandbox.stub(axios, "post").throws({response: {status: 500, data: "Link kyc failed"}})
        await expect(
          main({
            auth: validAuthAnotherUser,
            signer,
            network,
            uniqueIdentity: ethersUniqueIdentity,
            mintToAddress: anotherUser2,
            fetchKYCStatus: fetchStubbedKycStatus(KYC_STATUS_RESPONSE),
          })
        ).to.eventually.be.rejectedWith('Error in request to /linkUserToUid.\nstatus: 500\ndata: "Link kyc failed"')
      })
    })
  })
})
