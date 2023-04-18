import * as firebaseTesting from "@firebase/rules-unit-testing"
import * as admin from "firebase-admin"
import {getUsers, setTestFirestore} from "../../../src/db"
import _ from "lodash"

import firestore = admin.firestore
import Firestore = firestore.Firestore
import {processIdentityWebhook} from "../../../src/handlers/parallelmarkets/webhookHelpers"

import sinon, {SinonSandbox, SinonStub} from "sinon"
import * as fetchModule from "node-fetch"
import {Response} from "node-fetch"
import {expect} from "chai"
import {
  PmConsistencyLevel,
  PmIdentityDocumentValidity,
  PmBusinessIdentity,
  PmIdentityPayload,
  PmIndividualIdentity,
} from "../../../src/handlers/parallelmarkets/PmApiTypes"
import {setTestConfig} from "../../../src/config"

describe("parallelMarketsDemoWebhookProcessor identity data update", async () => {
  const PENDING_ADDRESS_INDIVIDUAL = "0xA57415BeCcA125Ee98B04b229A0Af367f4144030"
  const PENDING_FIRESTORE_INDIVIDUAL_USER = {
    address: PENDING_ADDRESS_INDIVIDUAL,
    countryCode: "CA",
    residency: "us",
    parallelMarkets: {
      id: "test_id_individual",
      identityStatus: "pending",
      accreditationStatus: "pending",
      identityExpiresAt: 1713374693,
      type: "individual",
    },
  }

  const PENDING_ADDRESS_BUSINESS = "0xBBBBBBBBBBA125Ee98B04b229A0Af367f4144b30"
  const PENDING_FIRESTORE_BUSINESS_USER = {
    address: PENDING_ADDRESS_BUSINESS,
    countryCode: "US",
    residency: "us",
    parallelMarkets: {
      id: "test_id_business",
      identityStatus: "pending",
      identityExpiresAt: 1713374693,
      accreditationStatus: "pending",
      type: "business",
    },
  }

  const VALID_PM_INDIVIDUAL_IDENTITY_RESPONSE: PmIndividualIdentity = {
    id: "test_id_individual",
    type: "individual",
    identityDetails: {
      birthDate: "1997-10-14",
      residenceLocation: {
        country: "US",
      },
      citizenshipCountry: "CA",
      completedAt: "1680804375",
      consistencySummary: {
        idValidity: "valid",
        overallRecordsMatchLevel: "high",
      },
      expiresAt: "2024-04-17T17:24:53Z",
    },
  }

  const VALID_PM_BUSINESS_IDENTITY_RESPONSE: PmBusinessIdentity = {
    id: "test_id_business",
    type: "business",
    identityDetails: {
      incorporationCountry: "US",
      principalLocation: {
        country: "US",
      },
      businessType: "Pension Fund",
      completedAt: "1680804375",
      consistencySummary: {
        overallRecordsMatchLevel: "high",
      },
      expiresAt: "2024-04-17T17:24:53Z",
    },
  }

  const WEBHOOK_INDIVIDUAL_PAYLOAD: PmIdentityPayload = {
    entity: {
      id: "test_id_individual",
      type: "individual",
    },
    event: "data_update",
    scope: "identity",
  }

  const WEBHOOK_BUSINESS_PAYLOAD: PmIdentityPayload = {
    entity: {
      id: "test_id_business",
      type: "business",
    },
    event: "data_update",
    scope: "identity",
  }

  let testFirestore: Firestore
  let testApp: admin.app.App
  let users: firestore.CollectionReference<firestore.DocumentData>
  let sandbox: SinonSandbox
  let stub: SinonStub

  beforeEach(async () => {
    sandbox = sinon.createSandbox()
    stub = sandbox.stub(fetchModule, "default")
    testApp = firebaseTesting.initializeAdminApp({projectId: "goldfinch-frontend-test"})
    testFirestore = testApp.firestore()
    setTestFirestore(testFirestore)
    setTestConfig({})
    users = getUsers(testFirestore)

    // Save pending user to user store
    await users.doc(PENDING_ADDRESS_INDIVIDUAL).set(PENDING_FIRESTORE_INDIVIDUAL_USER)
    await users.doc(PENDING_ADDRESS_BUSINESS).set(PENDING_FIRESTORE_BUSINESS_USER)
  })

  afterEach(async () => {
    await firebaseTesting.clearFirestoreData({projectId: "goldfinch-frontend-test"})
    sandbox.restore()
  })

  describe("individual", () => {
    it("sets identity_status to approved when id_validity is valid and overall_records_match_level is high", async () => {
      // Stub the Identity API request
      stub.returns(
        new Promise((resolve) =>
          resolve(new Response(JSON.stringify(VALID_PM_INDIVIDUAL_IDENTITY_RESPONSE), {status: 200})),
        ),
      )

      // EXECUTE TEST
      await processIdentityWebhook(WEBHOOK_INDIVIDUAL_PAYLOAD)
      const user = await getUsers(admin.firestore()).doc(PENDING_ADDRESS_INDIVIDUAL).get()
      // Their status in firestore should be approved now
      const expectedUser = {
        ...PENDING_FIRESTORE_INDIVIDUAL_USER,
        parallelMarkets: {
          ...PENDING_FIRESTORE_INDIVIDUAL_USER.parallelMarkets,
          identityStatus: "approved",
        },
      }
      expect(user.data()).to.deep.eq(expectedUser)
    })

    it("sets identity_status to pending_documents when id_validity is null", async () => {
      // Stub the Identity API request
      const stubbedResponse = _.cloneDeep(VALID_PM_INDIVIDUAL_IDENTITY_RESPONSE)
      stubbedResponse.identityDetails.consistencySummary.idValidity = null
      stub.returns(new Promise((resolve) => resolve(new Response(JSON.stringify(stubbedResponse), {status: 200}))))

      // EXECUTE TEST
      const expectedUser = {
        ...PENDING_FIRESTORE_INDIVIDUAL_USER,
        parallelMarkets: {
          ...PENDING_FIRESTORE_INDIVIDUAL_USER.parallelMarkets,
          identityStatus: "pending_documents",
        },
      }
      await processIdentityWebhook(WEBHOOK_INDIVIDUAL_PAYLOAD)
      const user = await getUsers(admin.firestore()).doc(PENDING_ADDRESS_INDIVIDUAL).get()
      // Their status is still pending, so nothing should have changed
      expect(user.data()).to.deep.eq(expectedUser)
    })

    it("sets identity_status to pending_verification when id_validity is true but overall_records_match_level is null", async () => {
      // Stub the Identity API request
      const stubbedResponse = _.cloneDeep(VALID_PM_INDIVIDUAL_IDENTITY_RESPONSE)
      stubbedResponse.identityDetails.consistencySummary.idValidity = "valid"
      stubbedResponse.identityDetails.consistencySummary.overallRecordsMatchLevel = null
      stub.returns(new Promise((resolve) => resolve(new Response(JSON.stringify(stubbedResponse), {status: 200}))))

      // EXECUTE TEST
      const expectedUser = {
        ...PENDING_FIRESTORE_INDIVIDUAL_USER,
        parallelMarkets: {
          ...PENDING_FIRESTORE_INDIVIDUAL_USER.parallelMarkets,
          identityStatus: "pending_verification",
        },
      }
      await processIdentityWebhook(WEBHOOK_INDIVIDUAL_PAYLOAD)
      const user = await getUsers(admin.firestore()).doc(PENDING_ADDRESS_INDIVIDUAL).get()
      // Their status is still pending, so nothing should have changed
      expect(user.data()).to.deep.eq(expectedUser)
    })

    it("sets identity_status to expired when id_validity is expired", async () => {
      // Stub the Identity API request
      const stubbedResponse = _.cloneDeep(VALID_PM_INDIVIDUAL_IDENTITY_RESPONSE)
      stubbedResponse.identityDetails.consistencySummary.idValidity = "expired"
      stub.returns(new Promise((resolve) => resolve(new Response(JSON.stringify(stubbedResponse), {status: 200}))))

      // EXECUTE TEST
      await processIdentityWebhook(WEBHOOK_INDIVIDUAL_PAYLOAD)
      const user = await getUsers(admin.firestore()).doc(PENDING_ADDRESS_INDIVIDUAL).get()
      // Their status should be expired now
      const expectedUser = {
        ...PENDING_FIRESTORE_INDIVIDUAL_USER,
        parallelMarkets: {
          ...PENDING_FIRESTORE_INDIVIDUAL_USER.parallelMarkets,
          identityStatus: "expired",
        },
      }
      expect(user.data()).to.deep.eq(expectedUser)
    })

    it("sets identity_status to failed in all other cases", async () => {
      const identityValidityCases: Array<PmIdentityDocumentValidity> = ["valid_maybe_expired", "unreadable"]
      const overallRecordsMatchLevelCases: Array<PmConsistencyLevel> = ["medium", "low", "none"]
      const expectedUser = {
        ...PENDING_FIRESTORE_INDIVIDUAL_USER,
        parallelMarkets: {
          ...PENDING_FIRESTORE_INDIVIDUAL_USER.parallelMarkets,
          identityStatus: "failed",
        },
      }
      for (const identityCase of identityValidityCases) {
        for (const recordMatchLeveCase of overallRecordsMatchLevelCases) {
          const stubbedResponse = _.cloneDeep(VALID_PM_INDIVIDUAL_IDENTITY_RESPONSE)
          // Stub the Identity API response
          stubbedResponse.identityDetails.consistencySummary.idValidity = identityCase
          stubbedResponse.identityDetails.consistencySummary.overallRecordsMatchLevel = recordMatchLeveCase
          stub.returns(new Promise((resolve) => resolve(new Response(JSON.stringify(stubbedResponse), {status: 200}))))

          // EXECUTE TEST
          await processIdentityWebhook(WEBHOOK_INDIVIDUAL_PAYLOAD)
          const user = await getUsers(admin.firestore()).doc(PENDING_ADDRESS_INDIVIDUAL).get()
          expect(user.data()).to.deep.eq(expectedUser)
        }
      }
    })
  })

  describe("business", () => {
    it("sets identity_status to approved when overall_records_match_level is high", async () => {
      // Stub the Identity API request
      stub.returns(
        new Promise((resolve) =>
          resolve(new Response(JSON.stringify(VALID_PM_BUSINESS_IDENTITY_RESPONSE), {status: 200})),
        ),
      )

      // EXECUTE TEST
      await processIdentityWebhook(WEBHOOK_BUSINESS_PAYLOAD)
      const user = await getUsers(admin.firestore()).doc(PENDING_ADDRESS_BUSINESS).get()
      // Their status in firestore should be approved now
      const expectedUser = {
        ...PENDING_FIRESTORE_BUSINESS_USER,
        parallelMarkets: {
          ...PENDING_FIRESTORE_BUSINESS_USER.parallelMarkets,
          identityStatus: "approved",
        },
      }
      expect(user.data()).to.deep.eq(expectedUser)
    })

    it("sets identity_status to pending when overall_records_match_level is none", async () => {
      // Stub the Identity API request
      const stubbedResponse = _.cloneDeep(VALID_PM_BUSINESS_IDENTITY_RESPONSE)
      stubbedResponse.identityDetails.consistencySummary.overallRecordsMatchLevel = "none"
      stub.returns(new Promise((resolve) => resolve(new Response(JSON.stringify(stubbedResponse), {status: 200}))))

      await processIdentityWebhook(WEBHOOK_BUSINESS_PAYLOAD)
      const user = await getUsers(admin.firestore()).doc(PENDING_ADDRESS_BUSINESS).get()
      // We expect no change because they started off pending
      expect(user.data()).to.deep.eq(PENDING_FIRESTORE_BUSINESS_USER)
    })

    it("sets identity_status to failed in all other cases", async () => {
      const consistencyLevels: Array<PmConsistencyLevel> = ["low", "medium"]
      const expectedUser = {
        ...PENDING_FIRESTORE_BUSINESS_USER,
        parallelMarkets: {
          ...PENDING_FIRESTORE_BUSINESS_USER.parallelMarkets,
          identityStatus: "failed",
        },
      }

      for (const consistencyLevel of consistencyLevels) {
        const stubbedResponse = _.cloneDeep(VALID_PM_BUSINESS_IDENTITY_RESPONSE)
        // Stub the Identity API response
        stubbedResponse.identityDetails.consistencySummary.overallRecordsMatchLevel = consistencyLevel
        stub.returns(new Promise((resolve) => resolve(new Response(JSON.stringify(stubbedResponse), {status: 200}))))

        await processIdentityWebhook(WEBHOOK_BUSINESS_PAYLOAD)
        const user = await getUsers(admin.firestore()).doc(PENDING_ADDRESS_BUSINESS).get()
        expect(user.data()).to.deep.eq(expectedUser)
      }
    })
  })
})
