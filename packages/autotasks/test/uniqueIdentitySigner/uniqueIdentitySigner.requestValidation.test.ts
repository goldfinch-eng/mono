import chai from "chai"
import hre from "hardhat"
import sinon from "sinon"
import AsPromised from "chai-as-promised"
chai.use(AsPromised)

import {getProtocolOwner, OWNER_ROLE, SIGNER_ROLE} from "@goldfinch-eng/protocol/blockchain_scripts/deployHelpers"
import {ethers, Signer, Wallet} from "ethers"
import {hardhat} from "@goldfinch-eng/protocol"
import {deployAllContracts} from "@goldfinch-eng/protocol/test/testHelpers"
import {KycStatusResponse} from "@goldfinch-eng/functions/handlers/kycStatus"
import {assertNonNullable} from "@goldfinch-eng/utils"

const {deployments, web3} = hardhat
import * as uniqueIdentitySigner from "../../unique-identity-signer"
import {TestUniqueIdentityInstance} from "packages/protocol/typechain/truffle"
import {UniqueIdentity} from "packages/protocol/typechain/ethers"
import {UNIQUE_IDENTITY_ABI, FetchKYCFunction} from "../../unique-identity-signer"
import axios from "axios"

function fetchStubbedKycStatus(kyc: KycStatusResponse): FetchKYCFunction {
  return async (_) => {
    return Promise.resolve(kyc)
  }
}

const fetchEligibleStatusPersona: FetchKYCFunction = fetchStubbedKycStatus({
  address: "0xc34461018f970d343d5a25e4Ed28C4ddE6dcCc3F",
  status: "approved",
  identityStatus: "approved",
  accreditationStatus: "unaccredited",
  countryCode: "CA",
  residency: "non-us",
  kycProvider: "persona",
  type: "individual",
})

const TEST_ACCOUNT = {
  address: "0xc34461018f970d343d5a25e4Ed28C4ddE6dcCc3F",
  privateKey: "0x50f9c471e3c454b506f39536c06bde77233144784297a95d35896b3be3dfc9d8",
}

const setupTest = deployments.createFixture(async ({deployments, getNamedAccounts}) => {
  const {protocol_owner} = await getNamedAccounts()
  const [, anotherUser] = await web3.eth.getAccounts()
  assertNonNullable(protocol_owner)
  assertNonNullable(anotherUser)

  const {uniqueIdentity, go} = await deployAllContracts(deployments)
  return {uniqueIdentity, go, owner: protocol_owner, anotherUser}
})

