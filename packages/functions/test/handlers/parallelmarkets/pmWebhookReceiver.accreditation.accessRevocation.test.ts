import {getUsers} from "../../../src/db"
import _ from "lodash"
import {RulesTestEnvironment, RulesTestContext} from "@firebase/rules-unit-testing"
import firebase from "firebase/compat/app"

import {processAccreditationWebhook} from "../../../src/handlers/parallelmarkets/webhookHelpers"

import sinon, {SinonSandbox, SinonStub} from "sinon"
import * as fetchModule from "node-fetch"
import {Response} from "node-fetch"
import {expect} from "chai"
import {PmAccreditationPayload, PmProfileResponse} from "../../../src/handlers/parallelmarkets/PmApiTypes"
import {initializeFirebaseTestEnv} from "../../utils"

describe("pmWebhookReceiver accreditation access revocation", () => {
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

  const WEBHOOK_INDIVIDUAL_PAYLOAD: PmAccreditationPayload = {
    entity: {
      id: "test_id_individual",
      type: "individual",
    },
    event: "access_revocation_scheduled",
    scope: "accreditation_status",
  }

  const WEBHOOK_BUSINESS_PAYLOAD: PmAccreditationPayload = {
    entity: {
      id: "test_id_business",
      type: "business",
    },
    event: "access_revocation_scheduled",
    scope: "accreditation_status",
  }

  let testEnv: RulesTestEnvironment
  let testContext: RulesTestContext
  let users: firebase.firestore.CollectionReference<firebase.firestore.DocumentData>
  let sandbox: SinonSandbox
  let stub: SinonStub

  beforeEach(async () => {
    sandbox = sinon.createSandbox()
    stub = sandbox.stub(fetchModule, "default")
    ;({testEnv, testContext} = await initializeFirebaseTestEnv("goldfinch-frontends-test"))
    users = testContext.firestore().collection("test_users")

    // Save pending user to user store
    await users.doc(APPROVED_ADDRESS_INDIVIDUAL).set(APPROVED_FIRESTORE_INDIVIDUAL_USER)
    await users.doc(APPROVED_ADDRESS_BUSINESS).set(APPROVED_FIRESTORE_BUSINESS_USER)
  })

  afterEach(async () => {
    await testEnv.clearFirestore()
    sandbox.restore()
  })

  describe("individual", () => {
    it("sets accreditationAccessRevocationAt to access_revocation timestamp", async () => {
      // Stub the Identity API request
      stub.returns(
        new Promise((resolve) =>
          resolve(new Response(JSON.stringify(VALID_PM_INDIVIDUAL_PROFILE_RESPONSE), {status: 200})),
        ),
      )

      await processAccreditationWebhook(WEBHOOK_INDIVIDUAL_PAYLOAD)
      const user = await getUsers().doc(APPROVED_ADDRESS_INDIVIDUAL).get()
      // Their status in firestore should be approved now
      const expectedUser = {
        ...APPROVED_FIRESTORE_INDIVIDUAL_USER,
        parallelMarkets: {
          ...APPROVED_FIRESTORE_INDIVIDUAL_USER.parallelMarkets,
          accreditationAccessRevocationAt: Date.parse("2021-01-01T12:12:12Z") / 1000,
        },
      }
      expect(user.data()).to.deep.eq(expectedUser)
    })
  })

  describe("business", () => {
    it("sets accreditation_access_revocation_at to access_revocation timestamp", async () => {
      // Stub the Identity API request
      stub.returns(
        new Promise((resolve) =>
          resolve(new Response(JSON.stringify(VALID_PM_BUSINESS_PROFILE_RESPONSE), {status: 200})),
        ),
      )

      await processAccreditationWebhook(WEBHOOK_BUSINESS_PAYLOAD)
      const user = await getUsers().doc(APPROVED_ADDRESS_BUSINESS).get()
      // Their status in firestore should be approved now
      const expectedUser = {
        ...APPROVED_FIRESTORE_BUSINESS_USER,
        parallelMarkets: {
          ...APPROVED_FIRESTORE_BUSINESS_USER.parallelMarkets,
          accreditationAccessRevocationAt: Date.parse("2021-01-01T12:12:12Z") / 1000,
        },
      }
      expect(user.data()).to.deep.eq(expectedUser)
    })
  })
})
