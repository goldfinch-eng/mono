import {GoldfinchPrime, GoldfinchConfig, ERC20, UniqueIdentity} from "@goldfinch-eng/goldfinch-prime/typechain/ethers"
import {assertNonNullable, assertIsString} from "@goldfinch-eng/utils"
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers"
import {expect} from "chai"
import hre, {ethers} from "hardhat"

import {getBaseDeployWithDeployEffectsParams} from "../../blockchain_scripts/baseDeploy"
import {CONFIG_KEYS} from "../../blockchain_scripts/configKeys"
import {
  getUSDCAddress,
  getSignerForAddress,
  MAINNET_CHAIN_ID,
  getEthersContract,
  getProtocolOwner,
  getWarblerAddress,
} from "../../blockchain_scripts/deployHelpers"
import {fundWithWhales} from "../../blockchain_scripts/helpers/fundWithWhales"
import {impersonateAccount} from "../../blockchain_scripts/helpers/impersonateAccount"
import {MAINNET_GOVERNANCE_MULTISIG} from "../../blockchain_scripts/mainnetForkingHelpers"
import {mintUid} from "../ethersHelpers/uniqueIdentityEthers"

const {deployments} = hre

// Helper to convert USDC amounts (6 decimals)
const usdcVal = (amount: number) => ethers.utils.parseUnits(amount.toString(), 6)

const setupTest = deployments.createFixture(async () => {
  const {getNamedAccounts} = hre
  const {gf_deployer, protocol_owner} = await getNamedAccounts()
  assertNonNullable(protocol_owner)
  assertNonNullable(gf_deployer)

  // Fund accounts for deployments using hardhat's built-in setBalance
  await hre.network.provider.send("hardhat_setBalance", [
    gf_deployer,
    "0x100000000000000000000000", // 1M ETH
  ])
  await hre.network.provider.send("hardhat_setBalance", [
    protocol_owner,
    "0x100000000000000000000000", // 1M ETH
  ])

  // Run the base deployment which includes GPrime and execute deferred effects
  const baseDeploy = getBaseDeployWithDeployEffectsParams({
    deployEffectsParams: {
      title: "Test GPrime Deploy",
      description: "Deploy GPrime contract and integrate with GoldfinchConfig for testing",
    },
  })
  await baseDeploy(hre)

  // Ensure the multisig has funds
  const [_owner] = (await hre.ethers.getSigners()) as SignerWithAddress[]
  assertNonNullable(_owner, "Owner signer is null")
  const owner = _owner
  await owner.sendTransaction({
    to: MAINNET_GOVERNANCE_MULTISIG,
    value: hre.ethers.utils.parseEther("10.0"),
  })

  await impersonateAccount(hre, MAINNET_GOVERNANCE_MULTISIG)

  // Get deployed contracts
  const goldfinchConfig = await getEthersContract<GoldfinchConfig>("GoldfinchConfig")
  const gPrimeAddress = await goldfinchConfig.getAddress(CONFIG_KEYS.GPrime)
  const gPrime = await getEthersContract<GoldfinchPrime>("GoldfinchPrime", {at: gPrimeAddress})

  const usdcAddress = getUSDCAddress(MAINNET_CHAIN_ID)
  assertIsString(usdcAddress)
  const usdc = await getEthersContract<ERC20>("ERC20", {at: usdcAddress})

  return {
    gPrime,
    goldfinchConfig,
    usdc,
    owner,
  }
})

