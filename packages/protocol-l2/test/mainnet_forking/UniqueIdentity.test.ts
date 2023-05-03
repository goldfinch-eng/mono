import hre, {ethers} from "hardhat"
import {UniqueIdentityInstance} from "@goldfinch-eng/protocol/typechain/truffle"
import {expect, BN, getDeployedAsTruffleContract, toEthers} from "../testHelpers"
import {getSignerForAddress, OWNER_ROLE, SIGNER_ROLE} from "../../blockchain_scripts/deployHelpers"
import {UniqueIdentity} from "@goldfinch-eng/protocol/typechain/ethers"
import {Signer} from "ethers"
import {assertNonNullable, presignedBurnMessage, presignedMintMessage} from "@goldfinch-eng/utils"
import {impersonateAccount} from "../../blockchain_scripts/helpers/impersonateAccount"
import {fundWithWhales} from "../../blockchain_scripts/helpers/fundWithWhales"

import {
  MAINNET_GOVERNANCE_MULTISIG,
  MAINNET_WARBLER_LABS_MULTISIG,
} from "../../blockchain_scripts/mainnetForkingHelpers"

const {deployments, web3} = hre

const TEST_TIMEOUT = 180000 // 3 mins

const setupTest = deployments.createFixture(async ({deployments}) => {
  await deployments.fixture("pendingMainnetMigrations", {keepExistingDeployments: true})

  const [owner, bwr, person3] = await web3.eth.getAccounts()
  assertNonNullable(owner)
  assertNonNullable(bwr)
  assertNonNullable(person3)

  // Ensure the multisig has funds for various transactions
  const ownerAccount = await getSignerForAddress(owner)
  assertNonNullable(ownerAccount)
  await ownerAccount.sendTransaction({to: MAINNET_GOVERNANCE_MULTISIG, value: ethers.utils.parseEther("10.0")})

  const uniqueIdentity = await getDeployedAsTruffleContract<UniqueIdentityInstance>(deployments, "UniqueIdentity")
  const ethersUniqueIdentity = await toEthers<UniqueIdentity>(uniqueIdentity)
  const signer = ethersUniqueIdentity.signer
  assertNonNullable(signer.provider, "Signer provider is null")
  const network = await signer.provider.getNetwork()

  return {
    uniqueIdentity,
    ethersUniqueIdentity,
    owner,
    person3,
    signer,
    network,
  }
})

