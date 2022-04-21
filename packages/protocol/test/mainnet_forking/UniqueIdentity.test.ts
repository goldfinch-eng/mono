import hre, {ethers} from "hardhat"
import {UniqueIdentityInstance} from "@goldfinch-eng/protocol/typechain/truffle"
import {expect, BN, getDeployedAsTruffleContract, toEthers} from "../testHelpers"
import {getProtocolOwner, getSignerForAddress, OWNER_ROLE, SIGNER_ROLE} from "../../blockchain_scripts/deployHelpers"
import {FetchKYCFunction, KYC} from "@goldfinch-eng/autotasks/unique-identity-signer"
import * as uniqueIdentitySigner from "@goldfinch-eng/autotasks/unique-identity-signer"
import {UniqueIdentity} from "@goldfinch-eng/protocol/typechain/ethers"
import {Signer} from "ethers"
import {assertNonNullable} from "@goldfinch-eng/utils"
import {impersonateAccount} from "../../blockchain_scripts/helpers/impersonateAccount"
import {fundWithWhales} from "../../blockchain_scripts/helpers/fundWithWhales"
import * as migrate250 from "../../blockchain_scripts/migrations/v2.5.0/migrate"
import {MAINNET_MULTISIG} from "../../blockchain_scripts/mainnetForkingHelpers"
const {deployments, web3} = hre

const TEST_TIMEOUT = 180000 // 3 mins

const setupTest = deployments.createFixture(async ({deployments}) => {
  await deployments.fixture("base_deploy", {keepExistingDeployments: true})

  const [owner, bwr] = await web3.eth.getAccounts()
  assertNonNullable(owner)
  assertNonNullable(bwr)

  // Ensure the multisig has funds for various transactions
  const ownerAccount = await getSignerForAddress(owner)
  assertNonNullable(ownerAccount)
  await ownerAccount.sendTransaction({to: MAINNET_MULTISIG, value: ethers.utils.parseEther("10.0")})

  const uniqueIdentity = await getDeployedAsTruffleContract<UniqueIdentityInstance>(deployments, "UniqueIdentity")
  const ethersUniqueIdentity = await toEthers<UniqueIdentity>(uniqueIdentity)
  const signer = ethersUniqueIdentity.signer
  assertNonNullable(signer.provider, "Signer provider is null")
  const network = await signer.provider.getNetwork()

  return {
    uniqueIdentity,
    ethersUniqueIdentity,
    signer,
    network,
  }
})

