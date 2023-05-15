import chai from "chai"
import {RulesTestContext, RulesTestEnvironment} from "@firebase/rules-unit-testing"
import {initializeFirebaseTestEnv} from "./utils"
import {getUsers} from "../src/db/db"
import {User, UserCommon, UserParallelMarkets} from "../src/db/dbTypes"

const expect = chai.expect

describe("db", () => {
  let testEnv: RulesTestEnvironment
  let testContext: RulesTestContext

  let users: FirebaseFirestore.CollectionReference<User>

  beforeEach(async () => {
    // initialize the test firestore
    ;({testEnv, testContext} = await initializeFirebaseTestEnv("goldfinch-frontend-test"))
    users = getUsers()
  })

  afterEach(async () => {
    await testEnv.clearFirestore()
  })

  describe("users", () => {
    describe("writes", () => {
      it("writes a parallel markets user without saving undefined fields", async () => {
        const user: UserCommon<UserParallelMarkets> = {
          address: "0x123",
          countryCode: "US",
          kycProvider: "parallelMarkets",
          parallelMarkets: {
            id: "inq",
            type: "individual",
            accreditationStatus: "approved",
            identityStatus: "approved",
            accreditationAccessRevocationAt: undefined,
            identityAccessRevocationAt: undefined,
            identityExpiresAt: undefined,
            accreditationExpiresAt: undefined,
          },
        }
        await users.doc("0x123").set(user)
        const savedUser = (await users.doc("0x123").get()).data()
        expect(savedUser).to.deep.eq({
          address: "0x123",
          countryCode: "US",
          kycProvider: "parallelMarkets",
          parallelMarkets: {
            id: "inq",
            type: "individual",
            accreditationStatus: "approved",
            identityStatus: "approved",
          },
        })
      })
    })

    describe("reads", () => {
      let updatedAt
      beforeEach(async () => {
        // We should bypass the FirestoreConverter that strips out nulls and undefined, because some entries in production
        // have null values. We want to assert that the typed converter system is still able to handle these entries
        updatedAt = new Date().getTime() / 1000
        const untypedUsersCollection = testContext.firestore().collection("test_users")

        // A persona user that doesn't have a kycProvider field
        await untypedUsersCollection.doc("0x123").set({
          address: "0x123",
          countryCode: "US",
          persona: {
            id: "inq",
            status: "approved",
          },
          updatedAt,
        })

        // A parallel markets user with null access revocations and expiries
        await untypedUsersCollection.doc("0x456").set({
          address: "0x456",
          countryCode: "US",
          kycProvider: "parallelmarkets",
          parallelMarkets: {
            id: "inq",
            type: "individual",
            accreditationStatus: "approved",
            identityStatus: "approved",
            accreditationExpiresAt: null,
            accreditationAccessRevocationAt: null,
            identityAccessRevocationAt: null,
          },
        })
      })

      it("reads a parallel markets user with null access revocations", async () => {
        const user = (await users.doc("0x456").get()).data()
        expect(user).to.deep.eq({
          address: "0x456",
          countryCode: "US",
          kycProvider: "parallelmarkets",
          parallelMarkets: {
            id: "inq",
            type: "individual",
            accreditationStatus: "approved",
            identityStatus: "approved",
          },
        })
      })

      it("reads a persona user missing the kycProvider field", async () => {
        const user = (await users.doc("0x123").get()).data()
        expect(user).to.deep.eq({
          address: "0x123",
          countryCode: "US",
          persona: {
            id: "inq",
            status: "approved",
          },
          updatedAt,
        })
      })
    })
  })
})
