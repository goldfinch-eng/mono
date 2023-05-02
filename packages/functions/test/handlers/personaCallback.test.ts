import chai from "chai"
import chaiSubset from "chai-subset"
import {BaseProvider} from "@ethersproject/providers"
import {fake} from "sinon"
import {Request} from "firebase-functions"

import crypto from "crypto"
import {personaCallback} from "../../src"

import {RulesTestEnvironment, RulesTestContext} from "@firebase/rules-unit-testing"
import firebase from "firebase/compat/app"
import {initializeFirebaseTestEnv} from "../../src/db"

chai.use(chaiSubset)
const expect = chai.expect
import {assertNonNullable} from "@goldfinch-eng/utils"
import {mockGetBlockchain} from "../../src/helpers"
import {expectResponse} from "../utils"
import {FirebaseConfig} from "../../src/config"

type FakeBlock = {
  number: number
  timestamp: number
}

describe("persona callback", async () => {
  const address = "0xb5c52599dFc7F9858F948f003362A7f4B5E678A5"
  let config: Omit<FirebaseConfig, "sentry" | "parallelmarkets">
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
    config = {
      kyc: {allowed_origins: "http://localhost:3000"},
      persona: {allowed_ips: ""},
      slack: {token: ""},
    }
    ;({testEnv, testContext} = await initializeFirebaseTestEnv("goldfinch-frontend-test", config))
    users = testContext.firestore().collection("test_users")
  })

  after(async () => {
    mockGetBlockchain(undefined)
  })

  afterEach(async () => {
    await testEnv.clearFirestore()
  })

  const generatePersonaCallbackRequest = (
    address: string,
    status: string,
    otherAttributes: Record<string, unknown> = {},
    accountAttributes: Record<string, unknown> = {},
    verificationAttributes: Record<string, unknown> = {},
  ) => {
    const personaCallbackId = crypto.randomBytes(20).toString("hex")
    const attributes = {status, referenceId: address, ...otherAttributes}
    return {
      headers: {"persona-signature": crypto.randomBytes(20).toString("hex")}, // random signature
      ip: "127.0.0.1",
      body: {
        data: {
          attributes: {
            name: "inquiry.failed",
            payload: {
              data: {id: personaCallbackId, type: "inquiry", attributes: attributes},
              included: [
                {type: "account", id: crypto.randomBytes(20).toString("hex"), attributes: accountAttributes},
                {
                  type: "verification/government-id",
                  id: crypto.randomBytes(20).toString("hex"),
                  attributes: {
                    status: "failed",
                    attributes: {
                      "country-code": null,
                    },
                  },
                },
                {
                  type: "verification/government-id",
                  id: crypto.randomBytes(20).toString("hex"),
                  attributes: verificationAttributes,
                },
              ],
            },
          },
        },
      },
    } as unknown as Request
  }

  describe("invalid callback", async () => {
    it("returns an error if the signature is invalid", async () => {
      // set the secret to enable validation
      config.persona.secret = crypto.randomBytes(20).toString("hex")
      const req = generatePersonaCallbackRequest(address, "created", {})
      await personaCallback(req, expectResponse(400, {status: "error", message: "Request could not be verified"}))
    })

    it("returns an error if the ip", async () => {
      // set the allowed_ips to enable validation
      config.persona.allowed_ips = "192.168.1.1,192.168.0.0"
      const req = generatePersonaCallbackRequest(address, "created", {})
      await personaCallback(req, expectResponse(400, {status: "error", message: "Request could not be verified"}))
    })
  })

  describe("valid callback", async () => {
    describe("when user doesn't exist", async () => {
      it("creates a user document with the correct data", async () => {
        expect((await users.doc(address.toLowerCase()).get()).exists).to.be.false

        const req = generatePersonaCallbackRequest(address, "created", {}, {countryCode: "US"})
        await personaCallback(req, expectResponse(200, {status: "success"}))

        const userDoc = await users.doc(address.toLowerCase()).get()
        expect(userDoc.exists).to.be.true
        expect(userDoc.data()).to.containSubset({address: address, countryCode: "US"})
        expect(userDoc.data()?.persona?.status).to.eq("created")
      })
    })

    describe("when the user exists", async () => {
      it("updates the status and country code", async () => {
        await users.doc(address.toLowerCase()).set({
          address: address,
          persona: {status: "created"},
        })
        const req = generatePersonaCallbackRequest(address, "completed", {}, {countryCode: "US"})
        await personaCallback(req, expectResponse(200, {status: "success"}))

        const userDoc = await users.doc(address.toLowerCase()).get()
        expect(userDoc.exists).to.be.true
        expect(userDoc.data()).to.containSubset({address: address, countryCode: "US", kycProvider: "persona"})
        expect(userDoc.data()?.persona?.status).to.eq("completed")
      })

      it("uses the country code from the verification if account does not have it", async () => {
        await users.doc(address.toLowerCase()).set({
          address: address,
          persona: {status: "created"},
        })
        const req = generatePersonaCallbackRequest(
          address,
          "completed",
          {},
          {countryCode: ""},
          {countryCode: "US", status: "passed"},
        )
        await personaCallback(req, expectResponse(200, {status: "success"}))

        const userDoc = await users.doc(address.toLowerCase()).get()

        expect(userDoc.exists).to.be.true
        expect(userDoc.data()).to.containSubset({address: address, countryCode: "US", kycProvider: "persona"})
        expect(userDoc.data()?.persona?.status).to.eq("completed")
      })

      it("does not update status if status is already approved", async () => {
        await users.doc(address.toLowerCase()).set({
          address: address,
          persona: {status: "approved"},
          countryCode: "US",
          updatedAt: 123,
        })
        const req = generatePersonaCallbackRequest(address, "closed", {}, {countryCode: "US"})
        await personaCallback(req, expectResponse(200, {status: "success"}))

        const userDoc = await users.doc(address.toLowerCase()).get()
        expect(userDoc.exists).to.be.true
        expect(userDoc.data()?.persona?.status).to.eq("approved")
      })

      it("updates country code if it already exists", async () => {
        await users.doc(address.toLowerCase()).set({
          address: address,
          persona: {status: "approved"},
          countryCode: "US",
          updatedAt: 123,
        })
        const req = generatePersonaCallbackRequest(address, "closed", {}, {countryCode: "CA"})
        await personaCallback(req, expectResponse(200, {status: "success"}))

        const userDoc = await users.doc(address.toLowerCase()).get()
        expect(userDoc.exists).to.be.true
        expect(userDoc.data()).to.containSubset({address: address, countryCode: "CA", kycProvider: "persona"})
      })

      it("does not remove country code if it is already set", async () => {
        await users.doc(address.toLowerCase()).set({
          address: address,
          persona: {status: "approved"},
          countryCode: "US",
          updatedAt: 123,
        })
        const req = generatePersonaCallbackRequest(address, "closed", {}, {countryCode: null})
        await personaCallback(req, expectResponse(200, {status: "success"}))

        const userDoc = await users.doc(address.toLowerCase()).get()
        expect(userDoc.exists).to.be.true
        expect(userDoc.data()).to.containSubset({address: address, countryCode: "US", kycProvider: "persona"})
      })

      it("can handle non-existent country codes", async () => {
        await users.doc(address.toLowerCase()).set({
          address: address,
          persona: {status: "approved"},
          updatedAt: 123,
        })
        const req = generatePersonaCallbackRequest(address, "closed", {}, {})
        await personaCallback(req, expectResponse(200, {status: "success"}))

        const userDoc = await users.doc(address.toLowerCase()).get()
        expect(userDoc.exists).to.be.true
        expect(userDoc.data()).to.containSubset({address: address, kycProvider: "persona"})
      })
    })
  })
})