describe("UID", () => {
  let owner, person3
  let nonUSIdType, usAccreditedIdType, usNonAccreditedIdType, usEntityIdType, nonUsEntityIdType
  let validExpiryTimestamp
  let latestBlockNum
  let uniqueIdentity: UniqueIdentityInstance, signer: Signer, network

  beforeEach(async () => {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;({uniqueIdentity, signer, owner, person3, network} = await setupTest())

    nonUSIdType = await uniqueIdentity.ID_TYPE_0()
    usAccreditedIdType = await uniqueIdentity.ID_TYPE_1()
    usNonAccreditedIdType = await uniqueIdentity.ID_TYPE_2()
    usEntityIdType = await uniqueIdentity.ID_TYPE_3()
    nonUsEntityIdType = await uniqueIdentity.ID_TYPE_4()

    latestBlockNum = (await signer.provider?.getBlock("latest"))?.number as number

    const currentBlock = await signer.provider?.getBlock(latestBlockNum)
    assertNonNullable(currentBlock)
    validExpiryTimestamp = currentBlock.timestamp + 100000

    await impersonateAccount(hre, MAINNET_GOVERNANCE_MULTISIG)
    await fundWithWhales(["USDC", "BUSD", "USDT"], [owner, person3])

    await fundWithWhales(["ETH"], [MAINNET_WARBLER_LABS_MULTISIG])

    await impersonateAccount(hre, MAINNET_WARBLER_LABS_MULTISIG)
    await uniqueIdentity.grantRole(OWNER_ROLE, owner, {from: MAINNET_WARBLER_LABS_MULTISIG})
    await uniqueIdentity.grantRole(SIGNER_ROLE, await signer.getAddress(), {from: MAINNET_WARBLER_LABS_MULTISIG})
  })

  describe("KYC is eligible", () => {
    describe("non accredited investor", () => {
      it("returns a signature that can be used to mint", async () => {
        await uniqueIdentity.setSupportedUIDTypes([usNonAccreditedIdType], [true])

        const mintPresigMessage = presignedMintMessage(
          person3,
          usNonAccreditedIdType.toNumber(),
          validExpiryTimestamp,
          uniqueIdentity.address,
          0,
          network.chainId
        )
        const mintSig = await signer.signMessage(mintPresigMessage)

        // mint non-accredited investor
        await uniqueIdentity.mint(usNonAccreditedIdType, validExpiryTimestamp, mintSig, {
          from: person3,
          value: web3.utils.toWei("0.00083"),
        })
        expect(await uniqueIdentity.balanceOf(person3, nonUSIdType)).to.bignumber.eq(new BN(0))
        expect(await uniqueIdentity.balanceOf(person3, usAccreditedIdType)).to.bignumber.eq(new BN(0))
        expect(await uniqueIdentity.balanceOf(person3, usNonAccreditedIdType)).to.bignumber.eq(new BN(1))
        expect(await uniqueIdentity.balanceOf(person3, usEntityIdType)).to.bignumber.eq(new BN(0))
        expect(await uniqueIdentity.balanceOf(person3, nonUsEntityIdType)).to.bignumber.eq(new BN(0))

        // Indirectly test that the nonce is correctly used, thereby allowing the burn to succeed
        const burnPresigMessage = presignedBurnMessage(
          person3,
          usNonAccreditedIdType.toNumber(),
          validExpiryTimestamp,
          uniqueIdentity.address,
          1,
          network.chainId
        )
        const burnSig = await signer.signMessage(burnPresigMessage)
        await uniqueIdentity.burn(person3, usNonAccreditedIdType, validExpiryTimestamp, burnSig, {
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
      it("returns a signature that can be used to mint", async () => {
        await uniqueIdentity.setSupportedUIDTypes([nonUSIdType], [true])

        const mintPresigMessage = presignedMintMessage(
          person3,
          nonUSIdType.toNumber(),
          validExpiryTimestamp,
          uniqueIdentity.address,
          0,
          network.chainId
        )
        const mintSig = await signer.signMessage(mintPresigMessage)
        // mint non-accredited investor
        await uniqueIdentity.mint(nonUSIdType, validExpiryTimestamp, mintSig, {
          from: person3,
          value: web3.utils.toWei("0.00083"),
        })
        expect(await uniqueIdentity.balanceOf(person3, nonUSIdType)).to.bignumber.eq(new BN(1))
        expect(await uniqueIdentity.balanceOf(person3, usAccreditedIdType)).to.bignumber.eq(new BN(0))
        expect(await uniqueIdentity.balanceOf(person3, usNonAccreditedIdType)).to.bignumber.eq(new BN(0))
        expect(await uniqueIdentity.balanceOf(person3, usEntityIdType)).to.bignumber.eq(new BN(0))
        expect(await uniqueIdentity.balanceOf(person3, nonUsEntityIdType)).to.bignumber.eq(new BN(0))

        // Indirectly test that the nonce is correctly used, thereby allowing the burn to succeed
        const burnPresigMessage = presignedBurnMessage(
          person3,
          nonUSIdType.toNumber(),
          validExpiryTimestamp,
          uniqueIdentity.address,
          1,
          network.chainId
        )
        const burnSig = await signer.signMessage(burnPresigMessage)
        await uniqueIdentity.burn(person3, nonUSIdType, validExpiryTimestamp, burnSig, {
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
      it("returns a signature that can be used to mint", async () => {
        await uniqueIdentity.setSupportedUIDTypes([usAccreditedIdType], [true])

        const mintPresigMessage = presignedMintMessage(
          person3,
          usAccreditedIdType.toNumber(),
          validExpiryTimestamp,
          uniqueIdentity.address,
          0,
          network.chainId
        )
        const mintSig = await signer.signMessage(mintPresigMessage)
        // mint non-accredited investor
        await uniqueIdentity.mint(usAccreditedIdType, validExpiryTimestamp, mintSig, {
          from: person3,
          value: web3.utils.toWei("0.00083"),
        })
        expect(await uniqueIdentity.balanceOf(person3, nonUSIdType)).to.bignumber.eq(new BN(0))
        expect(await uniqueIdentity.balanceOf(person3, usAccreditedIdType)).to.bignumber.eq(new BN(1))
        expect(await uniqueIdentity.balanceOf(person3, usNonAccreditedIdType)).to.bignumber.eq(new BN(0))
        expect(await uniqueIdentity.balanceOf(person3, usEntityIdType)).to.bignumber.eq(new BN(0))
        expect(await uniqueIdentity.balanceOf(person3, nonUsEntityIdType)).to.bignumber.eq(new BN(0))

        // Indirectly test that the nonce is correctly used, thereby allowing the burn to succeed
        const burnPresigMessage = presignedBurnMessage(
          person3,
          usAccreditedIdType.toNumber(),
          validExpiryTimestamp,
          uniqueIdentity.address,
          1,
          network.chainId
        )
        const burnSig = await signer.signMessage(burnPresigMessage)
        await uniqueIdentity.burn(person3, usAccreditedIdType, validExpiryTimestamp, burnSig, {
          from: person3,
        })
        expect(await uniqueIdentity.balanceOf(person3, nonUSIdType)).to.bignumber.eq(new BN(0))
        expect(await uniqueIdentity.balanceOf(person3, usAccreditedIdType)).to.bignumber.eq(new BN(0))
        expect(await uniqueIdentity.balanceOf(person3, usNonAccreditedIdType)).to.bignumber.eq(new BN(0))
        expect(await uniqueIdentity.balanceOf(person3, usEntityIdType)).to.bignumber.eq(new BN(0))
        expect(await uniqueIdentity.balanceOf(person3, nonUsEntityIdType)).to.bignumber.eq(new BN(0))
      }).timeout(TEST_TIMEOUT)
    })

    describe("US entity", () => {
      it("returns a signature that can be used to mint", async () => {
        await uniqueIdentity.setSupportedUIDTypes([usEntityIdType], [true])

        const mintPresigMessage = presignedMintMessage(
          person3,
          usEntityIdType.toNumber(),
          validExpiryTimestamp,
          uniqueIdentity.address,
          0,
          network.chainId
        )
        const mintSig = await signer.signMessage(mintPresigMessage)

        await uniqueIdentity.mint(usEntityIdType, validExpiryTimestamp, mintSig, {
          from: person3,
          value: web3.utils.toWei("0.00083"),
        })
        expect(await uniqueIdentity.balanceOf(person3, nonUSIdType)).to.bignumber.eq(new BN(0))
        expect(await uniqueIdentity.balanceOf(person3, usAccreditedIdType)).to.bignumber.eq(new BN(0))
        expect(await uniqueIdentity.balanceOf(person3, usNonAccreditedIdType)).to.bignumber.eq(new BN(0))
        expect(await uniqueIdentity.balanceOf(person3, usEntityIdType)).to.bignumber.eq(new BN(1))
        expect(await uniqueIdentity.balanceOf(person3, nonUsEntityIdType)).to.bignumber.eq(new BN(0))

        // Indirectly test that the nonce is correctly used, thereby allowing the burn to succeed
        const burnPresigMessage = presignedBurnMessage(
          person3,
          usEntityIdType.toNumber(),
          validExpiryTimestamp,
          uniqueIdentity.address,
          1,
          network.chainId
        )
        const burnSig = await signer.signMessage(burnPresigMessage)
        await uniqueIdentity.burn(person3, usEntityIdType, validExpiryTimestamp, burnSig, {
          from: person3,
        })
        expect(await uniqueIdentity.balanceOf(person3, nonUSIdType)).to.bignumber.eq(new BN(0))
        expect(await uniqueIdentity.balanceOf(person3, usAccreditedIdType)).to.bignumber.eq(new BN(0))
        expect(await uniqueIdentity.balanceOf(person3, usNonAccreditedIdType)).to.bignumber.eq(new BN(0))
        expect(await uniqueIdentity.balanceOf(person3, usEntityIdType)).to.bignumber.eq(new BN(0))
        expect(await uniqueIdentity.balanceOf(person3, nonUsEntityIdType)).to.bignumber.eq(new BN(0))
      }).timeout(TEST_TIMEOUT)
    })

    describe("non US entity", () => {
      it("returns a signature that can be used to mint", async () => {
        await uniqueIdentity.setSupportedUIDTypes([nonUsEntityIdType], [true])

        const mintPresigMessage = presignedMintMessage(
          person3,
          nonUsEntityIdType.toNumber(),
          validExpiryTimestamp,
          uniqueIdentity.address,
          0,
          network.chainId
        )
        const mintSig = await signer.signMessage(mintPresigMessage)

        await uniqueIdentity.mint(nonUsEntityIdType, validExpiryTimestamp, mintSig, {
          from: person3,
          value: web3.utils.toWei("0.00083"),
        })
        expect(await uniqueIdentity.balanceOf(person3, nonUSIdType)).to.bignumber.eq(new BN(0))
        expect(await uniqueIdentity.balanceOf(person3, usAccreditedIdType)).to.bignumber.eq(new BN(0))
        expect(await uniqueIdentity.balanceOf(person3, usNonAccreditedIdType)).to.bignumber.eq(new BN(0))
        expect(await uniqueIdentity.balanceOf(person3, usEntityIdType)).to.bignumber.eq(new BN(0))
        expect(await uniqueIdentity.balanceOf(person3, nonUsEntityIdType)).to.bignumber.eq(new BN(1))

        // Indirectly test that the nonce is correctly used, thereby allowing the burn to succeed
        const burnPresigMessage = presignedBurnMessage(
          person3,
          nonUsEntityIdType.toNumber(),
          validExpiryTimestamp,
          uniqueIdentity.address,
          1,
          network.chainId
        )
        const burnSig = await signer.signMessage(burnPresigMessage)
        await uniqueIdentity.burn(person3, nonUsEntityIdType, validExpiryTimestamp, burnSig, {
          from: person3,
        })
        expect(await uniqueIdentity.balanceOf(person3, nonUSIdType)).to.bignumber.eq(new BN(0))
        expect(await uniqueIdentity.balanceOf(person3, usAccreditedIdType)).to.bignumber.eq(new BN(0))
        expect(await uniqueIdentity.balanceOf(person3, usNonAccreditedIdType)).to.bignumber.eq(new BN(0))
        expect(await uniqueIdentity.balanceOf(person3, usEntityIdType)).to.bignumber.eq(new BN(0))
        expect(await uniqueIdentity.balanceOf(person3, nonUsEntityIdType)).to.bignumber.eq(new BN(0))
      }).timeout(TEST_TIMEOUT)
    })
  })
})
