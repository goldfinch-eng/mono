import chai from "chai"
import chaiSubset from "chai-subset"
import {BaseProvider} from "@ethersproject/providers"
import * as firebaseTesting from "@firebase/rules-unit-testing"
import * as admin from "firebase-admin"
import {fake} from "sinon"

import {getUsers, overrideFirestore} from "../../../src/db"
import {kycStatus} from "../../../src"

chai.use(chaiSubset)
import firestore = admin.firestore
import Firestore = firestore.Firestore
import {Request} from "express"
import {assertNonNullable} from "@goldfinch-eng/utils"
import {mockGetBlockchain} from "../../../src/helpers"
import {expectResponse} from "../../utils"
import {ethers} from "ethers"
import {setTestConfig} from "../../../src/config"
import {KycItemParallelMarkets} from "../../../src/handlers/kyc/kycTypes"
import {KycProvider} from "../../../src/types"

type FakeBlock = {
  number: number
  timestamp: number
}

const genPlaintext = (blocknum: number | string) => `Sign in to Goldfinch: ${blocknum}`

describe("kycStatus response", async () => {
  const testAccount = {
    address: "0xA57415BeCcA125Ee98B04b229A0Af367f4144030",
    privateKey: "0x20c5c29e29791089b4b60e65966adb104f540a7597ee1e97c6760e95c7b780eb",
  }
  const testWallet = new ethers.Wallet(testAccount.privateKey)

  const nonLegacyTestAccount = {
    address: "0x05A136025F4fe345387fCfBE0f8914eCBe12B3B6",
    privateKey: "6bb74f952041e68691d7b75bdcf4d4eedae2346d884f001df95f16a1f5d99f70",
  }
  const nonLegacyTestWallet = new ethers.Wallet(nonLegacyTestAccount.privateKey)

  let testFirestore: Firestore
  let testApp: admin.app.App
  const projectId = "goldfinch-frontend-test"
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

  const APPROVED_PM_USER_BUSINESS: KycItemParallelMarkets = {
    address: testWallet.address.toLowerCase(),
    countryCode: "US",
    residency: "us",
    kycProvider: KycProvider.ParallelMarkets,
    updatedAt: 0,
    parallelMarkets: {
      id: "test",
      type: "business",
      identityStatus: "approved",
      accreditationStatus: "approved",
      identityExpiresAt: 1239487239487,
      accreditationExpiresAt: 9929381028120,
      identityAccessRevocationAt: null,
      accreditationAccessRevocationAt: null,
    },
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

  beforeEach(() => {
    testApp = firebaseTesting.initializeAdminApp({projectId: projectId})
    testFirestore = testApp.firestore()
    overrideFirestore(testFirestore)
    setTestConfig({
      kyc: {allowed_origins: "http://localhost:3000"},
      persona: {allowed_ips: ""},
    })
    users = getUsers()
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
        "x-goldfinch-signature-plaintext": signatureBlockNum ? genPlaintext(signatureBlockNum) : "",
      },
      query: {},
    } as unknown as Request
  }

  describe("when the user doesn't exist in the db", async () => {
    describe("when the user exists on the legacy list", async () => {
      it("returns status legacy", async () => {
        const sig = await testWallet.signMessage(genPlaintext(currentBlockNum))
        const req = generateKycRequest(testWallet.address, sig, currentBlockNum)
        const expectedResponse = {
          address: testWallet.address,
          status: "approved",
          countryCode: "US",
          residency: "us",
          kycProvider: "parallelMarkets",
          type: "individual",
          identityStatus: "legacy",
          accreditationStatus: "legacy",
        }
        await kycStatus(req, expectResponse(200, expectedResponse))
      })
    })

    describe("when the user does NOT exist on the legacy list", () => {
      it("returns status unknown", async () => {
        const sig = await nonLegacyTestWallet.signMessage(genPlaintext(currentBlockNum))
        const req = generateKycRequest(nonLegacyTestWallet.address, sig, currentBlockNum)
        await kycStatus(
          req,
          expectResponse(200, {
            address: nonLegacyTestWallet.address,
            status: "unknown",
            countryCode: "unknown",
            residency: "unknown",
            kycProvider: "none",
          }),
        )
      })
    })
  })

  describe("when the user exists in the db", async () => {
    describe("persona", () => {
      let sig
      let req

      beforeEach(async () => {
        sig = await nonLegacyTestWallet.signMessage(genPlaintext(currentBlockNum))
        req = generateKycRequest(nonLegacyTestWallet.address, sig, currentBlockNum)
      })

      it("has accreditationStatus=unaccredited, type=individual, kycProvider=persona, and identityStatus matching top level status", async () => {
        const statuses = [
          {
            personaStatus: "",
            expectedTopLevelStatus: "unknown",
          },
          {
            personaStatus: "completed",
            expectedTopLevelStatus: "approved",
          },
          {
            personaStatus: "approved",
            expectedTopLevelStatus: "approved",
          },
          {
            personaStatus: "failed",
            expectedTopLevelStatus: "failed",
          },
          {
            personaStatus: "declined",
            expectedTopLevelStatus: "failed",
          },
        ]

        for (const {personaStatus, expectedTopLevelStatus} of statuses) {
          await users.doc(nonLegacyTestWallet.address.toLowerCase()).set({
            address: nonLegacyTestWallet.address.toLowerCase(),
            countryCode: "US",
            persona: {
              id: "inq_123abc",
              status: personaStatus,
            },
          })
          await kycStatus(
            req,
            expectResponse(200, {
              address: nonLegacyTestWallet.address,
              status: expectedTopLevelStatus,
              identityStatus: expectedTopLevelStatus,
              accreditationStatus: "unaccredited",
              type: "individual",
              kycProvider: "persona",
              countryCode: "US",
              residency: "unknown",
            }),
          )
        }
      })
    })

    describe("parallel markets", () => {
      describe("on the legacy list", () => {
        it("ignores their legacy status", async () => {
          // Test wallet 0xA57415BeCcA125Ee98B04b229A0Af367f4144030 is on the legacy list
          const sig = await testWallet.signMessage(genPlaintext(currentBlockNum))
          const req = generateKycRequest(testWallet.address, sig, currentBlockNum)

          await users.doc(testWallet.address.toLowerCase()).set(APPROVED_PM_USER_BUSINESS)

          await kycStatus(
            req,
            expectResponse(200, {
              address: testWallet.address,
              status: "approved",
              countryCode: "US",
              residency: "us",
              kycProvider: "parallelMarkets",
              type: "business",
              identityStatus: "approved",
              accreditationStatus: "approved",
            }),
          )
        })
      })

      describe("not on the legacy list", () => {
        let sig
        let req

        beforeEach(async () => {
          sig = await nonLegacyTestWallet.signMessage(genPlaintext(currentBlockNum))
          req = generateKycRequest(nonLegacyTestWallet.address, sig, currentBlockNum)
        })

        it("has access revocation timestamp in response if revocation timestamps in db", async () => {
          await users.doc(nonLegacyTestWallet.address.toLowerCase()).set({
            address: nonLegacyTestWallet.address.toLowerCase(),
            countryCode: "US",
            residency: "us",
            parallelMarkets: {
              type: "individual",
              identityStatus: "approved",
              accreditationStatus: "approved",
              accreditationAccessRevocationAt: 123495584,
              identityAccessRevocationAt: 34897598479,
            },
          })

          const expectedResponse = {
            address: nonLegacyTestWallet.address,
            status: "approved",
            countryCode: "US",
            residency: "us",
            type: "individual",
            identityStatus: "approved",
            accreditationStatus: "approved",
            // Should be be the earlier of the two timestamps
            accessRevocationBy: 123495584,
          }

          await kycStatus(req, expectResponse(200, expectedResponse))
        })

        it("has top level status pending if identityStatus is pending or accreditationStatus is pending and the other status is approved or pending", async () => {
          const identityStatuses = ["pending_documents", "pending_verification", "approved"]
          const accreditationStatuses = ["pending_documents", "pending_verification", "approved"]
          for (const identityStatus of identityStatuses) {
            for (const accreditationStatus of accreditationStatuses) {
              // Skip the non pending case
              if (identityStatus === "approved" && accreditationStatus === "approved") {
                continue
              }

              await users.doc(nonLegacyTestWallet.address.toLowerCase()).set({
                address: nonLegacyTestWallet.address.toLowerCase(),
                countryCode: "US",
                residency: "us",
                parallelMarkets: {
                  type: "business",
                  identityStatus,
                  accreditationStatus,
                },
              })

              const expectedResponse = {
                address: nonLegacyTestWallet.address,
                status: "pending",
                countryCode: "US",
                residency: "us",
                type: "business",
                identityStatus,
                accreditationStatus,
              }
              await kycStatus(req, expectResponse(200, expectedResponse))
            }
          }
        })

        it("has top level status failed if identityStatus OR accreditation status is failed", async () => {
          // When identity status is failed
          for (const accreditationStatus of ["pending_documents", "pending_verification", "approved", "expired"]) {
            await users.doc(nonLegacyTestWallet.address.toLowerCase()).set({
              address: nonLegacyTestWallet.address.toLowerCase(),
              countryCode: null,
              residency: null,
              parallelMarkets: {
                type: "individual",
                identityStatus: "failed",
                accreditationStatus,
              },
            })
            const expectedResponse = {
              address: nonLegacyTestWallet.address,
              status: "failed",
              type: "individual",
              identityStatus: "failed",
              accreditationStatus,
            }
            await kycStatus(req, expectResponse(200, expectedResponse))
          }

          // When accreditation status is failed
          for (const identityStatus of ["pending_documents", "pending_verification", "approved", "expired"]) {
            await users.doc(nonLegacyTestWallet.address.toLowerCase()).set({
              address: nonLegacyTestWallet.address.toLowerCase(),
              countryCode: null,
              residency: null,
              parallelMarkets: {
                type: "individual",
                identityStatus,
                accreditationStatus: "failed",
              },
            })
            const expectedResponse = {
              address: nonLegacyTestWallet.address,
              status: "failed",
              type: "individual",
              identityStatus,
              accreditationStatus: "failed",
            }
            await kycStatus(req, expectResponse(200, expectedResponse))
          }

          // When they are both failed
          await users.doc(nonLegacyTestWallet.address.toLowerCase()).set({
            address: nonLegacyTestWallet.address.toLowerCase(),
            countryCode: null,
            residency: null,
            parallelMarkets: {
              type: "individual",
              identityStatus: "failed",
              accreditationStatus: "failed",
            },
          })
          const expectedResponse = {
            address: nonLegacyTestWallet.address,
            status: "failed",
            type: "individual",
            identityStatus: "failed",
            accreditationStatus: "failed",
          }
          await kycStatus(req, expectResponse(200, expectedResponse))
        })

        it("has top level status expired if identityStatus OR accreditation status if expired", async () => {
          // When identity status is expired
          for (const accreditationStatus of ["pending_documents", "pending_verification", "approved"]) {
            await users.doc(nonLegacyTestWallet.address.toLowerCase()).set({
              address: nonLegacyTestWallet.address.toLowerCase(),
              countryCode: "US",
              residency: "us",
              parallelMarkets: {
                type: "individual",
                identityStatus: "expired",
                accreditationStatus,
              },
            })
            const expectedResponse = {
              address: nonLegacyTestWallet.address,
              status: "expired",
              countryCode: "US",
              residency: "us",
              type: "individual",
              identityStatus: "expired",
              accreditationStatus,
            }
            await kycStatus(req, expectResponse(200, expectedResponse))
          }

          // When accreditation status is expired
          for (const identityStatus of ["pending_documents", "pending_verification", "approved"]) {
            await users.doc(nonLegacyTestWallet.address.toLowerCase()).set({
              address: nonLegacyTestWallet.address.toLowerCase(),
              countryCode: "US",
              residency: "us",
              parallelMarkets: {
                identityStatus,
                accreditationStatus: "expired",
                type: "individual",
              },
            })
            const expectedResponse = {
              address: nonLegacyTestWallet.address,
              status: "expired",
              countryCode: "US",
              residency: "us",
              type: "individual",
              identityStatus,
              accreditationStatus: "expired",
            }
            await kycStatus(req, expectResponse(200, expectedResponse))
          }

          // When they are both expired
          await users.doc(nonLegacyTestWallet.address.toLowerCase()).set({
            address: nonLegacyTestWallet.address.toLowerCase(),
            countryCode: "US",
            residency: "us",
            parallelMarkets: {
              identityStatus: "expired",
              accreditationStatus: "expired",
              type: "individual",
            },
          })
          const expectedResponse = {
            address: nonLegacyTestWallet.address,
            status: "expired",
            countryCode: "US",
            residency: "us",
            identityStatus: "expired",
            accreditationStatus: "expired",
            type: "individual",
          }
          await kycStatus(req, expectResponse(200, expectedResponse))
        })
      })
    })

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
