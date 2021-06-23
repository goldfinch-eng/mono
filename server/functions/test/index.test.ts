import * as chai from "chai"
import * as chaiSubset from "chai-subset"
import * as firebaseTesting from "@firebase/rules-unit-testing"
import * as admin from "firebase-admin"
import * as crypto from "crypto"

import {getUsers, setFirestoreForTest} from "../src/db"
import {kycStatus, personaCallback} from "../src"

chai.use(chaiSubset as any)
const expect = chai.expect
import firestore = admin.firestore
import Firestore = firestore.Firestore

describe("functions", () => {
  let testFirestore: Firestore
  let testApp: admin.app.App
  const projectId = "goldfinch-frontend-test"
  const address = "0xE7f9ED35DA54b2e4A1857487dBf42A32C4DBD4a0"
  const validSignature =
    "0xaf75579e99f8810b5c009041961852a4872d3b19031a283ff8ea451854ac072331610c5edaf6ec7430a11cea0f19a2a177ce3b5c52ee93b933fd91e2f9336ad71c"
  let users: firestore.CollectionReference<firestore.DocumentData>

  beforeEach(() => {
    testApp = firebaseTesting.initializeAdminApp({projectId: projectId})
    testFirestore = testApp.firestore()
    setFirestoreForTest(testFirestore)
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
      return {headers: {}, query: {address, signature}} as any
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
        it("returns the status in the db", async () => {
          await users.doc(address.toLowerCase()).set({
            status: "pending",
          })
          const req = generateKycRequest(address, validSignature)
          await kycStatus(req, expectResponse(200, {address, status: "pending"}))
        })
      })
    })
  })

  describe("persona callback", async () => {
    const generatePersonaCallbackRequest = (address: string, status: string, otherAttributes: Record<string, any>) => {
      const personaCallbackId = crypto.randomBytes(20).toString("hex")
      const attributes = {status, referenceId: address, ...otherAttributes}
      return {
        body: {
          data: {attributes: {payload: {data: {id: personaCallbackId, type: "inquiry", attributes: attributes}}}},
        },
      } as any
    }

    describe("valid callback", async () => {
      describe("when user doesn't exist", async () => {
        it("creates a user document with the correct status", async () => {
          expect((await users.doc(address.toLowerCase()).get()).exists).to.be.false

          const req = generatePersonaCallbackRequest(address, "created", {})
          await personaCallback(req, expectResponse(200, {status: "success"}))

          const userDoc = await users.doc(address.toLowerCase()).get()
          expect(userDoc.exists).to.be.true
          expect(userDoc.data()).to.containSubset({address: address, status: "pending"})
        })
      })

      describe("when the user exists", async () => {
        it("updates the status", async () => {
          await users.doc(address.toLowerCase()).set({
            address: address,
            status: "pending",
          })
          const req = generatePersonaCallbackRequest(address, "completed", {})
          await personaCallback(req, expectResponse(200, {status: "success"}))

          const userDoc = await users.doc(address.toLowerCase()).get()
          expect(userDoc.exists).to.be.true
          expect(userDoc.data()).to.containSubset({address: address, status: "approved"})
        })

        describe("when the user is already approved", async () => {
          it("does not update the status", async () => {
            await users.doc(address.toLowerCase()).set({
              address: address,
              status: "approved",
            })
            const req = generatePersonaCallbackRequest(address, "expired", {})
            await personaCallback(req, expectResponse(200, {status: "success"}))

            const userDoc = await users.doc(address.toLowerCase()).get()
            expect(userDoc.exists).to.be.true
            expect(userDoc.data()).to.containSubset({address: address, status: "approved"})
          })
        })
      })
    })
  })
})
