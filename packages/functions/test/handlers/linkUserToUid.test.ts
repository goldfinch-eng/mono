import chai, {expect} from "chai"
import chaiSubset from "chai-subset"
import * as admin from "firebase-admin"

chai.use(chaiSubset)
import firestore = admin.firestore
import Firestore = firestore.Firestore
import {Request} from "express"
import {assertNonNullable, presignedMintToMessage, presignedMintMessage} from "@goldfinch-eng/utils"
import {mockGetBlockchain} from "../../src/helpers"
import {expectResponse} from "../utils"
import {hardhat} from "@goldfinch-eng/protocol"
import {BaseProvider} from "@ethersproject/providers"
import {BigNumber, BytesLike, Wallet} from "ethers"
import {genLinkKycWithUidDeployment} from "../../src/handlers/linkUserToUid"
import {fake} from "sinon"
import * as firebaseTesting from "@firebase/rules-unit-testing"
import {setTestFirestore, getUsers} from "../../src/db"
const {deployments, web3, ethers, upgrades} = hardhat
import UniqueIdentityDeployment from "@goldfinch-eng/protocol/deployments/mainnet/UniqueIdentity.json"
import {HttpsFunction} from "firebase-functions/lib/cloud-functions"
import _ from "lodash"
import {setTestConfig} from "../../src/config"
export const UniqueIdentityAbi = UniqueIdentityDeployment.abi

const setupTest = deployments.createFixture(async ({getNamedAccounts}) => {
  const {protocol_owner: uidContractOwnerAddress} = await getNamedAccounts()
  const [, mainUserAddress, otherUserAddress, mintToAddress] = (await web3.eth.getAccounts()).map((address) =>
    address.toLowerCase(),
  )
  assertNonNullable(uidContractOwnerAddress)
  assertNonNullable(mainUserAddress)
  assertNonNullable(otherUserAddress)
  assertNonNullable(mintToAddress)

  const UniqueIdentity = await ethers.getContractFactory("TestUniqueIdentity")
  const uniqueIdentity = await upgrades.deployProxy(UniqueIdentity, [
    uidContractOwnerAddress,
    "https://app.goldfinch.finance",
  ])
  await uniqueIdentity.deployed()
  return {uniqueIdentity, uidContractOwnerAddress, mainUserAddress, otherUserAddress, mintToAddress}
})

const UNIQUE_IDENTITY_SIGNER_TEST_ACCOUNT = {
  address: "0xc34461018f970d343d5a25e4Ed28C4ddE6dcCc3F",
  privateKey: "0x50f9c471e3c454b506f39536c06bde77233144784297a95d35896b3be3dfc9d8",
}

const projectId = "goldfinch-frontend-test"

const PERSONA_USER_DATA = {
  countryCode: "ID",
  kycProvider: "persona",
  persona: {
    id: "inq_aaaaaaaaaaaaaaaaaaaaaaaa",
    status: "approved",
  },
}

const PARALLEL_MARKEYS_USER_DATA = {
  countryCode: "US",
  kycProvider: "parallelMarkets",
  parallelMarkets: {
    id: "v249dDfj==",
    type: "individual",
    identityStatus: "approved",
    accreditationStatus: "approved",
  },
}

const uidType = BigNumber.from(1)
const nonce = BigNumber.from(0)

