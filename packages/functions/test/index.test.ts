import chai from "chai"
import chaiSubset from "chai-subset"
import * as firebaseTesting from "@firebase/rules-unit-testing"
import * as admin from "firebase-admin"
import crypto from "crypto"
import sinon from "sinon"

import {FirebaseConfig, getAgreements, getNDAs, getUsers, setEnvForTest} from "../src/db"
import {fetchNDA, kycStatus, personaCallback, signAgreement, signNDA} from "../src"

chai.use(chaiSubset)
const expect = chai.expect
import firestore = admin.firestore
import Firestore = firestore.Firestore
import {Request} from "express"
import {assertNonNullable} from "@goldfinch-eng/utils"
import {mockGetBlockchain} from "../src/helpers"

type FakeBlock = {
  number: number
  timestamp: number
}

describe("functions", () => {
  let testFirestore: Firestore
  let testApp: admin.app.App
  let config: Omit<FirebaseConfig, "sentry">
  const projectId = "goldfinch-frontend-test"
  const address = "0xb5c52599dFc7F9858F948f003362A7f4B5E678A5"
  const validSignature =
    "0x46855997425525c8ae449fde8624668ce1f72485886900c585d08459822de466363faa239b8070393a2c3d1f97abe50abc48019be415258615e128b59cfd91a31c"
  let users: firestore.CollectionReference<firestore.DocumentData>
  let agreements: firestore.CollectionReference<firestore.DocumentData>
  let ndas: firestore.CollectionReference<firestore.DocumentData>

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
    const mock = sinon.fake.returns({
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
    agreements = getAgreements(testFirestore)
    ndas = getNDAs(testFirestore)
  })

  after(async () => {
    mockGetBlockchain(undefined)
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
        await kycStatus(req, expectResponse(401, {error: "Unexpected signature block number."}))
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

  describe("signAgreement", async () => {
    const generateAgreementRequest = (
      address: string,
      pool: string,
      fullName: string,
      signature: string,
      signatureBlockNum: number | string | undefined,
    ) => {
      return {
        headers: {
          "x-goldfinch-address": address,
          "x-goldfinch-signature": signature,
          "x-goldfinch-signature-block-num": signatureBlockNum,
        },
        body: {pool, fullName},
      } as unknown as Request
    }
    const pool = "0x1234asdADF"

    describe("validation", async () => {
      it("checks if address is present", async () => {
        await signAgreement(
          generateAgreementRequest("", "", "", "", currentBlockNum),
          expectResponse(403, {error: "Invalid address"}),
        )
      })
    })

    describe("valid request", async () => {
      it("saves the provided details to the agreements collection", async () => {
        const key = `${pool.toLowerCase()}-${address.toLowerCase()}`

        expect((await agreements.doc(key).get()).exists).to.be.false

        await signAgreement(
          generateAgreementRequest(address, pool, "Test User", validSignature, currentBlockNum),
          expectResponse(200, {status: "success"}),
        )

        const agreementDoc = await agreements.doc(key).get()
        expect(agreementDoc.exists).to.be.true
        expect(agreementDoc.data()).to.containSubset({address: address, fullName: "Test User", pool: pool})
      })

      it("updates the details if submitted twice", async () => {
        const key = `${pool.toLowerCase()}-${address.toLowerCase()}`

        await signAgreement(
          generateAgreementRequest(address, pool, "Test User", validSignature, currentBlockNum),
          expectResponse(200, {status: "success"}),
        )

        let agreementDoc = await agreements.doc(key).get()
        expect(agreementDoc.data()).to.containSubset({fullName: "Test User"})

        await signAgreement(
          generateAgreementRequest(address, pool, "Test User 2", validSignature, currentBlockNum),
          expectResponse(200, {status: "success"}),
        )

        agreementDoc = await agreements.doc(key).get()
        expect(agreementDoc.data()).to.containSubset({fullName: "Test User 2"})
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

  describe("signNDA", async () => {
    const generateNDARequest = (
      address: string,
      pool: string,
      signature: string,
      signatureBlockNum: number | string | undefined,
    ) => {
      return {
        headers: {
          "x-goldfinch-address": address,
          "x-goldfinch-signature": signature,
          "x-goldfinch-signature-block-num": signatureBlockNum,
        },
        body: {pool},
      } as unknown as Request
    }
    const pool = "0x1234asdADF"

    describe("validation", async () => {
      it("checks if address is present", async () => {
        await signNDA(generateNDARequest("", "", "", currentBlockNum), expectResponse(403, {error: "Invalid address"}))
      })
    })

    describe("valid request", async () => {
      it("saves the provided details to the ndas collection", async () => {
        const key = `${pool.toLowerCase()}-${address.toLowerCase()}`

        expect((await ndas.doc(key).get()).exists).to.be.false

        await signNDA(
          generateNDARequest(address, pool, validSignature, currentBlockNum),
          expectResponse(200, {status: "success"}),
        )

        const ndasDoc = await ndas.doc(key).get()
        expect(ndasDoc.exists).to.be.true
        expect(ndasDoc.data()).to.containSubset({address: address, pool: pool})
      })
    })
  })

  describe("fetchNDA", async () => {
    const generateFetchNDARequest = (
      address: string,
      pool: string,
      signature: string,
      signatureBlockNum: number | string | undefined,
    ) => {
      return {
        headers: {
          "x-goldfinch-address": address,
          "x-goldfinch-signature": signature,
          "x-goldfinch-signature-block-num": signatureBlockNum,
        },
        query: {pool: pool},
      } as unknown as Request
    }
    const pool = "0x1234asdADF"

    describe("validation", async () => {
      it("checks if address is present", async () => {
        await signNDA(
          generateFetchNDARequest("", "", "", currentBlockNum),
          expectResponse(403, {error: "Invalid address"}),
        )
      })
    })

    describe("valid request", async () => {
      describe("when nda exists", async () => {
        it("returns valid response", async () => {
          const key = `${pool.toLowerCase()}-${address.toLowerCase()}`

          await ndas.doc(key).set({
            address: address,
            pool: pool,
            signedAt: Date.now(),
          })
          const req = generateFetchNDARequest(address, pool, validSignature, currentBlockNum)
          await fetchNDA(req, expectResponse(200, {status: "success"}))

          const ndaDoc = await ndas.doc(key).get()
          expect(ndaDoc.exists).to.be.true
          expect(ndaDoc.data()).to.containSubset({address: address, pool: pool})
        })
      })

      describe("when nda does not exists", async () => {
        it("returns not found", async () => {
          const req = generateFetchNDARequest(address, pool, validSignature, currentBlockNum)
          await fetchNDA(req, expectResponse(404, {error: "Not found"}))
        })
      })
    })
  })
})
