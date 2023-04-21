import * as firebaseTesting from "@firebase/rules-unit-testing"
import * as admin from "firebase-admin"
import {ethers} from "ethers"
import {setTestConfig} from "../../src/config"
import {setTestFirestore, getUsers} from "../../src/db"
import {Request} from "express"
import {fake} from "sinon"
import {BaseProvider} from "@ethersproject/providers"
import {mockGetBlockchain} from "../../src/helpers"

import firestore = admin.firestore
import Firestore = firestore.Firestore
import {registerKyc} from "../../src"
import {expectResponse} from "../utils"
import {assertNonNullable} from "@goldfinch-eng/utils"

type FakeBlock = {
  number: number
  timestamp: number
}

describe("registerKyc", async () => {
  const testAccount = {
    address: "0xc34461018f970d343d5a25e4Ed28C4ddE6dcCc3F",
    privateKey: "0x50f9c471e3c454b506f39536c06bde77233144784297a95d35896b3be3dfc9d8",
  }
  const testWallet = new ethers.Wallet(testAccount.privateKey)
  const projectId = "goldfinch-frontend-test"

  let testFirestore: Firestore
  let testApp: admin.app.App
  let users: firestore.CollectionReference<firestore.DocumentData>

  const getEncodedPlaintext = (key: string) => {
    return JSON.stringify({
      key,
      provider: "parallel_markets",
    })
  }

  const getSignedMessage = async (key: string) => {
    return testWallet.signMessage(getEncodedPlaintext(key))
  }

  const genRegisterKycRequest = (
    address: string,
    key: string,
    signature: string,
    plaintext: string,
    signatureBlockNum?: number,
  ): Request => {
    return {
      headers: {
        "x-goldfinch-address": address,
        "x-goldfinch-signature": signature,
        "x-goldfinch-signature-block-num": signatureBlockNum,
        "x-goldfinch-signature-plaintext": plaintext,
      },
    } as unknown as Request
  }

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
    testApp = firebaseTesting.initializeAdminApp({projectId})
    testFirestore = testApp.firestore()
    setTestFirestore(testFirestore)
    setTestConfig({
      kyc: {allowed_origins: "http://localhost:3000"},
      slack: {token: "slackToken"},
      persona: {
        allowed_ips: "",
      },
    })
    users = getUsers()
  })

  afterEach(async () => {
    await firebaseTesting.clearFirestoreData({projectId})
  })

  after(() => {
    mockGetBlockchain(undefined)
  })

  describe("parallel markets", () => {
    describe("validating payload", () => {
      it("ensures key is present", async () => {
        // Missing the key!
        const badPlaintext = JSON.stringify({
          provider: "parallel_markets",
        })
        const sig = await testWallet.signMessage(badPlaintext)
        const request = genRegisterKycRequest(testAccount.address, "test_key", sig, badPlaintext, currentBlockNum)
        await registerKyc(request, expectResponse(400, {error: "Missing key"}))
      })

      it("ensures provider is present", async () => {
        // Missing the provider!
        const badPlaintext = JSON.stringify({
          key: "test_key",
        })
        const sig = await testWallet.signMessage(badPlaintext)
        const request = genRegisterKycRequest(testAccount.address, "test_key", sig, badPlaintext, currentBlockNum)
        await registerKyc(request, expectResponse(400, {error: "Missing provider"}))
      })

      it("ensures provider is valid is present", async () => {
        const badProviderPlaintext = JSON.stringify({
          key: "test_key",
          provider: "not_parallel_markets",
        })
        const sig = await testWallet.signMessage(badProviderPlaintext)
        const request = genRegisterKycRequest(
          testAccount.address,
          "test_key",
          sig,
          badProviderPlaintext,
          currentBlockNum,
        )
        await registerKyc(request, expectResponse(400, {error: "Invalid provider: not_parallel_markets"}))
      })
    })

    describe.skip("creating new user", () => {
      it("with correct fields", () => {
        // TODO
      })
    })

    describe.skip("updatings existing user", () => {
      it("resets revocations", () => {
        // TODO
      })

      it("overwrites fields", () => {
        // TODO
      })

      it("works for businesses", () => {
        // TODO
      })

      it("works for individualtes", () => {
        // TODO
      })

      it("sets country to US if resident or citizen", () => {
        // TODO
      })

      it("gives no accreditation if all documents invalid", () => {
        // TODO
      })

      it("does not pass identity if match level is not high", () => {
        // TODO
      })
    })
  })
})