describe("linkUserToUid", () => {
  let mainUserAddress: string
  let otherUserAddress: string
  let mintToAddress: string
  let uidContractOwnerAddress: string
  let chainId: string
  let signer: Wallet
  let testLinkKycToUid: HttpsFunction
  let uniqueIdentity: {address: string}
  let testFirestore: Firestore
  let testApp: admin.app.App
  let users: firestore.CollectionReference<firestore.DocumentData>
  let expiresAt: number
  let validMintPresigMessage: BytesLike
  let validMintSignature: string
  let validMintToPresigMessage: BytesLike
  let validMintToSignature: string
  let mintRequest: Request
  let mintToRequest: Request

  let currentBlockNum: number
  let currentBlockTimestamp: number

  let mainUser: Record<string, unknown>

  // Arbitrary signature expiry time chosen for the tests. Any signature expiry time we choose should be respected.
  const uniqueIdentitySignatureExpiryTime = 640

  const expectSuccessfulMintLink = async (fromAddress: string, customExpiresAt: number) => {
    const startedAt = Date.now()
    const presigMintMessage = presignedMintMessage(
      fromAddress,
      uidType,
      customExpiresAt,
      uniqueIdentity.address,
      BigNumber.from(0),
      parseInt(chainId),
    )
    const mintSig = await signer.signMessage(presigMintMessage)
    const mintRequest = {
      body: {msgSender: fromAddress, uidType, expiresAt: customExpiresAt, nonce},
      headers: {
        "x-goldfinch-address": UNIQUE_IDENTITY_SIGNER_TEST_ACCOUNT.address,
        "x-goldfinch-signature": mintSig,
        "x-goldfinch-signature-block-num": currentBlockNum,
        "x-goldfinch-signature-plaintext": presigMintMessage.toString(),
      },
    } as unknown as Request
    await testLinkKycToUid(
      mintRequest,
      expectResponse(200, {
        status: "success",
        message: `User's address ${fromAddress} is linked to the ${fromAddress} UID recipient address.`,
      }),
    )
    const endedAt = Date.now()
    const userDoc = await users.doc(fromAddress).get()
    expect(userDoc.exists).to.be.true
    expect(userDoc.data()).to.containSubset({
      address: fromAddress,
      uidRecipientAuthorizations: {[uidType.toString()]: fromAddress},
    })
    expect(userDoc.data()?.updatedAt).to.satisfy((updatedAt: number) => updatedAt >= startedAt && updatedAt <= endedAt)
    const uidTypeRecipientAuthorizations = userDoc.data()?.uidRecipientAuthorizations
    expect(uidTypeRecipientAuthorizations[uidType.toString()]).to.eq(fromAddress)
    expect(Object.keys(uidTypeRecipientAuthorizations).length).to.eq(1)
  }

  const expectSuccessfulMintToLink = async (fromAddress: string, recipientAddress: string, customExpiresAt: number) => {
    const startedAt = Date.now()
    console.log(`customExpiresAt: ${customExpiresAt}`)
    const presigMintToMessage = presignedMintToMessage(
      fromAddress,
      recipientAddress,
      uidType,
      customExpiresAt,
      uniqueIdentity.address,
      BigNumber.from(0),
      parseInt(chainId),
    )
    const mintToSig = await signer.signMessage(presigMintToMessage)
    const mintToRequest = {
      body: {msgSender: fromAddress, mintToAddress: recipientAddress, uidType, expiresAt: customExpiresAt, nonce},
      headers: {
        "x-goldfinch-address": UNIQUE_IDENTITY_SIGNER_TEST_ACCOUNT.address,
        "x-goldfinch-signature": mintToSig,
        "x-goldfinch-signature-block-num": currentBlockNum,
        "x-goldfinch-signature-plaintext": presigMintToMessage.toString(),
      },
    } as unknown as Request

    await testLinkKycToUid(
      mintToRequest,
      expectResponse(200, {
        status: "success",
        message: `User's address ${fromAddress} is linked to the ${recipientAddress} UID recipient address.`,
      }),
    )
    const endedAt = Date.now()
    const userDoc = await users.doc(fromAddress).get()
    expect(userDoc.exists).to.be.true
    expect(userDoc.data()).to.containSubset({
      address: fromAddress,
      uidRecipientAuthorizations: {[uidType.toString()]: recipientAddress},
    })
    expect(userDoc.data()?.updatedAt).to.satisfy((updatedAt: number) => updatedAt >= startedAt && updatedAt <= endedAt)
    const uidTypeRecipientAuthorizations = userDoc.data()?.uidRecipientAuthorizations
    expect(uidTypeRecipientAuthorizations[uidType.toString()]).to.eq(recipientAddress)
    expect(Object.keys(uidTypeRecipientAuthorizations).length).to.eq(1)
  }

  beforeEach(async () => {
    ;({uniqueIdentity, mainUserAddress, uidContractOwnerAddress, otherUserAddress, mintToAddress} = await setupTest())
    signer = new Wallet(UNIQUE_IDENTITY_SIGNER_TEST_ACCOUNT.privateKey)
    const block = await web3.eth.getBlock("latest")
    currentBlockNum = block.number
    currentBlockTimestamp = block.timestamp as number

    testApp = firebaseTesting.initializeAdminApp({projectId: projectId})
    testFirestore = testApp.firestore()
    setTestFirestore(testFirestore)
    setTestConfig({
      kyc: {allowed_origins: "http://localhost:3000"},
      persona: {allowed_ips: ""},
    })

    chainId = await hardhat.getChainId()
    testLinkKycToUid = genLinkKycWithUidDeployment({address: uniqueIdentity.address, abi: UniqueIdentityAbi})
    const mock = fake.returns(ethers.provider as BaseProvider)
    mockGetBlockchain(mock)
    expiresAt = currentBlockTimestamp + uniqueIdentitySignatureExpiryTime
    validMintPresigMessage = presignedMintMessage(
      mainUserAddress,
      uidType,
      expiresAt,
      uniqueIdentity.address,
      BigNumber.from(0),
      parseInt(chainId),
    )
    validMintSignature = await signer.signMessage(validMintPresigMessage)
    validMintToPresigMessage = presignedMintToMessage(
      mainUserAddress,
      mintToAddress,
      uidType,
      expiresAt,
      uniqueIdentity.address,
      BigNumber.from(0),
      parseInt(chainId),
    )
    validMintToSignature = await signer.signMessage(validMintToPresigMessage)
    mintRequest = {
      body: {msgSender: mainUserAddress, uidType, expiresAt, nonce},
      headers: {
        "x-goldfinch-address": UNIQUE_IDENTITY_SIGNER_TEST_ACCOUNT.address,
        "x-goldfinch-signature": validMintSignature,
        "x-goldfinch-signature-block-num": currentBlockNum,
        "x-goldfinch-signature-plaintext": validMintPresigMessage.toString(),
      },
    } as unknown as Request
    mintToRequest = {
      body: {msgSender: mainUserAddress, mintToAddress, uidType, expiresAt, nonce},
      headers: {
        "x-goldfinch-address": UNIQUE_IDENTITY_SIGNER_TEST_ACCOUNT.address,
        "x-goldfinch-signature": validMintToSignature,
        "x-goldfinch-signature-block-num": currentBlockNum,
        "x-goldfinch-signature-plaintext": validMintToPresigMessage.toString(),
      },
    } as unknown as Request
  })

  describe("with an existing parallel markets user in firestore", () => {
    beforeEach(async () => {
      mainUser = {
        ...PARALLEL_MARKEYS_USER_DATA,
        address: mainUserAddress,
        updatedAt: Date.now(),
      }
      users = getUsers(testFirestore)
      await users.doc(mainUserAddress).set(mainUser)
    })

    afterEach(async () => {
      await firebaseTesting.clearFirestoreData({projectId})
    })

    it("links a user to a UID recipient address for a valid mintTo operation", async () => {
      await expectSuccessfulMintToLink(mainUserAddress, mintToAddress, expiresAt)
    })

    it("links a user to a UID recipient address for a valid mint operation", async () => {
      await expectSuccessfulMintLink(mainUserAddress, expiresAt)
    })

    it("links a user to a UID recipient address for a valid mintTo operation if a preexisting signature has already expired", async () => {
      await expectSuccessfulMintLink(mainUserAddress, expiresAt)
      await ethers.provider.send("evm_setNextBlockTimestamp", [
        (await ethers.provider.getBlock("latest")).timestamp + uniqueIdentitySignatureExpiryTime + 1,
      ])
      await ethers.provider.send("evm_mine", [])
      await expectSuccessfulMintToLink(
        mainUserAddress,
        mintToAddress,
        (await ethers.provider.getBlock("latest")).timestamp + uniqueIdentitySignatureExpiryTime,
      )
    })

    it("links a user to a UID recipient address for a valid mint operation if a preexisting signature has already expired", async () => {
      await expectSuccessfulMintToLink(mainUserAddress, mintToAddress, expiresAt)
      await ethers.provider.send("evm_setNextBlockTimestamp", [
        (await ethers.provider.getBlock("latest")).timestamp + uniqueIdentitySignatureExpiryTime + 1,
      ])
      await ethers.provider.send("evm_mine", [])
      await expectSuccessfulMintLink(
        mainUserAddress,
        (await ethers.provider.getBlock("latest")).timestamp + uniqueIdentitySignatureExpiryTime,
      )
    })

    it("throws a 400 error when the user already received a signature to mint a UID of tokenId linked to a different UID recipient", async () => {
      await expectSuccessfulMintToLink(mainUserAddress, otherUserAddress, expiresAt)
      await testLinkKycToUid(
        mintToRequest,
        expectResponse(400, {
          status: "error",
          message: `Address ${mainUserAddress} has already been linked to a different UID recipient address ${otherUserAddress}. Can link a different UID recipient address when the original signature expires.`,
        }),
      )
      const userDoc = await users.doc(mainUserAddress).get()
      expect(userDoc.exists).to.be.true
      expect(userDoc.data()).to.containSubset(_.omit(mainUser, "updatedAt"))
      const uidTypeRecipientAuthorizations = userDoc.data()?.uidRecipientAuthorizations
      expect(uidTypeRecipientAuthorizations[uidType.toString()]).to.eq(otherUserAddress)
      expect(Object.keys(uidTypeRecipientAuthorizations).length).to.eq(1)
    })

    it("throws a 400 error when a uidRecipient already owns a UID of tokenId", async () => {
      await uniqueIdentity._mintForTest(mintToAddress, uidType, BigNumber.from(1), web3.utils.asciiToHex(""), {
        from: uidContractOwnerAddress,
      })
      await testLinkKycToUid(
        mintToRequest,
        expectResponse(400, {
          status: "error",
          message: `UID recipient address ${mintToAddress} already owns a UID of type ${uidType}`,
        }),
      )
      await uniqueIdentity._mintForTest(mainUserAddress, uidType, BigNumber.from(1), web3.utils.asciiToHex(""), {
        from: uidContractOwnerAddress,
      })
      await testLinkKycToUid(
        mintRequest,
        expectResponse(400, {
          status: "error",
          message: `UID recipient address ${mainUserAddress} already owns a UID of type ${uidType}`,
        }),
      )
    })

    it("throws a 400 error when a msg sender already owns a UID of tokenId", async () => {
      await uniqueIdentity._mintForTest(mainUserAddress, uidType, BigNumber.from(1), web3.utils.asciiToHex(""), {
        from: uidContractOwnerAddress,
      })
      await testLinkKycToUid(
        mintRequest,
        expectResponse(400, {
          status: "error",
          message: `UID recipient address ${mainUserAddress} already owns a UID of type ${uidType}`,
        }),
      )
      await testLinkKycToUid(
        mintToRequest,
        expectResponse(400, {
          status: "error",
          message: `User with address ${mainUserAddress} already owns a UID of type ${uidType}`,
        }),
      )
    })

    it("throws a 400 error when the signature has expired", async () => {
      const modifiedRequest = mintRequest
      modifiedRequest.body.expiresAt = 0
      await testLinkKycToUid(
        modifiedRequest,
        expectResponse(400, {
          status: "error",
          message: "Signature has expired",
        }),
      )
    })

    it("throws a 401 error when an invalid presigned message was used to generate the signature", async () => {
      const modifiedRequest = mintRequest
      modifiedRequest.headers["x-goldfinch-signature-plaintext"] = "invalid presigned message"
      await testLinkKycToUid(
        modifiedRequest,
        expectResponse(401, {
          error: "Invalid address or signature.",
        }),
      )
    })
    it("throws a 401 error when another signer signed the signature in the headers", async () => {
      const modifiedRequest = mintRequest
      modifiedRequest.headers["x-goldfinch-address"] = otherUserAddress
      await testLinkKycToUid(
        modifiedRequest,
        expectResponse(401, {
          error: "Invalid address or signature.",
        }),
      )
    })
  })

  describe("with an existing persona user in firestore", () => {
    beforeEach(async () => {
      mainUser = {
        ...PERSONA_USER_DATA,
        address: mainUserAddress,
        updatedAt: Date.now(),
      }
      users = getUsers(testFirestore)
      await users.doc(mainUserAddress).set(mainUser)
    })

    afterEach(async () => {
      await firebaseTesting.clearFirestoreData({projectId})
    })

    it("links a user to a UID recipient address for a valid mintTo operation", async () => {
      await expectSuccessfulMintToLink(mainUserAddress, mintToAddress, expiresAt)
    })

    it("links a user to a UID recipient address for a valid mint operation", async () => {
      await expectSuccessfulMintLink(mainUserAddress, expiresAt)
    })

    it("links a user to a UID recipient address for a valid mintTo operation if a preexisting signature has already expired", async () => {
      await expectSuccessfulMintLink(mainUserAddress, expiresAt)
      await ethers.provider.send("evm_setNextBlockTimestamp", [
        (await ethers.provider.getBlock("latest")).timestamp + uniqueIdentitySignatureExpiryTime + 1,
      ])
      await ethers.provider.send("evm_mine", [])
      await expectSuccessfulMintToLink(
        mainUserAddress,
        mintToAddress,
        (await ethers.provider.getBlock("latest")).timestamp + uniqueIdentitySignatureExpiryTime,
      )
    })

    it("links a user to a UID recipient address for a valid mint operation if a preexisting signature has already expired", async () => {
      await expectSuccessfulMintToLink(mainUserAddress, mintToAddress, expiresAt)
      await ethers.provider.send("evm_setNextBlockTimestamp", [
        (await ethers.provider.getBlock("latest")).timestamp + uniqueIdentitySignatureExpiryTime + 1,
      ])
      await ethers.provider.send("evm_mine", [])
      await expectSuccessfulMintLink(
        mainUserAddress,
        (await ethers.provider.getBlock("latest")).timestamp + uniqueIdentitySignatureExpiryTime,
      )
    })

    it("throws a 400 error when the user already received a signature to mint a UID of tokenId linked to a different UID recipient", async () => {
      let userDoc = await users.doc(mainUserAddress).get()
      console.log("user data before test")
      console.log(userDoc.data())
      await expectSuccessfulMintToLink(mainUserAddress, otherUserAddress, expiresAt)
      await testLinkKycToUid(
        mintToRequest,
        expectResponse(400, {
          status: "error",
          message: `Address ${mainUserAddress} has already been linked to a different UID recipient address ${otherUserAddress}. Can link a different UID recipient address when the original signature expires.`,
        }),
      )
      userDoc = await users.doc(mainUserAddress).get()
      console.log("user data after test")
      console.log(userDoc.data())
      expect(userDoc.exists).to.be.true
      expect(userDoc.data()).to.containSubset(_.omit(mainUser, "updatedAt"))
      const uidTypeRecipientAuthorizations = userDoc.data()?.uidRecipientAuthorizations
      expect(uidTypeRecipientAuthorizations[uidType.toString()]).to.eq(otherUserAddress)
      expect(Object.keys(uidTypeRecipientAuthorizations).length).to.eq(1)
    })

    it("throws a 400 error when a uidRecipient already owns a UID of tokenId", async () => {
      await uniqueIdentity._mintForTest(mintToAddress, uidType, BigNumber.from(1), web3.utils.asciiToHex(""), {
        from: uidContractOwnerAddress,
      })
      await testLinkKycToUid(
        mintToRequest,
        expectResponse(400, {
          status: "error",
          message: `UID recipient address ${mintToAddress} already owns a UID of type ${uidType}`,
        }),
      )
      await uniqueIdentity._mintForTest(mainUserAddress, uidType, BigNumber.from(1), web3.utils.asciiToHex(""), {
        from: uidContractOwnerAddress,
      })
      await testLinkKycToUid(
        mintRequest,
        expectResponse(400, {
          status: "error",
          message: `UID recipient address ${mainUserAddress} already owns a UID of type ${uidType}`,
        }),
      )
    })

    it("throws a 400 error when a msg sender already owns a UID of tokenId", async () => {
      await uniqueIdentity._mintForTest(mainUserAddress, uidType, BigNumber.from(1), web3.utils.asciiToHex(""), {
        from: uidContractOwnerAddress,
      })
      await testLinkKycToUid(
        mintRequest,
        expectResponse(400, {
          status: "error",
          message: `UID recipient address ${mainUserAddress} already owns a UID of type ${uidType}`,
        }),
      )
      await testLinkKycToUid(
        mintToRequest,
        expectResponse(400, {
          status: "error",
          message: `User with address ${mainUserAddress} already owns a UID of type ${uidType}`,
        }),
      )
    })

    it("throws a 400 error when the signature has expired", async () => {
      const modifiedRequest = mintRequest
      modifiedRequest.body.expiresAt = 0
      await testLinkKycToUid(
        modifiedRequest,
        expectResponse(400, {
          status: "error",
          message: "Signature has expired",
        }),
      )
    })

    it("throws a 401 error when an invalid presigned message was used to generate the signature", async () => {
      const modifiedRequest = mintRequest
      modifiedRequest.headers["x-goldfinch-signature-plaintext"] = "invalid presigned message"
      await testLinkKycToUid(
        modifiedRequest,
        expectResponse(401, {
          error: "Invalid address or signature.",
        }),
      )
    })
    it("throws a 401 error when another signer signed the signature in the headers", async () => {
      const modifiedRequest = mintRequest
      modifiedRequest.headers["x-goldfinch-address"] = otherUserAddress
      await testLinkKycToUid(
        modifiedRequest,
        expectResponse(401, {
          error: "Invalid address or signature.",
        }),
      )
    })
  })

  it("throws an error when the requested user to link does not exist and the user is not on a KYC'ed user list", async () => {
    await testLinkKycToUid(
      mintRequest,
      expectResponse(404, {
        status: "error",
        message: `User with address ${mainUserAddress} not found`,
      }),
    )
  })
})
