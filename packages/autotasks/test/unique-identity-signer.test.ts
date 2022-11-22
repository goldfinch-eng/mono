import chai from "chai"
import hre from "hardhat"
import sinon from "sinon"
import AsPromised from "chai-as-promised"
chai.use(AsPromised)

import {getProtocolOwner, OWNER_ROLE, SIGNER_ROLE} from "@goldfinch-eng/protocol/blockchain_scripts/deployHelpers"
import {ethers, Signer, Wallet} from "ethers"
import {hardhat} from "@goldfinch-eng/protocol"
import {BN, deployAllContracts} from "@goldfinch-eng/protocol/test/testHelpers"
import {
  assertNonNullable,
  USAccreditedIndividualsList,
  USAccreditedEntitiesList,
  NonUSEntitiesList,
  KYC,
  FetchKYCFunction,
  caseInsensitiveIncludes,
  presignedBurnMessage,
} from "@goldfinch-eng/utils"

const {deployments, web3} = hardhat
import * as uniqueIdentitySigner from "../unique-identity-signer"
import {TestUniqueIdentityInstance} from "packages/protocol/typechain/truffle"
import {UniqueIdentity} from "packages/protocol/typechain/ethers"
import {UNIQUE_IDENTITY_ABI} from "../unique-identity-signer"
import axios from "axios"

const TEST_TIMEOUT = 30000

function fetchStubbedKycStatus(kyc: KYC): FetchKYCFunction {
  return async (_) => {
    return Promise.resolve(kyc)
  }
}

const fetchEligibleKycStatus: FetchKYCFunction = fetchStubbedKycStatus({
  status: "approved",
  countryCode: "CA",
  residency: "non-us",
})

const TEST_ACCOUNT = {
  address: "0xc34461018f970d343d5a25e4Ed28C4ddE6dcCc3F",
  privateKey: "0x50f9c471e3c454b506f39536c06bde77233144784297a95d35896b3be3dfc9d8",
}

const setupTest = deployments.createFixture(async ({deployments, getNamedAccounts}) => {
  const {protocol_owner} = await getNamedAccounts()
  const [, anotherUser, anotherUser2] = await web3.eth.getAccounts()
  assertNonNullable(protocol_owner)
  assertNonNullable(anotherUser)
  assertNonNullable(anotherUser2)

  const {uniqueIdentity, go} = await deployAllContracts(deployments)
  return {uniqueIdentity, go, owner: protocol_owner, anotherUser, anotherUser2}
})

