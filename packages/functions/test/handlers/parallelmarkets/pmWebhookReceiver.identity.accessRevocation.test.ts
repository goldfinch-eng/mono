import * as firebaseTesting from "@firebase/rules-unit-testing"
import * as admin from "firebase-admin"
import {getUsers, overrideFirestore} from "../../../src/db"
import _ from "lodash"

import firestore = admin.firestore
import Firestore = firestore.Firestore
import {processIdentityWebhook} from "../../../src/handlers/parallelmarkets/webhookHelpers"

import sinon, {SinonSandbox, SinonStub} from "sinon"
import * as fetchModule from "node-fetch"
import {Response} from "node-fetch"
import {expect} from "chai"
import {PmIdentityPayload, PmProfileResponse} from "../../../src/handlers/parallelmarkets/PmApiTypes"
import {setTestConfig} from "../../../src/config"

describe("pmWebhookReceiver identity access revocation", () => {
  const APPROVED_ADDRESS_INDIVIDUAL = "0xA57415BeCcA125Ee98B04b229A0Af367f4144030"
  const APPROVED_FIRESTORE_INDIVIDUAL_USER = {
    address: APPROVED_ADDRESS_INDIVIDUAL,
    countryCode: "CA",
    parallelMarkets: {
      id: "test_id_individual",
      identityStatus: "approved",
      accreditationStatus: "approved",
    },
  }

  const APPROVED_ADDRESS_BUSINESS = "0xBBBBBBBBBBA125Ee98B04b229A0Af367f4144b30"
  const APPROVED_FIRESTORE_BUSINESS_USER = {
    address: APPROVED_ADDRESS_BUSINESS,
    countryCode: "US",
    parallelMarkets: {
      id: "test_id_business",
      identityStatus: "approved",
      accreditationStatus: "approved",
    },
  }

  const VALID_PM_INDIVIDUAL_PROFILE_RESPONSE: PmProfileResponse = {
    id: "test_id_individual",
    type: "individual",
    profile: {
      email: "steve@apple.com",
      firstName: "Steven",
      lastName: "Jobs",
    },
    userId: "steve",
    userProfile: {
      email: "steve@apple.com",
      firstName: "Steve",
      lastName: "Jobs",
    },
    userProvidingFor: "self",
    accessExpiresAt: "2021-01-01T12:12:12Z",
    accessRevokedBy: "subject",
  }

  const VALID_PM_BUSINESS_PROFILE_RESPONSE: PmProfileResponse = {
    id: "test_id_business",
    type: "business",
    profile: {
      name: "Apple",
      businessType: "Corporation",
      primaryContact: {
        email: "steve@apple.com",
        firstName: "Steve",
        lastName: "Jobs",
      },
    },
    userProfile: {
      email: "steve@apple.com",
      firstName: "Steve",
      lastName: "Jobs",
    },
    userId: "steve",
    userProvidingFor: "controlled-business",
    accessExpiresAt: "2021-01-01T12:12:12Z",
    accessRevokedBy: "subject",
  }

  const WEBHOOK_INDIVIDUAL_PAYLOAD: PmIdentityPayload = {
    entity: {
      id: "test_id_individual",
      type: "individual",
    },
    event: "access_revocation_scheduled",
    scope: "identity",
  }

  const WEBHOOK_BUSINESS_PAYLOAD: PmIdentityPayload = {
    entity: {
      id: "test_id_business",
      type: "business",
    },
    event: "access_revocation_scheduled",
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
    overrideFirestore(testFirestore)
    setTestConfig({})
    users = getUsers()

    // Save pending user to user store
    await users.doc(APPROVED_ADDRESS_INDIVIDUAL).set(APPROVED_FIRESTORE_INDIVIDUAL_USER)
    await users.doc(APPROVED_ADDRESS_BUSINESS).set(APPROVED_FIRESTORE_BUSINESS_USER)
  })

  afterEach(async () => {
    await firebaseTesting.clearFirestoreData({projectId: "goldfinch-frontend-test"})
    sandbox.restore()
  })

  describe("individual", () => {
    it("sets identity_access_revocation_at to access_revocation timestamp", async () => {
      // Stub the Identity API request
      stub.returns(
        new Promise((resolve) =>
          resolve(new Response(JSON.stringify(VALID_PM_INDIVIDUAL_PROFILE_RESPONSE), {status: 200})),
        ),
      )

      await processIdentityWebhook(WEBHOOK_INDIVIDUAL_PAYLOAD)
      const user = await getUsers().doc(APPROVED_ADDRESS_INDIVIDUAL).get()
      // Their status in firestore should be approved now
      const expectedUser = {
        ...APPROVED_FIRESTORE_INDIVIDUAL_USER,
        parallelMarkets: {
          ...APPROVED_FIRESTORE_INDIVIDUAL_USER.parallelMarkets,
          identityAccessRevocationAt: Date.parse("2021-01-01T12:12:12Z") / 1000,
        },
      }
      expect(user.data()).to.deep.eq(expectedUser)
    })
  })

  describe("business", () => {
    it("sets identity_access_revocation_at to access_revocation timestamp", async () => {
      // Stub the Identity API request
      stub.returns(
        new Promise((resolve) =>
          resolve(new Response(JSON.stringify(VALID_PM_BUSINESS_PROFILE_RESPONSE), {status: 200})),
        ),
      )

      await processIdentityWebhook(WEBHOOK_BUSINESS_PAYLOAD)
      const user = await getUsers().doc(APPROVED_ADDRESS_BUSINESS).get()
      // Their status in firestore should be approved now
      const expectedUser = {
        ...APPROVED_FIRESTORE_BUSINESS_USER,
        parallelMarkets: {
          ...APPROVED_FIRESTORE_BUSINESS_USER.parallelMarkets,
          identityAccessRevocationAt: Date.parse("2021-01-01T12:12:12Z") / 1000,
        },
      }
      expect(user.data()).to.deep.eq(expectedUser)
    })
  })
})
