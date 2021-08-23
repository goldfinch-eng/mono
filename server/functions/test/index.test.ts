import chai from "chai"
import chaiSubset from "chai-subset"
import * as firebaseTesting from "@firebase/rules-unit-testing"
import * as admin from "firebase-admin"
import crypto from "crypto"
import {SinonFakeTimers, useFakeTimers} from "sinon"

import {FirebaseConfig, getUsers, setEnvForTest} from "../src/db"
import {kycStatus, personaCallback} from "../src"

chai.use(chaiSubset as any)
const expect = chai.expect
import firestore = admin.firestore
import Firestore = firestore.Firestore
import {Request} from "express"

describe("functions", () => {
  let testFirestore: Firestore
  let testApp: admin.app.App
  let config: Omit<FirebaseConfig, "sentry">
  const projectId = "goldfinch-frontend-test"
  const address = "0xb5c52599dFc7F9858F948f003362A7f4B5E678A5"
  const validSignature =
    "0xd5c801fb4f8e37b41dfcf5b69a63b62563dcd171f18425517aed1e0172a0ebc118ef362f66b2a7f95d406e81e55830f48aa872c1fffdb0fa55d0789df7d9e0651c"
  let users: firestore.CollectionReference<firestore.DocumentData>

  const now = 1629746103600
  let clock: SinonFakeTimers
  const ONE_HOUR_MILLIS = 1000 * 60 * 60
  const ONE_MINUTE_MILLIS = 1000 * 60

  before(async () => {
    clock = useFakeTimers(now)
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
    clock.restore()
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
    const generateKycRequest = (
      address: string,
      signature: string,
      timestamp: number | string | undefined,
    ): Request => {
      return {
        headers: {"x-goldfinch-signature": signature, "x-goldfinch-signature-timestamp": timestamp},
        query: {address},
      } as unknown as Request
    }

    describe("validation", async () => {
      it("checks if address is present", async () => {
        await kycStatus(
          generateKycRequest("", validSignature, now),
          expectResponse(400, {error: "Address not provided."}),
        )
      })

      it("checks if the signature is present", async () => {
        await kycStatus(generateKycRequest(address, "", now), expectResponse(400, {error: "Signature not provided."}))
      })

      it("checks if the signature timestamp is present", async () => {
        await kycStatus(
          generateKycRequest(address, validSignature, undefined),
          expectResponse(400, {error: "Signature timestamp not provided."}),
        )
      })

      it("returns an error if the signature is incorrect", async () => {
        const invalidSignature =
          "0xaf75579e99f8810b5c009041961852a4872d3b19031a283ff8ea451854ac072331610c5edaf6ec7430a11cea0f19a2a111ce3b5c52ee93b933fd91e2f9336ad71c"
        const req = generateKycRequest(address, invalidSignature, now)
        await kycStatus(req, expectResponse(403, {error: "Invalid signature."}))
      })

      it("returns an error if the signature timestamp is invalid", async () => {
        const validSignatureInvalidTimestamp =
          "0xf55449d7cea45a1537616da2ca9300623ec8c74888868209a4b02c19990e7d884f5835a4bc56218cf6e2d72d6d2351b2f0c52717159643025a70e2d3d25a7ac21c"
        const req = generateKycRequest(address, validSignatureInvalidTimestamp, "foo")
        await kycStatus(req, expectResponse(400, {error: "Invalid signature timestamp."}))
      })

      it("returns an error if the signature timestamp has expired", async () => {
        const validSignatureExpiredTimestamp =
          "0xf55449d7cea45a1537616da2ca9300623ec8c74888868209a4b02c19990e7d884f5835a4bc56218cf6e2d72d6d2351b2f0c52717159643025a70e2d3d25a7ac21c"
        const req = generateKycRequest(address, validSignatureExpiredTimestamp, now - ONE_HOUR_MILLIS - 1)
        await kycStatus(req, expectResponse(403, {error: "Signature expired."}))
      })

      it("returns an error if the signature timestamp is in the future", async () => {
        const validSignatureTooFutureTimestamp =
          "0xf55449d7cea45a1537616da2ca9300623ec8c74888868209a4b02c19990e7d884f5835a4bc56218cf6e2d72d6d2351b2f0c52717159643025a70e2d3d25a7ac21c"
        const req = generateKycRequest(address, validSignatureTooFutureTimestamp, now + ONE_MINUTE_MILLIS + 1)
        await kycStatus(req, expectResponse(403, {error: "Unexpected signature timestamp."}))
      })
    })

    describe("with valid address and signature and timestamp", async () => {
      describe("when the user doesn't exist", async () => {
        it("returns status unknown", async () => {
          const req = generateKycRequest(address, validSignature, now)
          await kycStatus(req, expectResponse(200, {address, status: "unknown"}))
        })
      })
      describe("when the user exists", async () => {
        it("returns the status and countrycode based on status in the db", async () => {
          const req = generateKycRequest(address, validSignature, now)

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