describe("unique-identity-signer", () => {
  let owner: string
  let anotherUser: string
  let anotherUser2: string
  let uniqueIdentity: TestUniqueIdentityInstance
  let ethersUniqueIdentity: UniqueIdentity
  let signer: Signer
  let anotherUserSigner: Signer
  let network: ethers.providers.Network
  let validAuthAnotherUser
  let nonUSIdType
  let usAccreditedIdType
  let usNonAccreditedIdType
  let fetchKYCFunction: FetchKYCFunction
  const sandbox = sinon.createSandbox()

  beforeEach(async () => {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;({uniqueIdentity, owner, anotherUser, anotherUser2} = await setupTest())
    signer = hre.ethers.provider.getSigner(await getProtocolOwner())
    anotherUserSigner = hre.ethers.provider.getSigner(anotherUser)
    ethersUniqueIdentity = new ethers.Contract(uniqueIdentity.address, UNIQUE_IDENTITY_ABI, signer) as UniqueIdentity
    assertNonNullable(signer.provider, "Signer provider is null")
    network = await signer.provider.getNetwork()

    await uniqueIdentity.grantRole(OWNER_ROLE, owner, {from: owner})
    await uniqueIdentity.grantRole(SIGNER_ROLE, await signer.getAddress(), {from: owner})
    sandbox.stub(axios, "post").resolves({status: 200})
  })

  afterEach(() => {
    sandbox.restore()
  })

  describe("main", () => {
    let latestBlockNum: number
    let validExpiryTimestamp: number
    let wallet
    beforeEach(async () => {
      wallet = new Wallet(TEST_ACCOUNT.privateKey)
      latestBlockNum = (await signer.provider?.getBlock("latest"))?.number as number
      const currentBlock = await signer.provider?.getBlock(latestBlockNum)
      assertNonNullable(currentBlock)
      validExpiryTimestamp = currentBlock.timestamp + 100000
      validAuthAnotherUser = {
        "x-goldfinch-address": anotherUser,
        "x-goldfinch-signature": await anotherUserSigner.signMessage(`Sign in to Goldfinch: ${latestBlockNum}`),
        "x-goldfinch-signature-plaintext": await wallet.signMessage(`Sign in to Goldfinch: ${latestBlockNum}`),
        "x-goldfinch-signature-block-num": latestBlockNum.toString(),
      }
      nonUSIdType = await uniqueIdentity.ID_TYPE_0()
      usAccreditedIdType = await uniqueIdentity.ID_TYPE_1()
      usNonAccreditedIdType = await uniqueIdentity.ID_TYPE_2()
    })

    it("forwards signature headers to the KYC function and verifies signature", async () => {
      const expectedAuth = {
        "x-goldfinch-address": TEST_ACCOUNT.address,
        "x-goldfinch-signature": await wallet.signMessage("Sign in to Goldfinch: 3"),
        "x-goldfinch-signature-plaintext": "Sign in to Goldfinch: 3",
        "x-goldfinch-signature-block-num": "3",
      }
      const fetchFunction: FetchKYCFunction = ({auth, chainId}) => {
        // No other headers should be present
        expect(auth).to.deep.equal(expectedAuth)
        return fetchEligibleKycStatus({auth, chainId})
      }
      const inputHeaders = {
        "x-some-random-header": "test",
        ...expectedAuth,
      }

      // Run handler
      await expect(
        uniqueIdentitySigner.main({
          auth: inputHeaders,
          signer,
          network,
          uniqueIdentity: ethersUniqueIdentity,
          fetchKYCStatus: fetchFunction,
        })
      ).to.be.fulfilled
    })

    describe("auth headers", () => {
      let auth
      beforeEach(() => {
        auth = {
          "x-goldfinch-address": anotherUser,
          "x-goldfinch-signature": "test_signature",
          "x-goldfinch-signature-plaintext": "plaintext",
          "x-goldfinch-signature-block-num": "fake_block_number",
        }
      })

      describe("missing x-goldfinch-signature", () => {
        it("throws an error", async () => {
          delete auth["x-goldfinch-signature"]
          await expect(
            uniqueIdentitySigner.main({
              auth,
              signer,
              network,
              uniqueIdentity: ethersUniqueIdentity,
              fetchKYCStatus: fetchKYCFunction,
            })
          ).to.be.rejectedWith(/auth does not conform/)
        })
      })

      describe("missing x-goldfinch-signature-block-num", () => {
        it("throws an error", async () => {
          delete auth["x-goldfinch-signature-block-num"]
          await expect(
            uniqueIdentitySigner.main({
              auth,
              signer,
              network,
              uniqueIdentity: ethersUniqueIdentity,
              fetchKYCStatus: fetchKYCFunction,
            })
          ).to.be.rejectedWith(/auth does not conform/)
        })
      })

      describe("missing x-goldfinch-address", () => {
        it("throws an error", async () => {
          delete auth["x-goldfinch-address"]
          await expect(
            uniqueIdentitySigner.main({
              auth,
              signer,
              network,
              uniqueIdentity: ethersUniqueIdentity,
              fetchKYCStatus: fetchKYCFunction,
            })
          ).to.be.rejectedWith(/auth does not conform/)
        })
      })

      describe("missing x-goldfinch-signature-plaintext", () => {
        it("throws an error", async () => {
          delete auth["x-goldfinch-signature-plaintext"]
          await expect(
            uniqueIdentitySigner.main({
              auth,
              signer,
              network,
              uniqueIdentity: ethersUniqueIdentity,
              fetchKYCStatus: fetchKYCFunction,
            })
          ).to.be.rejectedWith(/auth does not conform/)
        })
      })

      it("throws an error if the signature is incorrect", async () => {
        const invalidSignature =
          "0xaf75579e99f8810b5c009041961852a4872d3b19031a283ff8ea451854ac072331610c5edaf6ec7430a11cea0f19a2a111ce3b5c52ee93b933fd91e2f9336ad71c"
        await expect(
          uniqueIdentitySigner.main({
            auth: {
              "x-goldfinch-address": TEST_ACCOUNT.address,
              "x-goldfinch-signature": invalidSignature,
              "x-goldfinch-signature-block-num": latestBlockNum.toString(),
              "x-goldfinch-signature-plaintext": `Sign in to Goldfinch: ${latestBlockNum}`,
            },
            signer,
            network,
            uniqueIdentity: ethersUniqueIdentity,
            fetchKYCStatus: fetchStubbedKycStatus({status: "approved", countryCode: "US"}),
          })
        ).to.eventually.be.rejectedWith("Invalid address or signature.")
      })

      it("throws an error if the signature block number is invalid", async () => {
        const validSignatureInvalidBlockNum =
          "0xf55449d7cea45a1537616da2ca9300623ec8c74888868209a4b02c19990e7d884f5835a4bc56218cf6e2d72d6d2351b2f0c52717159643025a70e2d3d25a7ac21c"
        await expect(
          uniqueIdentitySigner.main({
            auth: {
              "x-goldfinch-address": TEST_ACCOUNT.address,
              "x-goldfinch-signature": validSignatureInvalidBlockNum,
              "x-goldfinch-signature-block-num": "foo",
              "x-goldfinch-signature-plaintext": `Sign in to Goldfinch: ${latestBlockNum}`,
            },
            signer,
            network,
            uniqueIdentity: ethersUniqueIdentity,
            fetchKYCStatus: fetchEligibleKycStatus,
          })
        ).to.eventually.be.rejectedWith("Invalid signature block number.")
      })

      it("throws an error if the signature block number corresponds to an expired timestamp", async () => {
        assertNonNullable(signer?.provider)
        signer.provider.getBlock = ((blockId) => {
          const blockTimestamp = blockId === "latest" ? 100000 : 0
          const blockNum = blockId === "latest" ? 10000 : 0
          return Promise.resolve({number: blockNum, timestamp: blockTimestamp})
        }) as any
        await expect(
          uniqueIdentitySigner.main({
            auth: {
              "x-goldfinch-address": TEST_ACCOUNT.address,
              "x-goldfinch-signature": await wallet.signMessage(`Sign in to Goldfinch: 0`),
              "x-goldfinch-signature-block-num": "0",
              "x-goldfinch-signature-plaintext": `Sign in to Goldfinch: ${0}`,
            },
            signer,
            network,
            uniqueIdentity: ethersUniqueIdentity,
            fetchKYCStatus: fetchEligibleKycStatus,
          })
        ).to.eventually.be.rejectedWith(/Signature expired: /)
      })

      it("throws an error if the signature block number is in the future", async () => {
        const futureBlockNum = latestBlockNum + 100000
        await expect(
          uniqueIdentitySigner.main({
            auth: {
              "x-goldfinch-address": TEST_ACCOUNT.address,
              "x-goldfinch-signature": await wallet.signMessage(`Sign in to Goldfinch: ${futureBlockNum}`),
              "x-goldfinch-signature-block-num": futureBlockNum.toString(),
              "x-goldfinch-signature-plaintext": `Sign in to Goldfinch: ${futureBlockNum}`,
            },
            signer,
            network,
            uniqueIdentity: ethersUniqueIdentity,
            fetchKYCStatus: fetchEligibleKycStatus,
          })
        ).to.eventually.be.rejectedWith(/Unexpected signature block number: /)
      })
    })

    describe("KYC is ineligible", () => {
      describe("countryCode is empty", () => {
        beforeEach(() => {
          fetchKYCFunction = fetchStubbedKycStatus({
            status: "approved",
            countryCode: "",
            residency: "us",
          })
        })

        it("throws an error", async () => {
          const auth = {
            "x-goldfinch-address": TEST_ACCOUNT.address,
            "x-goldfinch-signature": await wallet.signMessage(`Sign in to Goldfinch: ${latestBlockNum}`),
            "x-goldfinch-signature-block-num": latestBlockNum.toString(),
            "x-goldfinch-signature-plaintext": `Sign in to Goldfinch: ${latestBlockNum}`,
          }

          await expect(
            uniqueIdentitySigner.main({
              auth,
              signer,
              network,
              uniqueIdentity: ethersUniqueIdentity,
              fetchKYCStatus: fetchKYCFunction,
            })
          ).to.be.rejectedWith(/Does not meet mint requirements: countryCode/)
        })
      })

      describe("KYC is not approved", () => {
        beforeEach(() => {
          fetchKYCFunction = fetchStubbedKycStatus({
            status: "failed",
            countryCode: "CA",
            residency: "non-us",
          })
        })

        it("throws an error", async () => {
          const auth = {
            "x-goldfinch-address": TEST_ACCOUNT.address,
            "x-goldfinch-signature": await wallet.signMessage(`Sign in to Goldfinch: ${latestBlockNum}`),
            "x-goldfinch-signature-block-num": latestBlockNum.toString(),
            "x-goldfinch-signature-plaintext": `Sign in to Goldfinch: ${latestBlockNum}`,
          }

          await expect(
            uniqueIdentitySigner.main({
              auth,
              signer,
              network,
              uniqueIdentity: ethersUniqueIdentity,
              fetchKYCStatus: fetchKYCFunction,
            })
          ).to.be.rejectedWith(/Does not meet mint requirements: status/)
        })
      })

      describe("residency is missing", () => {
        beforeEach(() => {
          fetchKYCFunction = fetchStubbedKycStatus({
            status: "approved",
            countryCode: "CA",
            residency: undefined,
          })
        })

        it("does not throw an error", async () => {
          const auth = {
            "x-goldfinch-address": TEST_ACCOUNT.address,
            "x-goldfinch-signature": await wallet.signMessage(`Sign in to Goldfinch: ${latestBlockNum}`),
            "x-goldfinch-signature-plaintext": `Sign in to Goldfinch: ${latestBlockNum}`,
            "x-goldfinch-signature-block-num": latestBlockNum.toString(),
          }

          await expect(
            uniqueIdentitySigner.main({
              auth,
              signer,
              network,
              uniqueIdentity: ethersUniqueIdentity,
              fetchKYCStatus: fetchKYCFunction,
            })
          ).to.be.fulfilled
        })
      })
    })

    describe("KYC is eligible", () => {
      describe("countryCode is US", () => {
        beforeEach(() => {
          fetchKYCFunction = fetchStubbedKycStatus({
            status: "approved",
            countryCode: "US",
            residency: "us",
          })
        })

        describe("non accredited investor", () => {
          it("returns a signature that can be used to mint", async () => {
            await uniqueIdentity.setSupportedUIDTypes([usNonAccreditedIdType], [true])

            const result = await uniqueIdentitySigner.main({
              auth: validAuthAnotherUser,
              signer,
              network,
              uniqueIdentity: ethersUniqueIdentity,
              fetchKYCStatus: fetchKYCFunction,
            })

            // mint non-accredited investor
            await uniqueIdentity.mint(usNonAccreditedIdType, result.expiresAt, result.signature, {
              from: anotherUser,
              value: await uniqueIdentity.MINT_COST_PER_TOKEN(),
            })

            expect(await uniqueIdentity.balanceOf(anotherUser, nonUSIdType)).to.bignumber.eq(new BN(0))
            expect(await uniqueIdentity.balanceOf(anotherUser, usAccreditedIdType)).to.bignumber.eq(new BN(0))
            expect(await uniqueIdentity.balanceOf(anotherUser, usNonAccreditedIdType)).to.bignumber.eq(new BN(1))

            // Indirectly test that the nonce is correctly used, thereby allowing the burn to succeed

            const burnPresigMessage = presignedBurnMessage(
              anotherUser,
              usNonAccreditedIdType.toNumber(),
              validExpiryTimestamp,
              uniqueIdentity.address,
              1,
              network.chainId
            )
            const burnSig = await signer.signMessage(burnPresigMessage)

            await uniqueIdentity.burn(anotherUser, usNonAccreditedIdType, validExpiryTimestamp, burnSig, {
              from: anotherUser,
            })
            expect(await uniqueIdentity.balanceOf(anotherUser, nonUSIdType)).to.bignumber.eq(new BN(0))
            expect(await uniqueIdentity.balanceOf(anotherUser, usAccreditedIdType)).to.bignumber.eq(new BN(0))
            expect(await uniqueIdentity.balanceOf(anotherUser, usNonAccreditedIdType)).to.bignumber.eq(new BN(0))
          }).timeout(TEST_TIMEOUT)

          it("returns a signature that can be used to mintTo", async () => {
            await uniqueIdentity.setSupportedUIDTypes([usNonAccreditedIdType], [true])

            const result = await uniqueIdentitySigner.main({
              auth: validAuthAnotherUser,
              signer,
              network,
              mintToAddress: anotherUser2,
              uniqueIdentity: ethersUniqueIdentity,
              fetchKYCStatus: fetchKYCFunction,
            })

            // mint non-accredited investor
            await uniqueIdentity.mintTo(anotherUser2, usNonAccreditedIdType, result.expiresAt, result.signature, {
              from: anotherUser,
              value: await uniqueIdentity.MINT_COST_PER_TOKEN(),
            })

            expect(await uniqueIdentity.balanceOf(anotherUser2, nonUSIdType)).to.bignumber.eq(new BN(0))
            expect(await uniqueIdentity.balanceOf(anotherUser2, usAccreditedIdType)).to.bignumber.eq(new BN(0))
            expect(await uniqueIdentity.balanceOf(anotherUser2, usNonAccreditedIdType)).to.bignumber.eq(new BN(1))
          }).timeout(TEST_TIMEOUT)

          it("throws an error if linking their KYC to their recipient fails", async () => {
            sandbox.restore()
            sandbox.stub(axios, "post").throws({response: {status: 500, data: "Link kyc failed"}})
            await expect(
              uniqueIdentitySigner.main({
                auth: validAuthAnotherUser,
                signer,
                network,
                uniqueIdentity: ethersUniqueIdentity,
                mintToAddress: anotherUser2,
                fetchKYCStatus: fetchKYCFunction,
              })
            ).to.eventually.be.rejectedWith('Error in request to /linkUserToUid.\nstatus: 500\ndata: "Link kyc failed"')
          })
        })

        describe("US accredited investor", () => {
          let getUsAccreditedIDType
          beforeEach(async () => {
            // stub as accredited investor
            getUsAccreditedIDType = () => usAccreditedIdType.toNumber()
            await uniqueIdentity.setSupportedUIDTypes([usAccreditedIdType], [true])
          })

          it("returns a signature that can be used to mint", async () => {
            const result = await uniqueIdentitySigner.main({
              auth: validAuthAnotherUser,
              signer,
              network,
              uniqueIdentity: ethersUniqueIdentity,
              fetchKYCStatus: fetchKYCFunction,
              getIDType: getUsAccreditedIDType,
            })

            // mint accredited investor
            await uniqueIdentity.mint(usAccreditedIdType, result.expiresAt, result.signature, {
              from: anotherUser,
              value: await uniqueIdentity.MINT_COST_PER_TOKEN(),
            })
            expect(await uniqueIdentity.balanceOf(anotherUser, nonUSIdType)).to.bignumber.eq(new BN(0))
            expect(await uniqueIdentity.balanceOf(anotherUser, usAccreditedIdType)).to.bignumber.eq(new BN(1))
            expect(await uniqueIdentity.balanceOf(anotherUser, usNonAccreditedIdType)).to.bignumber.eq(new BN(0))

            // Indirectly test that the nonce is correctly used, thereby allowing the burn to succeed
            const burnPresigMessage = presignedBurnMessage(
              anotherUser,
              usAccreditedIdType.toNumber(),
              validExpiryTimestamp,
              uniqueIdentity.address,
              1,
              network.chainId
            )
            const burnSig = await signer.signMessage(burnPresigMessage)

            await uniqueIdentity.burn(anotherUser, usAccreditedIdType, validExpiryTimestamp, burnSig, {
              from: anotherUser,
            })
            expect(await uniqueIdentity.balanceOf(anotherUser, nonUSIdType)).to.bignumber.eq(new BN(0))
            expect(await uniqueIdentity.balanceOf(anotherUser, usAccreditedIdType)).to.bignumber.eq(new BN(0))
            expect(await uniqueIdentity.balanceOf(anotherUser, usNonAccreditedIdType)).to.bignumber.eq(new BN(0))
          }).timeout(TEST_TIMEOUT)

          it("returns a signature that can be used to mintTo", async () => {
            const result = await uniqueIdentitySigner.main({
              auth: validAuthAnotherUser,
              signer,
              network,
              uniqueIdentity: ethersUniqueIdentity,
              mintToAddress: anotherUser2,
              fetchKYCStatus: fetchKYCFunction,
              getIDType: getUsAccreditedIDType,
            })
            // mint accredited investor
            await uniqueIdentity.mintTo(anotherUser2, usAccreditedIdType, result.expiresAt, result.signature, {
              from: anotherUser,
              value: await uniqueIdentity.MINT_COST_PER_TOKEN(),
            })
            expect(await uniqueIdentity.balanceOf(anotherUser2, nonUSIdType)).to.bignumber.eq(new BN(0))
            expect(await uniqueIdentity.balanceOf(anotherUser2, usAccreditedIdType)).to.bignumber.eq(new BN(1))
            expect(await uniqueIdentity.balanceOf(anotherUser2, usNonAccreditedIdType)).to.bignumber.eq(new BN(0))
          }).timeout(TEST_TIMEOUT)

          it("throws an error if linking their KYC to their recipient fails", async () => {
            sandbox.restore()
            sandbox.stub(axios, "post").throws({response: {status: 500, data: "Link kyc failed"}})
            await expect(
              uniqueIdentitySigner.main({
                auth: validAuthAnotherUser,
                signer,
                network,
                uniqueIdentity: ethersUniqueIdentity,
                mintToAddress: anotherUser2,
                fetchKYCStatus: fetchKYCFunction,
                getIDType: getUsAccreditedIDType,
              })
            ).to.eventually.be.rejectedWith('Error in request to /linkUserToUid.\nstatus: 500\ndata: "Link kyc failed"')
          })
        })
      })

      describe("countryCode is non US", () => {
        beforeEach(() => {
          fetchKYCFunction = fetchEligibleKycStatus
        })

        it("returns a signature that can be used to mint", async () => {
          await uniqueIdentity.setSupportedUIDTypes([0], [true])

          const result = await uniqueIdentitySigner.main({
            auth: validAuthAnotherUser,
            signer,
            network,
            uniqueIdentity: ethersUniqueIdentity,
            fetchKYCStatus: fetchKYCFunction,
          })

          await uniqueIdentity.mint(0, result.expiresAt, result.signature, {
            from: anotherUser,
            value: await uniqueIdentity.MINT_COST_PER_TOKEN(),
          })
          expect(await uniqueIdentity.balanceOf(anotherUser, 0)).to.bignumber.eq(new BN(1))
          expect(await uniqueIdentity.balanceOf(anotherUser, 1)).to.bignumber.eq(new BN(0))
          expect(await uniqueIdentity.balanceOf(anotherUser, 2)).to.bignumber.eq(new BN(0))

          // Indirectly test that the nonce is correctly used, thereby allowing the burn to succeed
          const burnPresigMessage = presignedBurnMessage(
            anotherUser,
            0,
            validExpiryTimestamp,
            uniqueIdentity.address,
            1,
            network.chainId
          )
          const burnSig = await signer.signMessage(burnPresigMessage)

          await uniqueIdentity.burn(anotherUser, 0, validExpiryTimestamp, burnSig, {from: anotherUser})
          expect(await uniqueIdentity.balanceOf(anotherUser, 0)).to.bignumber.eq(new BN(0))
          expect(await uniqueIdentity.balanceOf(anotherUser, 1)).to.bignumber.eq(new BN(0))
          expect(await uniqueIdentity.balanceOf(anotherUser, 2)).to.bignumber.eq(new BN(0))
        }).timeout(TEST_TIMEOUT)

        it("returns a signature that can be used to mintTo", async () => {
          const auth = {
            "x-goldfinch-address": anotherUser,
            "x-goldfinch-signature": await anotherUserSigner.signMessage(`Sign in to Goldfinch: ${latestBlockNum}`),
            "x-goldfinch-signature-block-num": `${latestBlockNum}`,
            "x-goldfinch-signature-plaintext": `Sign in to Goldfinch: ${latestBlockNum}`,
          }
          await uniqueIdentity.setSupportedUIDTypes([0], [true])

          const result = await uniqueIdentitySigner.main({
            auth,
            signer,
            network,
            uniqueIdentity: ethersUniqueIdentity,
            mintToAddress: anotherUser2,
            fetchKYCStatus: fetchKYCFunction,
          })

          await uniqueIdentity.mintTo(anotherUser2, 0, result.expiresAt, result.signature, {
            from: anotherUser,
            value: await uniqueIdentity.MINT_COST_PER_TOKEN(),
          })
          expect(await uniqueIdentity.balanceOf(anotherUser2, 0)).to.bignumber.eq(new BN(1))
          expect(await uniqueIdentity.balanceOf(anotherUser2, 1)).to.bignumber.eq(new BN(0))
          expect(await uniqueIdentity.balanceOf(anotherUser2, 2)).to.bignumber.eq(new BN(0))
        }).timeout(TEST_TIMEOUT)

        it("throws an error if linking their KYC to their recipient fails", async () => {
          sandbox.restore()
          sandbox.stub(axios, "post").throws({response: {status: 500, data: "Link kyc failed"}})
          await expect(
            uniqueIdentitySigner.main({
              auth: validAuthAnotherUser,
              signer,
              network,
              uniqueIdentity: ethersUniqueIdentity,
              mintToAddress: anotherUser2,
              fetchKYCStatus: fetchKYCFunction,
            })
          ).to.eventually.be.rejectedWith('Error in request to /linkUserToUid.\nstatus: 500\ndata: "Link kyc failed"')
        })
      })
    })
  })

  describe("caseInsensitiveIncludes", () => {
    it("case insensitively matches an array element", () => {
      const data = [
        "0x11Cb600E4740C052855B942dC13648d7dF1503E5",
        "0x7Fb2EdA1a56BAEC8a5f1764948D3B1de03059950",
        "0x47BdbA50F035bAF1Bd9A41Da3cD7fc6bc198049f",
        "0xD98a107A56c2DE8aFD8416a5AeF3Fb63Ea277B07",
        "0xdCA313c4Df33c2142B2aDf202D6AbF4Fa56e1d41",
        "0x55d601F005ae4984314951F9219D097d91EedCae",
        "0x111B46bFAe308Be4570Cb9F17d051B58022D7c89",
        "0X8F40DCD6BA523561A8A497001896330965520FA4",
      ]

      const testAddress = "0X8F40DCD6ba523561a8a497001896330965520FA4"
      const testAddressLowerCase = testAddress.toLowerCase()
      const testAddressUppwerCase = testAddress.toUpperCase()
      const notInTheArray = "0X8F40DCD6ba523561a8a497001896330965520000"

      expect(caseInsensitiveIncludes(data, testAddress)).to.be.true
      expect(caseInsensitiveIncludes(data, testAddressLowerCase)).to.be.true
      expect(caseInsensitiveIncludes(data, testAddressUppwerCase)).to.be.true
      expect(caseInsensitiveIncludes(data, notInTheArray)).to.be.false
    })
  })

  describe("eligible json files", () => {
    it("checks for duplicates", () => {
      const data = [USAccreditedIndividualsList, USAccreditedEntitiesList, NonUSEntitiesList]
      data.reduce((acc, curr) => {
        if (acc.some((x) => curr.includes(x))) {
          throw new Error("Array intersection")
        }
        return [...acc, ...curr]
      })
      return true
    })
  })
})
