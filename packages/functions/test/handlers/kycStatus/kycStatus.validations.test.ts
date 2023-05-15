import chai from "chai"
import chaiSubset from "chai-subset"
import {BaseProvider} from "@ethersproject/providers"
import {fake} from "sinon"

import {kycStatus} from "../../../src"

chai.use(chaiSubset)
import {Request} from "express"
import {assertNonNullable} from "@goldfinch-eng/utils"
import {mockGetBlockchain} from "../../../src/helpers"
import {expectResponse, initializeFirebaseTestEnv} from "../../utils"
import {ethers} from "ethers"

import {RulesTestEnvironment, RulesTestContext} from "@firebase/rules-unit-testing"
import firebase from "firebase/compat/app"

type FakeBlock = {
  number: number
  timestamp: number
}

const genPlaintext = (blocknum: number | string) => `Sign in to Goldfinch: ${blocknum}`

describe.skip("kycStatus validations", async () => {
  const testAccount = {
    address: "0xA57415BeCcA125Ee98B04b229A0Af367f4144030",
    privateKey: "0x20c5c29e29791089b4b60e65966adb104f540a7597ee1e97c6760e95c7b780eb",
  }
  const testWallet = new ethers.Wallet(testAccount.privateKey)

  let testEnv: RulesTestEnvironment
  let testContext: RulesTestContext
  let users: firebase.firestore.CollectionReference<firebase.firestore.DocumentData>

  const currentBlockNum = 84
  const yesterdayBlockNum = 80
  const futureBlockNum = 85

  const currentBlockTimestamp = 1629819124
  const timestampByBlockNum: {[blockNum: number]: number} = {
    [currentBlockNum]: currentBlockTimestamp,
    [yesterdayBlockNum]: currentBlockTimestamp - 60 * 60 * 24 - 1,
    [futureBlockNum]: currentBlockTimestamp + 1,
  }

  before(async () => {
    const mock = fake.returns({
      getBlock: async (blockTag: string | number): Promise<FakeBlock> => {
        const blockNum = blockTag === "latest" ? currentBlockNum : typeof blockTag === "number" ? blockTag : undefined
        assertNonNullable(blockNum)
        const timestamp = timestampByBlockNum[blockNum]
        assertNonNullable(timestamp)
        return {
          number: blockNum,
          timestamp,
        }
      },
    } as BaseProvider)

    mockGetBlockchain(mock)
  })

  beforeEach(async () => {
    ;({testEnv, testContext} = await initializeFirebaseTestEnv("goldfinch-frontends-test"))
    users = testContext.firestore().collection("test_users")
  })

  after(async () => {
    mockGetBlockchain(undefined)
  })

  afterEach(async () => {
    await testEnv.clearFirestore()
  })

  const generateKycRequest = (
    address: string,
    signature: string,
    signatureBlockNum: number | string | undefined,
  ): Request => {
    return {
      headers: {
        "x-goldfinch-address": address,
        "x-goldfinch-signature": signature,
        "x-goldfinch-signature-block-num": signatureBlockNum,
        "x-goldfinch-signature-plaintext": signatureBlockNum ? genPlaintext(signatureBlockNum) : "",
      },
      query: {},
    } as unknown as Request
  }

  describe("validation", async () => {
    it("checks if address is present", async () => {
      const sig = await testWallet.signMessage(genPlaintext(currentBlockNum))
      await kycStatus(
        generateKycRequest("", sig, currentBlockNum),
        expectResponse(400, {error: "Address not provided."}),
      )
    })

    it("checks if the signature is present", async () => {
      await kycStatus(
        generateKycRequest(testWallet.address, "", currentBlockNum),
        expectResponse(400, {error: "Signature not provided."}),
      )
    })

    it("checks the message signed matches the expected message", async () => {
      const sig = await testWallet.signMessage("Random plaintext")
      const req = {
        headers: {
          "x-goldfinch-address": testAccount.address,
          "x-goldfinch-signature": sig,
          "x-goldfinch-signature-plaintext": "Random plaintext",
          "x-goldfinch-signature-block-num": currentBlockNum,
        },
        query: {},
      } as unknown as Request
      await kycStatus(req, expectResponse(401, {error: "Unexpected signature"}))
    })

    it("checks if the signature block number is present", async () => {
      const sig = await testWallet.signMessage(genPlaintext(currentBlockNum))
      await kycStatus(
        generateKycRequest(testWallet.address, sig, undefined),
        expectResponse(400, {error: "Signature block number not provided."}),
      )
    })

    it("returns an error if the signature is incorrect", async () => {
      const sig =
        "0xaf75579e99f8810b5c009041961852a4872d3b19031a283ff8ea451854ac072331610c5edaf6ec7430a11cea0f19a2a111ce3b5c52ee93b933fd91e2f9336ad71c"
      const req = generateKycRequest(testWallet.address, sig, currentBlockNum)
      await kycStatus(req, expectResponse(401, {error: "Invalid address or signature."}))
    })

    it("returns an error if the signature block number is invalid", async () => {
      const sig = await testWallet.signMessage(genPlaintext("foo"))
      const req = generateKycRequest(testWallet.address, sig, "foo")
      await kycStatus(req, expectResponse(400, {error: "Invalid signature block number."}))
    })

    it("returns an error if the signature block number corresponds to an expired timestamp", async () => {
      const sig = await testWallet.signMessage(genPlaintext(yesterdayBlockNum))
      const req = generateKycRequest(testWallet.address, sig, yesterdayBlockNum)
      await kycStatus(req, expectResponse(401, {error: "Signature expired."}))
    })

    it("returns an error if the signature block number is in the future", async () => {
      const sig = await testWallet.signMessage(genPlaintext(futureBlockNum))
      const req = generateKycRequest(testWallet.address, sig, futureBlockNum)
      await kycStatus(req, expectResponse(401, {error: "Unexpected signature block number: 84 < 85"}))
    })
  })

  describe("missing x-goldfinch-signature-plaintext header", () => {
    it("defaults to `Sign in to Goldfinch..` signature", async () => {
      const req = {
        headers: {
          "x-goldfinch-address": testAccount.address,
          "x-goldfinch-signature": await testWallet.signMessage(genPlaintext(currentBlockNum)),
          "x-goldfinch-signature-block-num": currentBlockNum,
        },
        query: {},
      } as unknown as Request
      // Any 200 response implies we passed signature verification
      await kycStatus(req, expectResponse(200, {address: testWallet.address, status: "unknown"}))
    })
  })

  describe("with valid address and signature and signature block number", async () => {
    describe("when the user doesn't exist", async () => {
      it("returns status unknown", async () => {
        const sig = await testWallet.signMessage(genPlaintext(currentBlockNum))
        const req = generateKycRequest(testWallet.address, sig, currentBlockNum)
        await kycStatus(req, expectResponse(200, {address: testWallet.address, status: "unknown"}))
      })
    })

    describe("when the user exists", async () => {
      it("returns the status and countrycode based on status in the db", async () => {
        const sig = await testWallet.signMessage(genPlaintext(currentBlockNum))
        const req = generateKycRequest(testWallet.address, sig, currentBlockNum)

        await users.doc(testWallet.address.toLowerCase()).set({
          address: testWallet.address.toLowerCase(),
          persona: {},
        })
        await kycStatus(req, expectResponse(200, {address: testWallet.address, status: "unknown"}))

        await users.doc(testWallet.address.toLowerCase()).set({
          address: testWallet.address.toLowerCase(),
          persona: {status: "created"},
        })
        await kycStatus(req, expectResponse(200, {address: testWallet.address, status: "unknown"}))

        await users.doc(testWallet.address.toLowerCase()).set({
          address: testWallet.address.toLowerCase(),
          persona: {status: "completed"},
          countryCode: "US",
        })
        await kycStatus(req, expectResponse(200, {address: testWallet.address, status: "approved", countryCode: "US"}))

        await users.doc(testWallet.address.toLowerCase()).set({
          address: testWallet.address.toLowerCase(),
          persona: {status: "expired"},
        })
        await kycStatus(req, expectResponse(200, {address: testWallet.address, status: "unknown"}))
      })
    })
  })
})