describe("GoldfinchPrime Mainnet Forking", async function () {
  let gPrime: GoldfinchPrime
  let goldfinchConfig: GoldfinchConfig
  let usdc: ERC20
  let user: SignerWithAddress

  beforeEach(async function () {
    // Set longer timeout for mainnet forking tests
    this.timeout(180000) // 3 mins

    const setup = await setupTest()
    gPrime = setup.gPrime
    goldfinchConfig = setup.goldfinchConfig
    usdc = setup.usdc
    const signers = (await hre.ethers.getSigners()) as SignerWithAddress[]
    assertNonNullable(signers[1], "User signer is null")
    user = signers[1] // Use second account as user

    // Fund user with ETH and USDC for tests
    await hre.network.provider.send("hardhat_setBalance", [
      await user.getAddress(),
      "0x100000000000000000000000", // 1M ETH
    ])
    await fundWithWhales(["USDC"], [await user.getAddress()])
  })

  describe("Base Deployment", () => {
    it("should deploy GPrime and set it in config", async () => {
      console.log("Beginning the actual test...")
      const gPrimeAddress = await goldfinchConfig.getAddress(CONFIG_KEYS.GPrime)
      expect(gPrimeAddress).to.equal(gPrime.address)
    })

    it("should initialize with correct parameters", async () => {
      console.log("Checking share price...")
      expect(await gPrime.sharePrice()).to.equal(hre.ethers.utils.parseEther("1"))

      // Get both protocol owner and admin to debug
      const protocol_owner = await getProtocolOwner()
      const warbler = await getWarblerAddress()

      const hasManagerRole = await gPrime.hasRole(await gPrime.MANAGER_ROLE(), warbler)
      expect(hasManagerRole).to.be.true

      const hasAdminRole = await gPrime.hasRole(await gPrime.DEFAULT_ADMIN_ROLE(), protocol_owner)
      expect(hasAdminRole).to.be.true
    })

    it("should be properly connected to config", async () => {
      expect(await gPrime.config()).to.equal(goldfinchConfig.address)
    })
  })

  describe("Post-deployment Functionality", () => {
    async function setupUserWithUid(userSigner: SignerWithAddress) {
      // Fund user with ETH and USDC
      await hre.network.provider.send("hardhat_setBalance", [
        await userSigner.getAddress(),
        "0x100000000000000000000000", // 1M ETH
      ])
      await fundWithWhales(["USDC"], [await userSigner.getAddress()])

      // Grant UID type 0
      const uid = await getEthersContract<UniqueIdentity>("UniqueIdentity")
      const protocolOwner = (await getSignerForAddress(await getProtocolOwner())) as SignerWithAddress
      assertNonNullable(protocolOwner)
      await mintUid(uid, userSigner, 0, protocolOwner)
    }

    it("should allow deposits with proper UID", async () => {
      const depositAmount = usdcVal(1000)

      // Grant UID type 0 to user
      const uid = await getEthersContract<UniqueIdentity>("UniqueIdentity")
      const protocolOwner = (await getSignerForAddress(await getProtocolOwner())) as SignerWithAddress
      assertNonNullable(protocolOwner)
      await mintUid(uid, user, 0, protocolOwner)

      // Approve and deposit
      await usdc.connect(user).approve(gPrime.address, depositAmount)
      await gPrime.connect(user).deposit(depositAmount)

      expect(await gPrime.balanceOf(await user.getAddress())).to.be.gt(0)
      expect(await gPrime.availableToDrawdown()).to.equal(depositAmount)
    })

    it("should allow manager to update share price", async () => {
      const newSharePrice = hre.ethers.utils.parseEther("1.1") // $1.10
      const warbler = await getSignerForAddress(await getWarblerAddress())
      assertNonNullable(warbler)

      await gPrime.connect(warbler).updateSharePrice(newSharePrice)
      expect(await gPrime.sharePrice()).to.equal(newSharePrice)
    })

    it("should handle full lifecycle with multiple users", async () => {
      // Get three users
      const signers = (await hre.ethers.getSigners()) as SignerWithAddress[]
      const [user1, user2, user3] = [signers[1], signers[2], signers[3]]
      assertNonNullable(user1, "User1 signer is null")
      assertNonNullable(user2, "User2 signer is null")
      assertNonNullable(user3, "User3 signer is null")

      // Setup all users with UIDs and USDC
      await setupUserWithUid(user1)
      await setupUserWithUid(user2)
      await setupUserWithUid(user3)

      // 1. Initial deposits from user1 and user2
      const depositAmount1 = usdcVal(1000)
      const depositAmount2 = usdcVal(2000)

      await usdc.connect(user1).approve(gPrime.address, depositAmount1)
      await gPrime.connect(user1).deposit(depositAmount1)

      await usdc.connect(user2).approve(gPrime.address, depositAmount2)
      await gPrime.connect(user2).deposit(depositAmount2)

      // Verify initial deposits
      const user1Shares = await gPrime.balanceOf(user1.address)
      const user2Shares = await gPrime.balanceOf(user2.address)
      expect(user1Shares).to.equal(hre.ethers.utils.parseEther("1000")) // 1:1 ratio initially
      expect(user2Shares).to.equal(hre.ethers.utils.parseEther("2000"))
      expect(await gPrime.availableToDrawdown()).to.equal(depositAmount1.add(depositAmount2))

      // 2. Manager drawdowns funds and increases share price by 10%
      const warbler = await getSignerForAddress(await getWarblerAddress())
      const protocolOwner = await getProtocolOwner()
      assertNonNullable(warbler)

      // Drawdown all available funds
      const availableToDrawdown = await gPrime.availableToDrawdown()
      const managerUsdcBefore = await usdc.balanceOf(await warbler.getAddress())
      await gPrime.connect(warbler).drawdown(availableToDrawdown)
      const managerUsdcAfter = await usdc.balanceOf(await warbler.getAddress())

      // Verify drawdown
      expect(await gPrime.availableToDrawdown()).to.equal(0)
      expect(managerUsdcAfter.sub(managerUsdcBefore)).to.equal(availableToDrawdown)

      // Increase share price
      const newSharePrice = hre.ethers.utils.parseEther("1.1") // $1.10
      await gPrime.connect(warbler).updateSharePrice(newSharePrice)
      expect(await gPrime.sharePrice()).to.equal(newSharePrice)

      // 3. User1 requests full withdrawal
      await gPrime.connect(user1).requestRedemption(user1Shares)
      const user1Request = await gPrime.redemptionRequests(user1.address)
      expect(user1Request.totalSharesRequested).to.equal(user1Shares)
      expect(user1Request.sharesRedeemed).to.equal(0)

      // 4. Manager fulfills user1's withdrawal
      const user1UsdcValue = await gPrime.getShareValue(user1Shares)
      // Fund manager with USDC for fulfillment
      await fundWithWhales(["USDC"], [await warbler.getAddress()])
      await usdc.connect(warbler).approve(gPrime.address, user1UsdcValue)
      const protocolOwnerBefore = await usdc.balanceOf(protocolOwner)
      console.log("protocol owner in tests is:", protocolOwner)
      const expectedProtocolOwnerUsdc = user1UsdcValue.mul(50).div(10000)
      await gPrime.connect(warbler).fulfillRedemption(user1.address, user1UsdcValue)
      const protocolOwnerAfter = await usdc.balanceOf(protocolOwner)
      // Verify the gov wallet received the 0.5% fee
      expect(protocolOwnerAfter.sub(protocolOwnerBefore)).to.equal(expectedProtocolOwnerUsdc)

      // 5. User1 redeems their USDC
      const user1UsdcBefore = await usdc.balanceOf(user1.address)
      await gPrime.connect(user1).withdraw()
      const user1UsdcAfter = await usdc.balanceOf(user1.address)
      // Account for 0.5% withdrawal fee
      const expectedUser1Usdc = user1UsdcValue.mul(9950).div(10000)
      expect(user1UsdcAfter.sub(user1UsdcBefore)).to.equal(expectedUser1Usdc)

      // 6. User3 deposits
      const depositAmount3 = usdcVal(3000)
      await usdc.connect(user3).approve(gPrime.address, depositAmount3)
      await gPrime.connect(user3).deposit(depositAmount3)
      const user3Shares = await gPrime.balanceOf(user3.address)
      // At 1.1 share price, should get fewer shares than USDC
      expect(user3Shares).to.equal(hre.ethers.utils.parseEther("2727.272727272727272727")) // 3000/1.1

      // 7. User2 requests partial redemption (half their shares)
      const user2RedemptionAmount = user2Shares.div(2)
      await gPrime.connect(user2).requestRedemption(user2RedemptionAmount)
      const user2Request = await gPrime.redemptionRequests(user2.address)
      expect(user2Request.totalSharesRequested).to.equal(user2RedemptionAmount)

      // 8. Manager fulfills user2's withdrawal
      const user2UsdcValue = await gPrime.getShareValue(user2RedemptionAmount)
      // Fund manager with USDC for fulfillment
      await fundWithWhales(["USDC"], [await warbler.getAddress()])
      await usdc.connect(warbler).approve(gPrime.address, user2UsdcValue)
      await gPrime.connect(warbler).fulfillRedemption(user2.address, user2UsdcValue)

      // 9. User2 redeems their USDC
      const user2UsdcBefore = await usdc.balanceOf(user2.address)
      await gPrime.connect(user2).withdraw()
      const user2UsdcAfter = await usdc.balanceOf(user2.address)
      // Account for 0.5% withdrawal fee
      const expectedUser2Usdc = user2UsdcValue.mul(9950).div(10000)
      expect(user2UsdcAfter.sub(user2UsdcBefore)).to.equal(expectedUser2Usdc)

      // Verify final state
      expect(await gPrime.balanceOf(user1.address)).to.equal(0)
      expect(await gPrime.balanceOf(user2.address)).to.equal(user2Shares.div(2))
      expect(await gPrime.balanceOf(user3.address)).to.equal(user3Shares)
    })
  })
})
