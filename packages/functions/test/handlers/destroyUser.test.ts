import chai from "chai"
import chaiSubset from "chai-subset"
import {BaseProvider} from "@ethersproject/providers"
import {fake} from "sinon"

import {destroyUser} from "../../src"
import {RulesTestEnvironment, RulesTestContext} from "@firebase/rules-unit-testing"
import firebase from "firebase/compat/app"
import {initializeFirebaseTestEnv} from "../../src/db"

chai.use(chaiSubset)
const expect = chai.expect
import {Request} from "express"
import {assertNonNullable} from "@goldfinch-eng/utils"
import {mockGetBlockchain} from "../../src/helpers"
import {ethers} from "ethers"
import {expectResponse, expectSize} from "../utils"

type FakeBlock = {
  number: number
  timestamp: number
}

const encodePlaintext = (addressToDestroy: string, burnedUidType: number): string => {
  return ethers.utils.defaultAbiCoder.encode(["address", "uint8"], [addressToDestroy, burnedUidType])
}

describe("destroyUser", () => {
  const testAccount = {
    address: "0xc34461018f970d343d5a25e4Ed28C4ddE6dcCc3F",
    privateKey: "0x50f9c471e3c454b506f39536c06bde77233144784297a95d35896b3be3dfc9d8",
  }
  const testWallet = new ethers.Wallet(testAccount.privateKey)

  let testEnv: RulesTestEnvironment
  let testContext: RulesTestContext
  let users: firebase.firestore.CollectionReference<firebase.firestore.DocumentData>
  let destroyedUsers: firebase.firestore.CollectionReference<firebase.firestore.DocumentData>

  const currentBlockNum = 84
  const fiveMinAgoBlockNum = 80
  const futureBlockNum = 85

  const currentBlockTimestamp = 1629819124
  const timestampByBlockNum: {[blockNum: number]: number} = {
    [currentBlockNum]: currentBlockTimestamp,
    [fiveMinAgoBlockNum]: currentBlockTimestamp - 60 * 5 - 1,
    [futureBlockNum]: currentBlockTimestamp + 1,
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

  beforeEach(async () => {
    ;({testEnv, testContext} = await initializeFirebaseTestEnv("goldfinch-frontend-test"))
    users = testContext.firestore().collection("test_users")
    destroyedUsers = testContext.firestore().collection("test_destroyedUsers")
  })

  after(() => {
    mockGetBlockchain(undefined)
  })

  afterEach(async () => {
    await testEnv.clearFirestore()
  })

  const generateDestroyUserRequest = (
    address: string,
    signature: string,
    signatureBlockNum: number | string | undefined,
    addressToDestroy?: string,
    burnedUidType?: string,
  ): Request => {
    const encodedPlaintext = encodePlaintext(addressToDestroy || "", burnedUidType ? parseInt(burnedUidType) : 0)
    return {
      headers: {
        "x-goldfinch-address": address,
        "x-goldfinch-signature": signature,
        "x-goldfinch-signature-block-num": signatureBlockNum,
        "x-goldfinch-signature-plaintext": encodedPlaintext,
      },
    } as unknown as Request
  }

  describe("with valid address and signature and block number", () => {
    const user = {
      address: testAccount.address,
      countryCode: "ID",
      persona: {
        id: "inq_aaaaaaaaaaaaaaaaaaaaaaaa",
        status: "approved",
      },
      updatedAt: Date.now(),
    }

    describe("user doesn't exist", () => {
      it("returns 200", async () => {
        // Firestore preconditions
        await expectSize(users, 0)
        await expectSize(destroyedUsers, 0)

        await users.doc(testAccount.address.toLowerCase()).delete()
        await destroyUser(
          generateDestroyUserRequest(
            testAccount.address,
            await testWallet.signMessage(encodePlaintext(testAccount.address, 1)),
            currentBlockNum,
            testAccount.address,
            "1",
          ),
          expectResponse(200, {status: "success"}),
        )

        // Firestore postconditions
        await expectSize(users, 0)
        await expectSize(destroyedUsers, 0)
      })
    })

    describe("user exists", () => {
      beforeEach(async () => {
        await users.doc(testAccount.address.toLowerCase()).set(user)
      })

      describe("and the persona status isn't approved", () => {
        it("returns 409", async () => {
          // Firestore preconditions
          await expectSize(users, 1)
          await expectSize(destroyedUsers, 0)

          await users.doc(testAccount.address.toLowerCase()).update({
            ...user,
            persona: {
              id: user.persona.id,
              status: "denied",
            },
          })

          const sig = await testWallet.signMessage(encodePlaintext(testAccount.address, 1))
          await destroyUser(
            generateDestroyUserRequest(testAccount.address, sig, currentBlockNum, testAccount.address, "1"),
            expectResponse(409, {status: "error", message: "Can only delete users with 'approved' status"}),
          )

          // Firestore postconditions
          await expectSize(users, 1)
          await expectSize(destroyedUsers, 0)
        })
      })

      describe("first deletion", () => {
        it("deletes the user and creates new document in destroyedUsers", async () => {
          // Firestore preconditions
          await expectSize(users, 1)
          await expectSize(destroyedUsers, 0)

          const sig = await testWallet.signMessage(encodePlaintext(testAccount.address, 1))
          await destroyUser(
            generateDestroyUserRequest(testAccount.address, sig, currentBlockNum, testAccount.address, "1"),
            expectResponse(200, {status: "success"}),
          )

          // Firestore postconditions
          await expectSize(users, 0)
          await expectSize(destroyedUsers, 1)
          const destroyedUserInstance = await destroyedUsers.doc(testAccount.address.toLowerCase()).get()
          expect(destroyedUserInstance.data()).containSubset({
            deletions: [
              {
                countryCode: "ID",
                burnedUidType: "1",
                persona: {
                  id: "inq_aaaaaaaaaaaaaaaaaaaaaaaa",
                  status: "approved",
                },
              },
            ],
          })
        })
      })

      describe("subsequent deletions", () => {
        beforeEach(async () => {
          const sig = await testWallet.signMessage(encodePlaintext(testAccount.address, 1))
          await destroyUser(
            generateDestroyUserRequest(testAccount.address, sig, currentBlockNum, testAccount.address, "1"),
            expectResponse(200, {status: "success"}),
          )
        })

        it("deletes the user and appends to existing document in destroyedUsers", async () => {
          // Firestore preconditions
          await expectSize(users, 0)
          await expectSize(destroyedUsers, 1)
          let destroyedUserInstance = await destroyedUsers.doc(testAccount.address.toLowerCase()).get()
          expect(destroyedUserInstance.data()?.deletions.length).to.equal(1)

          await users.doc(testAccount.address.toLowerCase()).set(user)
          const sig = await testWallet.signMessage(encodePlaintext(testAccount.address, 1))
          await destroyUser(
            generateDestroyUserRequest(testAccount.address, sig, currentBlockNum, testAccount.address, "1"),
            expectResponse(200, {status: "success"}),
          )

          // Firestore postconditions
          await expectSize(users, 0)
          await expectSize(destroyedUsers, 1)

          destroyedUserInstance = await destroyedUsers.doc(testAccount.address.toLowerCase()).get()
          expect(destroyedUserInstance.data()).containSubset({
            deletions: [
              {
                countryCode: "ID",
                burnedUidType: "1",
                persona: {
                  id: "inq_aaaaaaaaaaaaaaaaaaaaaaaa",
                  status: "approved",
                },
              },
              {
                countryCode: "ID",
                burnedUidType: "1",
                persona: {
                  id: "inq_aaaaaaaaaaaaaaaaaaaaaaaa",
                  status: "approved",
                },
              },
            ],
          })
        })
      })
    })
  })

  describe("validation", async () => {
    it("checks if address is present", async () => {
      const sig = await testWallet.signMessage(encodePlaintext(testAccount.address, 1))
      await destroyUser(
        generateDestroyUserRequest("", sig, currentBlockNum, testAccount.address, "1"),
        expectResponse(400, {error: "Address not provided."}),
      )
    })

    it("checks if the signature is present", async () => {
      await destroyUser(
        generateDestroyUserRequest(testAccount.address, "", currentBlockNum, testAccount.address, "1"),
        expectResponse(400, {error: "Signature not provided."}),
      )
    })

    it("returns an error if the plaintext is missing", async () => {
      const request = {
        headers: {
          "x-goldfinch-address": testAccount.address,
          "x-goldfinch-signature": await testWallet.signMessage(encodePlaintext(testAccount.address, 1)),
          "x-goldfinch-signature-block-num": currentBlockNum,
        },
      } as unknown as Request
      await destroyUser(request, expectResponse(400, {error: "Signature plaintext not provided."}))
    })

    it("checks if the signature block number is present", async () => {
      const sig = await testWallet.signMessage(encodePlaintext(testAccount.address, 1))
      await destroyUser(
        generateDestroyUserRequest(testAccount.address, sig, undefined, testAccount.address, "1"),
        expectResponse(400, {error: "Signature block number not provided."}),
      )
    })

    it("returns an error if the signature is incorrect", async () => {
      const sig =
        "0xaf75579e99f8810b5c009041961852a4872d3b19031a283ff8ea451854ac072331610c5edaf6ec7430a11cea0f19a2a111ce3b5c52ee93b933fd91e2f9336ad71c"
      const req = generateDestroyUserRequest(testAccount.address, sig, currentBlockNum, testWallet.address, "1")
      await destroyUser(req, expectResponse(401, {error: "Invalid address or signature."}))
    })

    it("returns an error if the signature block number is invalid", async () => {
      const sig = await testWallet.signMessage(encodePlaintext(testAccount.address, 1))
      const req = generateDestroyUserRequest(testAccount.address, sig, "foo", testWallet.address, "1")
      await destroyUser(req, expectResponse(400, {error: "Invalid signature block number."}))
    })

    it("returns an error if the signature block number corresponds to an expired timestamp", async () => {
      const sig = await testWallet.signMessage(encodePlaintext(testAccount.address, 1))
      const req = generateDestroyUserRequest(testAccount.address, sig, fiveMinAgoBlockNum, testAccount.address, "1")
      await destroyUser(req, expectResponse(401, {error: "Signature expired."}))
    })

    it("returns an error if the signature block number is in the future", async () => {
      const sig = await testWallet.signMessage(encodePlaintext(testAccount.address, 1))
      const req = generateDestroyUserRequest(testAccount.address, sig, futureBlockNum, testAccount.address, "1")
      await destroyUser(req, expectResponse(401, {error: "Unexpected signature block number: 84 < 85"}))
    })

    it("returns an error if the signature is correct but signer is not in allow list", async () => {
      const wallet = ethers.Wallet.createRandom()
      const sig = await wallet.signMessage(encodePlaintext(testWallet.address, 1))
      const req = generateDestroyUserRequest(wallet.address, sig, currentBlockNum, testWallet.address, "1")
      await destroyUser(req, expectResponse(403, {error: `Signer ${wallet.address} not allowed to call this function`}))
    })

    it("checks the burned uid type in the signature is a valid UID type", async () => {
      const sig = await testWallet.signMessage(encodePlaintext(testWallet.address, 99))
      const req = generateDestroyUserRequest(testWallet.address, sig, currentBlockNum, testWallet.address, "99")
      await destroyUser(req, expectResponse(400, {status: "error", message: "Bad plaintext"}))
    })
  })
})