describe("UID", () => {
  let accounts, owner, person3
  let fetchKYCFunction: FetchKYCFunction,
    uniqueIdentity: UniqueIdentityInstance,
    ethersUniqueIdentity: UniqueIdentity,
    signer: Signer,
    network

  function fetchStubbedKycStatus(kyc: KYC): FetchKYCFunction {
    return async (_) => {
      return Promise.resolve(kyc)
    }
  }

  beforeEach(async () => {
    accounts = await web3.eth.getAccounts()
    ;[owner, person3] = accounts
    ;({uniqueIdentity, signer, ethersUniqueIdentity, network} = await setupTest())

    await impersonateAccount(hre, MAINNET_MULTISIG)
    await fundWithWhales(["USDC", "BUSD", "USDT"], [owner, person3])

    await uniqueIdentity.grantRole(OWNER_ROLE, owner, {from: await getProtocolOwner()})
    await uniqueIdentity.grantRole(SIGNER_ROLE, await signer.getAddress(), {from: await getProtocolOwner()})

    await migrate250.main()
  })

  describe("KYC is elligible", () => {
    describe("non accredited investor", () => {
      beforeEach(() => {
        fetchKYCFunction = fetchStubbedKycStatus({
          status: "approved",
          countryCode: "US",
        })
      })

      it("returns a signature that can be used to mint", async () => {
        const nonUSIdType = await uniqueIdentity.ID_TYPE_0()
        const usAccreditedIdType = await uniqueIdentity.ID_TYPE_1()
        const usNonAccreditedIdType = await uniqueIdentity.ID_TYPE_2()
        const usEntityIdType = await uniqueIdentity.ID_TYPE_3()
        const nonUsEntityIdType = await uniqueIdentity.ID_TYPE_4()
        const auth = {
          "x-goldfinch-address": person3,
          "x-goldfinch-signature": "test_signature",
          "x-goldfinch-signature-block-num": "fake_block_number",
        }
        await uniqueIdentity.setSupportedUIDTypes([usNonAccreditedIdType], [true])

        let result = await uniqueIdentitySigner.main({
          auth,
          signer,
          network,
          uniqueIdentity: ethersUniqueIdentity,
          fetchKYCStatus: fetchKYCFunction,
        })

        // mint non-accredited investor
        await uniqueIdentity.mint(usNonAccreditedIdType, result.expiresAt, result.signature, {
          from: person3,
          value: web3.utils.toWei("0.00083"),
        })
        expect(await uniqueIdentity.balanceOf(person3, nonUSIdType)).to.bignumber.eq(new BN(0))
        expect(await uniqueIdentity.balanceOf(person3, usAccreditedIdType)).to.bignumber.eq(new BN(0))
        expect(await uniqueIdentity.balanceOf(person3, usNonAccreditedIdType)).to.bignumber.eq(new BN(1))
        expect(await uniqueIdentity.balanceOf(person3, usEntityIdType)).to.bignumber.eq(new BN(0))
        expect(await uniqueIdentity.balanceOf(person3, nonUsEntityIdType)).to.bignumber.eq(new BN(0))

        // Indirectly test that the nonce is correctly used, thereby allowing the burn to succeed
        result = await uniqueIdentitySigner.main({
          auth,
          signer,
          network,
          uniqueIdentity: ethersUniqueIdentity,
          fetchKYCStatus: fetchKYCFunction,
        })

        await uniqueIdentity.burn(person3, usNonAccreditedIdType, result.expiresAt, result.signature, {
          from: person3,
        })
        expect(await uniqueIdentity.balanceOf(person3, nonUSIdType)).to.bignumber.eq(new BN(0))
        expect(await uniqueIdentity.balanceOf(person3, usAccreditedIdType)).to.bignumber.eq(new BN(0))
        expect(await uniqueIdentity.balanceOf(person3, usNonAccreditedIdType)).to.bignumber.eq(new BN(0))
        expect(await uniqueIdentity.balanceOf(person3, usEntityIdType)).to.bignumber.eq(new BN(0))
        expect(await uniqueIdentity.balanceOf(person3, nonUsEntityIdType)).to.bignumber.eq(new BN(0))
      }).timeout(TEST_TIMEOUT)
    })

    describe("non US investor", () => {
      beforeEach(() => {
        fetchKYCFunction = fetchStubbedKycStatus({
          status: "approved",
          countryCode: "CA",
        })
      })

      it("returns a signature that can be used to mint", async () => {
        const nonUSIdType = await uniqueIdentity.ID_TYPE_0()
        const usAccreditedIdType = await uniqueIdentity.ID_TYPE_1()
        const usNonAccreditedIdType = await uniqueIdentity.ID_TYPE_2()
        const usEntityIdType = await uniqueIdentity.ID_TYPE_3()
        const nonUsEntityIdType = await uniqueIdentity.ID_TYPE_4()
        const auth = {
          "x-goldfinch-address": person3,
          "x-goldfinch-signature": "test_signature",
          "x-goldfinch-signature-block-num": "fake_block_number",
        }
        await uniqueIdentity.setSupportedUIDTypes([nonUSIdType], [true])

        let result = await uniqueIdentitySigner.main({
          auth,
          signer,
          network,
          uniqueIdentity: ethersUniqueIdentity,
          fetchKYCStatus: fetchKYCFunction,
        })

        // mint non-accredited investor
        await uniqueIdentity.mint(nonUSIdType, result.expiresAt, result.signature, {
          from: person3,
          value: web3.utils.toWei("0.00083"),
        })
        expect(await uniqueIdentity.balanceOf(person3, nonUSIdType)).to.bignumber.eq(new BN(1))
        expect(await uniqueIdentity.balanceOf(person3, usAccreditedIdType)).to.bignumber.eq(new BN(0))
        expect(await uniqueIdentity.balanceOf(person3, usNonAccreditedIdType)).to.bignumber.eq(new BN(0))
        expect(await uniqueIdentity.balanceOf(person3, usEntityIdType)).to.bignumber.eq(new BN(0))
        expect(await uniqueIdentity.balanceOf(person3, nonUsEntityIdType)).to.bignumber.eq(new BN(0))

        // Indirectly test that the nonce is correctly used, thereby allowing the burn to succeed
        result = await uniqueIdentitySigner.main({
          auth,
          signer,
          network,
          uniqueIdentity: ethersUniqueIdentity,
          fetchKYCStatus: fetchKYCFunction,
        })

        await uniqueIdentity.burn(person3, nonUSIdType, result.expiresAt, result.signature, {
          from: person3,
        })
        expect(await uniqueIdentity.balanceOf(person3, nonUSIdType)).to.bignumber.eq(new BN(0))
        expect(await uniqueIdentity.balanceOf(person3, usAccreditedIdType)).to.bignumber.eq(new BN(0))
        expect(await uniqueIdentity.balanceOf(person3, usNonAccreditedIdType)).to.bignumber.eq(new BN(0))
        expect(await uniqueIdentity.balanceOf(person3, usEntityIdType)).to.bignumber.eq(new BN(0))
        expect(await uniqueIdentity.balanceOf(person3, nonUsEntityIdType)).to.bignumber.eq(new BN(0))
      }).timeout(TEST_TIMEOUT)
    })

    describe("US accredited investor", () => {
      beforeEach(() => {
        fetchKYCFunction = fetchStubbedKycStatus({
          status: "approved",
          countryCode: "US",
        })
      })

      it("returns a signature that can be used to mint", async () => {
        const address = "0x368031e04c52cf15a01c6309aC251397d7b60fEb"
        await impersonateAccount(hre, address)
        await fundWithWhales(["ETH"], [address])

        const nonUSIdType = await uniqueIdentity.ID_TYPE_0()
        const usAccreditedIdType = await uniqueIdentity.ID_TYPE_1()
        const usNonAccreditedIdType = await uniqueIdentity.ID_TYPE_2()
        const usEntityIdType = await uniqueIdentity.ID_TYPE_3()
        const nonUsEntityIdType = await uniqueIdentity.ID_TYPE_4()
        const auth = {
          "x-goldfinch-address": address,
          "x-goldfinch-signature": "test_signature",
          "x-goldfinch-signature-block-num": "fake_block_number",
        }
        await uniqueIdentity.setSupportedUIDTypes([usAccreditedIdType], [true])

        let result = await uniqueIdentitySigner.main({
          auth,
          signer,
          network,
          uniqueIdentity: ethersUniqueIdentity,
          fetchKYCStatus: fetchKYCFunction,
        })

        // mint non-accredited investor
        await uniqueIdentity.mint(usAccreditedIdType, result.expiresAt, result.signature, {
          from: address,
          value: web3.utils.toWei("0.00083"),
        })
        expect(await uniqueIdentity.balanceOf(address, nonUSIdType)).to.bignumber.eq(new BN(0))
        expect(await uniqueIdentity.balanceOf(address, usAccreditedIdType)).to.bignumber.eq(new BN(1))
        expect(await uniqueIdentity.balanceOf(address, usNonAccreditedIdType)).to.bignumber.eq(new BN(0))
        expect(await uniqueIdentity.balanceOf(address, usEntityIdType)).to.bignumber.eq(new BN(0))
        expect(await uniqueIdentity.balanceOf(address, nonUsEntityIdType)).to.bignumber.eq(new BN(0))

        // Indirectly test that the nonce is correctly used, thereby allowing the burn to succeed
        result = await uniqueIdentitySigner.main({
          auth,
          signer,
          network,
          uniqueIdentity: ethersUniqueIdentity,
          fetchKYCStatus: fetchKYCFunction,
        })

        await uniqueIdentity.burn(address, usAccreditedIdType, result.expiresAt, result.signature, {
          from: address,
        })
        expect(await uniqueIdentity.balanceOf(address, nonUSIdType)).to.bignumber.eq(new BN(0))
        expect(await uniqueIdentity.balanceOf(address, usAccreditedIdType)).to.bignumber.eq(new BN(0))
        expect(await uniqueIdentity.balanceOf(address, usNonAccreditedIdType)).to.bignumber.eq(new BN(0))
        expect(await uniqueIdentity.balanceOf(address, usEntityIdType)).to.bignumber.eq(new BN(0))
        expect(await uniqueIdentity.balanceOf(address, nonUsEntityIdType)).to.bignumber.eq(new BN(0))
      }).timeout(TEST_TIMEOUT)
    })

    describe("US entity", () => {
      beforeEach(() => {
        fetchKYCFunction = fetchStubbedKycStatus({
          status: "approved",
          countryCode: "CA",
        })
      })

      it("returns a signature that can be used to mint", async () => {
        const address = "0x7Fb2EdA1a56BAEC8a5f1764948D3B1de03059950"
        await impersonateAccount(hre, address)
        await fundWithWhales(["ETH"], [address])
        const nonUSIdType = await uniqueIdentity.ID_TYPE_0()
        const usAccreditedIdType = await uniqueIdentity.ID_TYPE_1()
        const usNonAccreditedIdType = await uniqueIdentity.ID_TYPE_2()
        const usEntityIdType = await uniqueIdentity.ID_TYPE_3()
        const nonUsEntityIdType = await uniqueIdentity.ID_TYPE_4()
        const auth = {
          "x-goldfinch-address": address,
          "x-goldfinch-signature": "test_signature",
          "x-goldfinch-signature-block-num": "fake_block_number",
        }
        await uniqueIdentity.setSupportedUIDTypes([usEntityIdType], [true])

        let result = await uniqueIdentitySigner.main({
          auth,
          signer,
          network,
          uniqueIdentity: ethersUniqueIdentity,
          fetchKYCStatus: fetchKYCFunction,
        })

        await uniqueIdentity.mint(usEntityIdType, result.expiresAt, result.signature, {
          from: address,
          value: web3.utils.toWei("0.00083"),
        })
        expect(await uniqueIdentity.balanceOf(address, nonUSIdType)).to.bignumber.eq(new BN(0))
        expect(await uniqueIdentity.balanceOf(address, usAccreditedIdType)).to.bignumber.eq(new BN(0))
        expect(await uniqueIdentity.balanceOf(address, usNonAccreditedIdType)).to.bignumber.eq(new BN(0))
        expect(await uniqueIdentity.balanceOf(address, usEntityIdType)).to.bignumber.eq(new BN(1))
        expect(await uniqueIdentity.balanceOf(address, nonUsEntityIdType)).to.bignumber.eq(new BN(0))

        // Indirectly test that the nonce is correctly used, thereby allowing the burn to succeed
        result = await uniqueIdentitySigner.main({
          auth,
          signer,
          network,
          uniqueIdentity: ethersUniqueIdentity,
          fetchKYCStatus: fetchKYCFunction,
        })

        await uniqueIdentity.burn(address, usEntityIdType, result.expiresAt, result.signature, {
          from: address,
        })
        expect(await uniqueIdentity.balanceOf(address, nonUSIdType)).to.bignumber.eq(new BN(0))
        expect(await uniqueIdentity.balanceOf(address, usAccreditedIdType)).to.bignumber.eq(new BN(0))
        expect(await uniqueIdentity.balanceOf(address, usNonAccreditedIdType)).to.bignumber.eq(new BN(0))
        expect(await uniqueIdentity.balanceOf(address, usEntityIdType)).to.bignumber.eq(new BN(0))
        expect(await uniqueIdentity.balanceOf(address, nonUsEntityIdType)).to.bignumber.eq(new BN(0))
      }).timeout(TEST_TIMEOUT)
    })

    describe("non US entity", () => {
      beforeEach(() => {
        fetchKYCFunction = fetchStubbedKycStatus({
          status: "approved",
          countryCode: "CA",
        })
      })

      it("returns a signature that can be used to mint", async () => {
        const address = "0x9E90d6Fe95ee0bb754261eE3FC3d8a9c11e97a8E"
        await impersonateAccount(hre, address)
        await fundWithWhales(["ETH"], [address])
        const nonUSIdType = await uniqueIdentity.ID_TYPE_0()
        const usAccreditedIdType = await uniqueIdentity.ID_TYPE_1()
        const usNonAccreditedIdType = await uniqueIdentity.ID_TYPE_2()
        const usEntityIdType = await uniqueIdentity.ID_TYPE_3()
        const nonUsEntityIdType = await uniqueIdentity.ID_TYPE_4()
        const auth = {
          "x-goldfinch-address": address,
          "x-goldfinch-signature": "test_signature",
          "x-goldfinch-signature-block-num": "fake_block_number",
        }
        await uniqueIdentity.setSupportedUIDTypes([nonUsEntityIdType], [true])

        let result = await uniqueIdentitySigner.main({
          auth,
          signer,
          network,
          uniqueIdentity: ethersUniqueIdentity,
          fetchKYCStatus: fetchKYCFunction,
        })

        await uniqueIdentity.mint(nonUsEntityIdType, result.expiresAt, result.signature, {
          from: address,
          value: web3.utils.toWei("0.00083"),
        })
        expect(await uniqueIdentity.balanceOf(address, nonUSIdType)).to.bignumber.eq(new BN(0))
        expect(await uniqueIdentity.balanceOf(address, usAccreditedIdType)).to.bignumber.eq(new BN(0))
        expect(await uniqueIdentity.balanceOf(address, usNonAccreditedIdType)).to.bignumber.eq(new BN(0))
        expect(await uniqueIdentity.balanceOf(address, usEntityIdType)).to.bignumber.eq(new BN(0))
        expect(await uniqueIdentity.balanceOf(address, nonUsEntityIdType)).to.bignumber.eq(new BN(1))

        // Indirectly test that the nonce is correctly used, thereby allowing the burn to succeed
        result = await uniqueIdentitySigner.main({
          auth,
          signer,
          network,
          uniqueIdentity: ethersUniqueIdentity,
          fetchKYCStatus: fetchKYCFunction,
        })

        await uniqueIdentity.burn(address, nonUsEntityIdType, result.expiresAt, result.signature, {
          from: address,
        })
        expect(await uniqueIdentity.balanceOf(address, nonUSIdType)).to.bignumber.eq(new BN(0))
        expect(await uniqueIdentity.balanceOf(address, usAccreditedIdType)).to.bignumber.eq(new BN(0))
        expect(await uniqueIdentity.balanceOf(address, usNonAccreditedIdType)).to.bignumber.eq(new BN(0))
        expect(await uniqueIdentity.balanceOf(address, usEntityIdType)).to.bignumber.eq(new BN(0))
        expect(await uniqueIdentity.balanceOf(address, nonUsEntityIdType)).to.bignumber.eq(new BN(0))
      }).timeout(TEST_TIMEOUT)
    })
  })
})
