import {RulesTestEnvironment, RulesTestContext} from "@firebase/rules-unit-testing"
import firebase from "firebase/compat/app"
import {getUsers} from "../../../src/db/db"
import _ from "lodash"

import {processAccreditationWebhook} from "../../../src/handlers/parallelmarkets/webhookHelpers"
import {
  PmAccreditationPayload,
  PmAccreditationStatus,
  PmBusinessAccreditation,
  PmIndividualAccreditation,
} from "../../../src/handlers/parallelmarkets/PmApiTypes"

import sinon, {SinonSandbox, SinonStub} from "sinon"
import * as fetchModule from "node-fetch"
import {Response} from "node-fetch"
import {expect} from "chai"
import {initializeFirebaseTestEnv} from "../../utils"

describe("pmWebhookReceiver accreditation data update", async () => {
  const PENDING_ADDRESS_INDIVIDUAL = "0xA57415BeCcA125Ee98B04b229A0Af367f4144030"
  const PENDING_FIRESTORE_INDIVIDUAL_USER = {
    address: PENDING_ADDRESS_INDIVIDUAL,
    countryCode: "CA",
    parallelMarkets: {
      id: "test_id_individual",
      identityStatus: "pending",
      identityExpiresAt: 1712376115,
      accreditationStatus: "pending_verification",
      accreditationExpiresAt: 1712376115,
    },
  }

  const PENDING_ADDRESS_BUSINESS = "0xBBBBBBBBBBA125Ee98B04b229A0Af367f4144b30"
  const PENDING_FIRESTORE_BUSINESS_USER = {
    address: PENDING_ADDRESS_BUSINESS,
    countryCode: "US",
    parallelMarkets: {
      id: "test_id_business",
      identityStatus: "pending",
      identityExpiresAt: 1712376115,
      accreditationStatus: "pending_verification",
      accreditationExpiresAt: 1712376115,
    },
  }

  const VALID_PM_INDIVIDUAL_ACCREDITATION_RESPONSE: PmIndividualAccreditation = {
    id: "test_id_individual",
    type: "individual",
    accreditations: [
      {
        id: "test_id_individual_accreditation",
        status: "current",
        expiresAt: 1712376115,
        assertionType: "income",
        createdAt: 1680818515,
        certifiedAt: 1680818515,
        firstName: "Steven",
        lastName: "Jobs",
        documents: [
          {
            downloadUrl: "https://bitcoin.org/bitcoin.pdf",
            downloadUrlExpires: 1712376115,
            type: "certification-letter",
          },
        ],
      },
    ],
  }

  const VALID_PM_BUSINESS_ACCREDITATION_RESPONSE: PmBusinessAccreditation = {
    id: "test_id_business",
    type: "business",
    accreditations: [
      {
        id: "test_id_business_accreditation",
        status: "current",
        expiresAt: 1712376115,
        assertionType: "worth",
        createdAt: 1680818515,
        certifiedAt: 1680818515,
        name: "Apple Computer",
        documents: [
          {
            downloadUrl: "https://bitcoin.org/bitcoin.pdf",
            downloadUrlExpires: 1712376115,
            type: "certification-letter",
          },
        ],
      },
    ],
  }

  const WEBHOOK_INDIVIDUAL_PAYLOAD: PmAccreditationPayload = {
    entity: {
      id: "test_id_individual",
      type: "individual",
    },
    event: "data_update",
    scope: "accreditation_status",
  }

  const WEBHOOK_BUSINESS_PAYLOAD: PmAccreditationPayload = {
    entity: {
      id: "test_id_business",
      type: "business",
    },
    event: "data_update",
    scope: "accreditation_status",
  }

  let sandbox: SinonSandbox
  let stub: SinonStub
  let testEnv: RulesTestEnvironment
  let testContext: RulesTestContext
  let users: firebase.firestore.CollectionReference<firebase.firestore.DocumentData>

  beforeEach(async () => {
    sandbox = sinon.createSandbox()
    stub = sandbox.stub(fetchModule, "default")
    ;({testEnv, testContext} = await initializeFirebaseTestEnv("goldfinch-frontends-test"))
    users = testContext.firestore().collection("test_users")

    // Save pending user to user store
    await users.doc(PENDING_ADDRESS_INDIVIDUAL).set(PENDING_FIRESTORE_INDIVIDUAL_USER)
    await users.doc(PENDING_ADDRESS_BUSINESS).set(PENDING_FIRESTORE_BUSINESS_USER)
  })

  afterEach(async () => {
    await testEnv.clearFirestore()
    sandbox.restore()
  })

  describe("individual", () => {
    it("sets accreditation_status to approved when accreditation attempt status is current", async () => {
      // Stub the Accreditations API
      stub.returns(
        new Promise((resolve) =>
          resolve(new Response(JSON.stringify(VALID_PM_INDIVIDUAL_ACCREDITATION_RESPONSE), {status: 200})),
        ),
      )

      await processAccreditationWebhook(WEBHOOK_INDIVIDUAL_PAYLOAD)
      const user = await getUsers().doc(PENDING_ADDRESS_INDIVIDUAL).get()
      const expectedUser = {
        ...PENDING_FIRESTORE_INDIVIDUAL_USER,
        parallelMarkets: {
          ...PENDING_FIRESTORE_INDIVIDUAL_USER.parallelMarkets,
          accreditationStatus: "approved",
        },
      }
      expect(user.data()).to.deep.eq(expectedUser)
    })

    it("sets accreditation_status to pending_verification when accreditation attempt status is pending", async () => {
      // Stub the Accreditations API
      const stubbedResponse = _.cloneDeep(VALID_PM_INDIVIDUAL_ACCREDITATION_RESPONSE)
      stubbedResponse.accreditations[0].status = "pending"
      stub.returns(new Promise((resolve) => resolve(new Response(JSON.stringify(stubbedResponse), {status: 200}))))
      await processAccreditationWebhook(WEBHOOK_INDIVIDUAL_PAYLOAD)
      const user = await getUsers().doc(PENDING_ADDRESS_INDIVIDUAL).get()
      // Their status is still pending, so nothing should have changed
      expect(user.data()).to.deep.eq(PENDING_FIRESTORE_INDIVIDUAL_USER)
    })

    it("sets accreditation_status to pending_documents when attempt status is submitter_pending or third_party_pending", async () => {
      const statuses: Array<PmAccreditationStatus> = ["submitter_pending", "third_party_pending"]
      const expectedUser = {
        ...PENDING_FIRESTORE_INDIVIDUAL_USER,
        parallelMarkets: {
          ...PENDING_FIRESTORE_INDIVIDUAL_USER.parallelMarkets,
          accreditationStatus: "pending_documents",
        },
      }
      for (const status of statuses) {
        // Stub the Accreditations API
        const stubbedResponse = _.cloneDeep(VALID_PM_INDIVIDUAL_ACCREDITATION_RESPONSE)
        stubbedResponse.accreditations[0].status = status
        stub.returns(new Promise((resolve) => resolve(new Response(JSON.stringify(stubbedResponse), {status: 200}))))
        await processAccreditationWebhook(WEBHOOK_INDIVIDUAL_PAYLOAD)
        const user = await getUsers().doc(PENDING_ADDRESS_INDIVIDUAL).get()
        user.data().parallelMarkets.accreditationStatus = "pending_documents"
        // Their status is still pending, so nothing should have changed
        expect(user.data()).to.deep.eq(expectedUser)
      }
    })

    it("sets accreditation_status to pending_documents when there are no accreditation attemps", async () => {
      // Stub the Accreditations API
      const stubbedResponse = _.cloneDeep(VALID_PM_INDIVIDUAL_ACCREDITATION_RESPONSE)
      stubbedResponse.accreditations = []
      stub.returns(new Promise((resolve) => resolve(new Response(JSON.stringify(stubbedResponse), {status: 200}))))

      await processAccreditationWebhook(WEBHOOK_INDIVIDUAL_PAYLOAD)
      const user = await getUsers().doc(PENDING_ADDRESS_INDIVIDUAL).get()
      const expectedUser = {
        ...PENDING_FIRESTORE_INDIVIDUAL_USER,
        parallelMarkets: {
          ...PENDING_FIRESTORE_INDIVIDUAL_USER.parallelMarkets,
          accreditationStatus: "pending_documents",
        },
      }
      expect(user.data()).to.deep.eq(expectedUser)
    })

    it("sets accreditation_status to expired when accreditation attempt status is expired", async () => {
      // Stub the Accreditations API
      const stubbedResponse = _.cloneDeep(VALID_PM_INDIVIDUAL_ACCREDITATION_RESPONSE)
      stubbedResponse.accreditations[0].status = "expired"
      stub.returns(new Promise((resolve) => resolve(new Response(JSON.stringify(stubbedResponse), {status: 200}))))

      await processAccreditationWebhook(WEBHOOK_INDIVIDUAL_PAYLOAD)
      const user = await getUsers().doc(PENDING_ADDRESS_INDIVIDUAL).get()
      const expectedUser = {
        ...PENDING_FIRESTORE_INDIVIDUAL_USER,
        parallelMarkets: {
          ...PENDING_FIRESTORE_INDIVIDUAL_USER.parallelMarkets,
          accreditationStatus: "expired",
        },
      }
      expect(user.data()).to.deep.eq(expectedUser)
    })

    it("sets accreditation_status to failed when accreditation attempt status is rejected", async () => {
      // Stub the Accreditations API
      const stubbedResponse = _.cloneDeep(VALID_PM_INDIVIDUAL_ACCREDITATION_RESPONSE)
      stubbedResponse.accreditations[0].status = "rejected"
      stub.returns(new Promise((resolve) => resolve(new Response(JSON.stringify(stubbedResponse), {status: 200}))))

      await processAccreditationWebhook(WEBHOOK_INDIVIDUAL_PAYLOAD)
      const user = await getUsers().doc(PENDING_ADDRESS_INDIVIDUAL).get()
      const expectedUser = {
        ...PENDING_FIRESTORE_INDIVIDUAL_USER,
        parallelMarkets: {
          ...PENDING_FIRESTORE_INDIVIDUAL_USER.parallelMarkets,
          accreditationStatus: "failed",
        },
      }
      expect(user.data()).to.deep.eq(expectedUser)
    })

    it("sets accreditation_status to unaccredited when they indicate not accredited", async () => {
      // Stub the Accreditations API
      const stubbedResponse = _.cloneDeep(VALID_PM_INDIVIDUAL_ACCREDITATION_RESPONSE)
      stubbedResponse.indicatedUnaccredited = "123123987"
      stubbedResponse.accreditations = []
      stub.returns(new Promise((resolve) => resolve(new Response(JSON.stringify(stubbedResponse), {status: 200}))))

      await processAccreditationWebhook(WEBHOOK_INDIVIDUAL_PAYLOAD)
      const user = await getUsers().doc(PENDING_ADDRESS_INDIVIDUAL).get()
      const expectedUser = {
        ...PENDING_FIRESTORE_INDIVIDUAL_USER,
        parallelMarkets: {
          ...PENDING_FIRESTORE_INDIVIDUAL_USER.parallelMarkets,
          accreditationStatus: "unaccredited",
        },
      }
      expect(user.data()).to.deep.eq(expectedUser)
    })
  })

  describe("business", () => {
    it("sets accreditation_status to approved when accreditation attempt status is current", async () => {
      // Stub the Accreditations API
      stub.returns(
        new Promise((resolve) =>
          resolve(new Response(JSON.stringify(VALID_PM_BUSINESS_ACCREDITATION_RESPONSE), {status: 200})),
        ),
      )

      await processAccreditationWebhook(WEBHOOK_BUSINESS_PAYLOAD)
      const user = await getUsers().doc(PENDING_ADDRESS_BUSINESS).get()
      const expectedUser = {
        ...PENDING_FIRESTORE_BUSINESS_USER,
        parallelMarkets: {
          ...PENDING_FIRESTORE_BUSINESS_USER.parallelMarkets,
          accreditationStatus: "approved",
        },
      }
      expect(user.data()).to.deep.eq(expectedUser)
    })

    it("sets accreditation_status to pending_verification when accreditation attempt status is pending", async () => {
      // Stub the Accreditations API
      const stubbedResponse = _.cloneDeep(VALID_PM_BUSINESS_ACCREDITATION_RESPONSE)
      stubbedResponse.accreditations[0].status = "pending"
      stub.returns(new Promise((resolve) => resolve(new Response(JSON.stringify(stubbedResponse), {status: 200}))))
      await processAccreditationWebhook(WEBHOOK_BUSINESS_PAYLOAD)
      const user = await getUsers().doc(PENDING_ADDRESS_BUSINESS).get()
      // Their status is still pending, so nothing should have changed
      expect(user.data()).to.deep.eq(PENDING_FIRESTORE_BUSINESS_USER)
    })

    it("sets accreditation_status to pending_documents when attempt status is submitter_pending or third_party_pending", async () => {
      const statuses: Array<PmAccreditationStatus> = ["submitter_pending", "third_party_pending"]
      const expectedUser = {
        ...PENDING_FIRESTORE_BUSINESS_USER,
        parallelMarkets: {
          ...PENDING_FIRESTORE_BUSINESS_USER.parallelMarkets,
          accreditationStatus: "pending_documents",
        },
      }
      for (const status of statuses) {
        // Stub the Accreditations API
        const stubbedResponse = _.cloneDeep(VALID_PM_BUSINESS_ACCREDITATION_RESPONSE)
        stubbedResponse.accreditations[0].status = status
        stub.returns(new Promise((resolve) => resolve(new Response(JSON.stringify(stubbedResponse), {status: 200}))))
        await processAccreditationWebhook(WEBHOOK_BUSINESS_PAYLOAD)
        const user = await getUsers().doc(PENDING_ADDRESS_BUSINESS).get()
        user.data().parallelMarkets.accreditationStatus = "pending_documents"
        // Their status is still pending, so nothing should have changed
        expect(user.data()).to.deep.eq(expectedUser)
      }
    })

    it("sets accreditation_status to pending_documents when there are no accreditation attemps", async () => {
      // Stub the Accreditations API
      const stubbedResponse = _.cloneDeep(VALID_PM_BUSINESS_ACCREDITATION_RESPONSE)
      stubbedResponse.accreditations = []
      stub.returns(new Promise((resolve) => resolve(new Response(JSON.stringify(stubbedResponse), {status: 200}))))

      await processAccreditationWebhook(WEBHOOK_BUSINESS_PAYLOAD)
      const user = await getUsers().doc(PENDING_ADDRESS_BUSINESS).get()
      const expectedUser = {
        ...PENDING_FIRESTORE_BUSINESS_USER,
        parallelMarkets: {
          ...PENDING_FIRESTORE_BUSINESS_USER.parallelMarkets,
          accreditationStatus: "pending_documents",
        },
      }
      expect(user.data()).to.deep.eq(expectedUser)
    })

    it("sets accreditation_status to expired when accreditation attempt status is expired", async () => {
      // Stub the Accreditations API
      const stubbedResponse = _.cloneDeep(VALID_PM_BUSINESS_ACCREDITATION_RESPONSE)
      stubbedResponse.accreditations[0].status = "expired"
      stub.returns(new Promise((resolve) => resolve(new Response(JSON.stringify(stubbedResponse), {status: 200}))))

      await processAccreditationWebhook(WEBHOOK_BUSINESS_PAYLOAD)
      const user = await getUsers().doc(PENDING_ADDRESS_BUSINESS).get()
      const expectedUser = {
        ...PENDING_FIRESTORE_BUSINESS_USER,
        parallelMarkets: {
          ...PENDING_FIRESTORE_BUSINESS_USER.parallelMarkets,
          accreditationStatus: "expired",
        },
      }
      expect(user.data()).to.deep.eq(expectedUser)
    })

    it("sets accreditation_status to failed when accreditation attempt status is rejected", async () => {
      // Stub the Accreditations API
      const stubbedResponse = _.cloneDeep(VALID_PM_BUSINESS_ACCREDITATION_RESPONSE)
      stubbedResponse.accreditations[0].status = "rejected"
      stub.returns(new Promise((resolve) => resolve(new Response(JSON.stringify(stubbedResponse), {status: 200}))))

      await processAccreditationWebhook(WEBHOOK_BUSINESS_PAYLOAD)
      const user = await getUsers().doc(PENDING_ADDRESS_BUSINESS).get()
      const expectedUser = {
        ...PENDING_FIRESTORE_BUSINESS_USER,
        parallelMarkets: {
          ...PENDING_FIRESTORE_BUSINESS_USER.parallelMarkets,
          accreditationStatus: "failed",
        },
      }
      expect(user.data()).to.deep.eq(expectedUser)
    })

    it("sets accreditation_status to unaccredited when they indicate not accredited", async () => {
      // Stub the Accreditations API
      const stubbedResponse = _.cloneDeep(VALID_PM_BUSINESS_ACCREDITATION_RESPONSE)
      stubbedResponse.indicatedUnaccredited = "12301923128"
      stubbedResponse.accreditations = []
      stub.returns(new Promise((resolve) => resolve(new Response(JSON.stringify(stubbedResponse), {status: 200}))))

      await processAccreditationWebhook(WEBHOOK_BUSINESS_PAYLOAD)
      const user = await getUsers().doc(PENDING_ADDRESS_BUSINESS).get()
      const expectedUser = {
        ...PENDING_FIRESTORE_BUSINESS_USER,
        parallelMarkets: {
          ...PENDING_FIRESTORE_BUSINESS_USER.parallelMarkets,
          accreditationStatus: "unaccredited",
        },
      }
      expect(user.data()).to.deep.eq(expectedUser)
    })
  })
})
