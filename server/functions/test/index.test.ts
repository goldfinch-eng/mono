import chai from "chai"
import chaiSubset from "chai-subset"
import * as firebaseTesting from "@firebase/rules-unit-testing"
import * as admin from "firebase-admin"
import crypto from "crypto"

import {FirebaseConfig, getUsers, setEnvForTest} from "../src/db"
import {kycStatus, personaCallback} from "../src"

chai.use(chaiSubset as any)
const expect = chai.expect
import firestore = admin.firestore
import Firestore = firestore.Firestore

describe("functions", () => {
  let testFirestore: Firestore
  let testApp: admin.app.App
  let config: Omit<FirebaseConfig, "sentry">
  const projectId = "goldfinch-frontend-test"
  const address = "0xE7f9ED35DA54b2e4A1857487dBf42A32C4DBD4a0"
  const validSignature =
    "0xaf75579e99f8810b5c009041961852a4872d3b19031a283ff8ea451854ac072331610c5edaf6ec7430a11cea0f19a2a177ce3b5c52ee93b933fd91e2f9336ad71c"
  let users: firestore.CollectionReference<firestore.DocumentData>

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

  afterEach(async () => {
    await firebaseTesting.clearFirestoreData({projectId})
  })

  const expectResponse = function (expectedCode: number, expectedBody: Record<string, any>): any {
    return {
      status: (actualCode: number) => {
        expect(actualCode).to.eq(expectedCode)
        return {
          send: async (actualBody: Record<string, any>) => {
            expect(Object.keys(expectedBody).length).to.be.gt(0)
            return expect(actualBody).to.containSubset(expectedBody)
          },
        }
      },
    }
  }

  describe("kycStatus", async () => {
    const generateKycRequest = (address: string, signature: string) => {
      return {headers: {"x-goldfinch-signature": signature}, query: {address}} as any
    }
    describe("validation", async () => {
      it("checks if address is present", async () => {
        await kycStatus(generateKycRequest("", ""), expectResponse(400, {error: "Address or signature not provided"}))
      })

      it("checks if the signature is present", async () => {
        await kycStatus(
          generateKycRequest(address, ""),
          expectResponse(400, {error: "Address or signature not provided"}),
        )
      })

      it("returns an error if the signature is incorrect", async () => {
        const invalidSignature =
          "0xaf75579e99f8810b5c009041961852a4872d3b19031a283ff8ea451854ac072331610c5edaf6ec7430a11cea0f19a2a111ce3b5c52ee93b933fd91e2f9336ad71c"
        const req = generateKycRequest(address, invalidSignature)
        await kycStatus(req, expectResponse(403, {error: "Invalid address or signature"}))
      })
    })

    describe("with valid address and signature", async () => {
      describe("when the user doesn't exist", async () => {
        it("returns status unknown", async () => {
          const req = generateKycRequest(address, validSignature)
          await kycStatus(req, expectResponse(200, {address, status: "unknown"}))
        })
      })
      describe("when the user exists", async () => {
        it("returns the status and countrycode based on status in the db", async () => {
          const req = generateKycRequest(address, validSignature)

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

  describe("persona callback", async () => {
    const generatePersonaCallbackRequest = (
      address: string,
      status: string,
      otherAttributes: Record<string, any> = {},
      accountAttributes: Record<string, any> = {},
      verificationAttributes: Record<string, any> = {},
    ) => {
      const personaCallbackId = crypto.randomBytes(20).toString("hex")
      const attributes = {status, referenceId: address, ...otherAttributes}
      return {
        headers: {"persona-signature": crypto.randomBytes(20).toString("hex")}, // random signature
        ip: "127.0.0.1",
        body: {
          data: {
            attributes: {
              payload: {
                data: {id: personaCallbackId, type: "inquiry", attributes: attributes},
                included: [
                  {type: "account", id: crypto.randomBytes(20).toString("hex"), attributes: accountAttributes},
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
      } as any
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
        it("creates a user document with the correct status", async () => {
          expect((await users.doc(address.toLowerCase()).get()).exists).to.be.false

          const req = generatePersonaCallbackRequest(address, "created", {})
          await personaCallback(req, expectResponse(200, {status: "success"}))

          const userDoc = await users.doc(address.toLowerCase()).get()
          expect(userDoc.exists).to.be.true
          expect(userDoc.data()).to.containSubset({address: address})
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
          expect(userDoc.data()).to.containSubset({address: address, countryCode: "US"})
          expect(userDoc.data()?.persona?.status).to.eq("completed")
        })

        it("uses the country code from the verification if account does not have it", async () => {
          await users.doc(address.toLowerCase()).set({
            address: address,
            persona: {status: "created"},
          })
          const req = generatePersonaCallbackRequest(address, "completed", {}, {countryCode: ""}, {countryCode: "US"})
          await personaCallback(req, expectResponse(200, {status: "success"}))

          const userDoc = await users.doc(address.toLowerCase()).get()
          expect(userDoc.exists).to.be.true
          expect(userDoc.data()).to.containSubset({address: address, countryCode: "US"})
          expect(userDoc.data()?.persona?.status).to.eq("completed")
        })

        it("does not update the status if already approved", async () => {
          await users.doc(address.toLowerCase()).set({
            address: address,
            persona: {status: "approved"},
          })
          const req = generatePersonaCallbackRequest(address, "declined", {})
          await personaCallback(req, expectResponse(200, {status: "success"}))

          const userDoc = await users.doc(address.toLowerCase()).get()
          expect(userDoc.exists).to.be.true
          expect(userDoc.data()).to.containSubset({address: address})
          expect(userDoc.data()?.persona?.status).to.eq("approved")
        })
      })
    })
  })
})