describe("unique-identity-signer request validation", () => {
  let owner: string
  let anotherUser: string
  let uniqueIdentity: TestUniqueIdentityInstance
  let ethersUniqueIdentity: UniqueIdentity
  let signer: Signer
  let network: ethers.providers.Network
  let fetchKYCFunction: FetchKYCFunction
  const sandbox = sinon.createSandbox()

  beforeEach(async () => {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;({uniqueIdentity, owner, anotherUser} = await setupTest())
    signer = hre.ethers.provider.getSigner(await getProtocolOwner())
    ethersUniqueIdentity = new ethers.Contract(uniqueIdentity.address, UNIQUE_IDENTITY_ABI, signer) as UniqueIdentity
    assertNonNullable(signer.provider, "Signer provider is null")
    network = await signer.provider.getNetwork()

    await uniqueIdentity.grantRole(OWNER_ROLE, owner, {from: owner})
    await uniqueIdentity.grantRole(SIGNER_ROLE, await signer.getAddress(), {from: owner})
    sandbox.stub(axios, "post").resolves({status: 200})
  })

  afterEach(() => {
    sandbox.restore()
  })

  describe("main", () => {
    let latestBlockNum: number
    let wallet
    beforeEach(async () => {
      wallet = new Wallet(TEST_ACCOUNT.privateKey)
      latestBlockNum = (await signer.provider?.getBlock("latest"))?.number as number
      const currentBlock = await signer.provider?.getBlock(latestBlockNum)
      assertNonNullable(currentBlock)
    })

    it("forwards signature headers to the KYC function and verifies signature", async () => {
      const expectedAuth = {
        "x-goldfinch-address": TEST_ACCOUNT.address,
        "x-goldfinch-signature": await wallet.signMessage("Sign in to Goldfinch: 3"),
        "x-goldfinch-signature-plaintext": "Sign in to Goldfinch: 3",
        "x-goldfinch-signature-block-num": "3",
      }
      const fetchFunction: FetchKYCFunction = ({auth, chainId}) => {
        // No other headers should be present
        expect(auth).to.deep.equal(expectedAuth)
        return fetchEligibleStatusPersona({auth, chainId})
      }
      const inputHeaders = {
        "x-some-random-header": "test",
        ...expectedAuth,
      }

      // Run handler
      await expect(
        uniqueIdentitySigner.main({
          auth: inputHeaders,
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

      it("throws an error if the signature is incorrect", async () => {
        const invalidSignature =
          "0xaf75579e99f8810b5c009041961852a4872d3b19031a283ff8ea451854ac072331610c5edaf6ec7430a11cea0f19a2a111ce3b5c52ee93b933fd91e2f9336ad71c"
        await expect(
          uniqueIdentitySigner.main({
            auth: {
              "x-goldfinch-address": TEST_ACCOUNT.address,
              "x-goldfinch-signature": invalidSignature,
              "x-goldfinch-signature-block-num": latestBlockNum.toString(),
              "x-goldfinch-signature-plaintext": `Sign in to Goldfinch: ${latestBlockNum}`,
            },
            signer,
            network,
            uniqueIdentity: ethersUniqueIdentity,
            fetchKYCStatus: fetchEligibleStatusPersona,
          })
        ).to.eventually.be.rejectedWith("Invalid address or signature.")
      })

      it("throws an error if the signature block number is invalid", async () => {
        const validSignatureInvalidBlockNum =
          "0xf55449d7cea45a1537616da2ca9300623ec8c74888868209a4b02c19990e7d884f5835a4bc56218cf6e2d72d6d2351b2f0c52717159643025a70e2d3d25a7ac21c"
        await expect(
          uniqueIdentitySigner.main({
            auth: {
              "x-goldfinch-address": TEST_ACCOUNT.address,
              "x-goldfinch-signature": validSignatureInvalidBlockNum,
              "x-goldfinch-signature-block-num": "foo",
              "x-goldfinch-signature-plaintext": `Sign in to Goldfinch: ${latestBlockNum}`,
            },
            signer,
            network,
            uniqueIdentity: ethersUniqueIdentity,
            fetchKYCStatus: fetchEligibleStatusPersona,
          })
        ).to.eventually.be.rejectedWith("Invalid signature block number.")
      })

      it("throws an error if the signature block number corresponds to an expired timestamp", async () => {
        assertNonNullable(signer?.provider)
        signer.provider.getBlock = ((blockId) => {
          const blockTimestamp = blockId === "latest" ? 100000 : 0
          const blockNum = blockId === "latest" ? 10000 : 0
          return Promise.resolve({number: blockNum, timestamp: blockTimestamp})
        }) as any
        await expect(
          uniqueIdentitySigner.main({
            auth: {
              "x-goldfinch-address": TEST_ACCOUNT.address,
              "x-goldfinch-signature": await wallet.signMessage(`Sign in to Goldfinch: 0`),
              "x-goldfinch-signature-block-num": "0",
              "x-goldfinch-signature-plaintext": `Sign in to Goldfinch: ${0}`,
            },
            signer,
            network,
            uniqueIdentity: ethersUniqueIdentity,
            fetchKYCStatus: fetchEligibleStatusPersona,
          })
        ).to.eventually.be.rejectedWith(/Signature expired: /)
      })

      it("throws an error if the signature block number is in the future", async () => {
        const futureBlockNum = latestBlockNum + 100000
        await expect(
          uniqueIdentitySigner.main({
            auth: {
              "x-goldfinch-address": TEST_ACCOUNT.address,
              "x-goldfinch-signature": await wallet.signMessage(`Sign in to Goldfinch: ${futureBlockNum}`),
              "x-goldfinch-signature-block-num": futureBlockNum.toString(),
              "x-goldfinch-signature-plaintext": `Sign in to Goldfinch: ${futureBlockNum}`,
            },
            signer,
            network,
            uniqueIdentity: ethersUniqueIdentity,
            fetchKYCStatus: fetchEligibleStatusPersona,
          })
        ).to.eventually.be.rejectedWith(/Unexpected signature block number: /)
      })
    })
  })
})
