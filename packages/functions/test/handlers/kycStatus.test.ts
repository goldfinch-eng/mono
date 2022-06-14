import chai from "chai"
import chaiSubset from "chai-subset"
import * as firebaseTesting from "@firebase/rules-unit-testing"
import * as admin from "firebase-admin"
import {fake} from "sinon"

import {FirebaseConfig, getUsers, setEnvForTest} from "../../src/db"
import {kycStatus} from "../../src"

chai.use(chaiSubset)
import firestore = admin.firestore
import Firestore = firestore.Firestore
import {Request} from "express"
import {assertNonNullable} from "@goldfinch-eng/utils"
import {mockGetBlockchain} from "../../src/helpers"
import {expectResponse} from "../utils"

type FakeBlock = {
  number: number
  timestamp: number
}

describe("kycStatus", async () => {
  let testFirestore: Firestore
  let testApp: admin.app.App
  let config: Omit<FirebaseConfig, "sentry">
  const projectId = "goldfinch-frontend-test"
  const address = "0xb5c52599dFc7F9858F948f003362A7f4B5E678A5"
  const validSignature =
    "0x46855997425525c8ae449fde8624668ce1f72485886900c585d08459822de466363faa239b8070393a2c3d1f97abe50abc48019be415258615e128b59cfd91a31c"
  let users: firestore.CollectionReference<firestore.DocumentData>

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
    })
    mockGetBlockchain(mock as any)
  })

  beforeEach(() => {
    testApp = firebaseTesting.initializeAdminApp({projectId: projectId})
    testFirestore = testApp.firestore()
    config = {
      kyc: {allowed_origins: "http://localhost:3000"},
      persona: {allowed_ips: ""},
    }
    setEnvForTest(testFirestore, config)
    users = getUsers(testFirestore)
  })

  after(async () => {
    mockGetBlockchain(undefined)
  })

  afterEach(async () => {
    await firebaseTesting.clearFirestoreData({projectId})
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
      },
    } as unknown as Request
  }

  describe("validation", async () => {
    it("checks if address is present", async () => {
      await kycStatus(
        generateKycRequest("", validSignature, currentBlockNum),
        expectResponse(400, {error: "Address not provided."}),
      )
    })

    it("checks if the signature is present", async () => {
      await kycStatus(
        generateKycRequest(address, "", currentBlockNum),
        expectResponse(400, {error: "Signature not provided."}),
      )
    })

    it("checks if the signature block number is present", async () => {
      await kycStatus(
        generateKycRequest(address, validSignature, undefined),
        expectResponse(400, {error: "Signature block number not provided."}),
      )
    })

    it("returns an error if the signature is incorrect", async () => {
      const invalidSignature =
        "0xaf75579e99f8810b5c009041961852a4872d3b19031a283ff8ea451854ac072331610c5edaf6ec7430a11cea0f19a2a111ce3b5c52ee93b933fd91e2f9336ad71c"
      const req = generateKycRequest(address, invalidSignature, currentBlockNum)
      await kycStatus(req, expectResponse(401, {error: "Invalid address or signature."}))
    })

    it("returns an error if the signature block number is invalid", async () => {
      const validSignatureInvalidBlockNum =
        "0xf55449d7cea45a1537616da2ca9300623ec8c74888868209a4b02c19990e7d884f5835a4bc56218cf6e2d72d6d2351b2f0c52717159643025a70e2d3d25a7ac21c"
      const req = generateKycRequest(address, validSignatureInvalidBlockNum, "foo")
      await kycStatus(req, expectResponse(400, {error: "Invalid signature block number."}))
    })

    it("returns an error if the signature block number corresponds to an expired timestamp", async () => {
      const validSignatureYesterdayBlockNum =
        "0xdd9b012f5106bf75eec0b922e55decb8da4b79f3ed7f924bf12b8b4092c808b56e35af8750ce010892e6cd840faee43b8d52385f465d2d4c9a5770853bfc9f4c1c"
      const req = generateKycRequest(address, validSignatureYesterdayBlockNum, yesterdayBlockNum)
      await kycStatus(req, expectResponse(401, {error: "Signature expired."}))
    })

    it("returns an error if the signature block number is in the future", async () => {
      const validSignatureFutureBlockNum =
        "0xf262b40c8f19a262c2262c1c28729d255685cacf5e3c2571929b2278b637eaec6946913998672721b4c9923c492dfe8ee53e334a337e87c5cf022a9a0996fc5d1c"
      const req = generateKycRequest(address, validSignatureFutureBlockNum, futureBlockNum)
      await kycStatus(req, expectResponse(401, {error: "Unexpected signature block number: 84 < 85"}))
    })
  })

  describe("with valid address and signature and signature block number", async () => {
    describe("when the user doesn't exist", async () => {
      it("returns status unknown", async () => {
        const req = generateKycRequest(address, validSignature, currentBlockNum)
        await kycStatus(req, expectResponse(200, {address, status: "unknown"}))
      })
    })
    describe("when the user exists", async () => {
      it("returns the status and countrycode based on status in the db", async () => {
        const req = generateKycRequest(address, validSignature, currentBlockNum)

        await users.doc(address.toLowerCase()).set({
          persona: {},
        })
        await kycStatus(req, expectResponse(200, {address, status: "unknown"}))

        await users.doc(address.toLowerCase()).set({
          persona: {status: "created"},
        })
        await kycStatus(req, expectResponse(200, {address, status: "unknown"}))

        await users.doc(address.toLowerCase()).set({
          persona: {status: "completed"},
          countryCode: "US",
        })
        await kycStatus(req, expectResponse(200, {address, status: "approved", countryCode: "US"}))

        await users.doc(address.toLowerCase()).set({
          persona: {status: "expired"},
        })
        await kycStatus(req, expectResponse(200, {address, status: "unknown"}))
      })
    })
  })
})
