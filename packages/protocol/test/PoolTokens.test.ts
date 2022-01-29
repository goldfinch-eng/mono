/* global web3 artifacts */
import {
  expect,
  decodeLogs,
  usdcVal,
  expectAction,
  ZERO_ADDRESS,
  erc20Transfer,
  erc20Approve,
  SECONDS_PER_DAY,
  getCurrentTimestamp,
  advanceTime,
  setupBackerRewards,
} from "./testHelpers"
import {OWNER_ROLE, interestAprAsBN, GO_LISTER_ROLE} from "../blockchain_scripts/deployHelpers"
import hre from "hardhat"
import BN from "bn.js"
import {asNonNullable, assertNonNullable} from "@goldfinch-eng/utils"
const {deployments} = hre
const TranchedPool = artifacts.require("TranchedPool")
import {expectEvent} from "@openzeppelin/test-helpers"
import {mint} from "./uniqueIdentityHelpers"
import {GFIInstance, BackerRewardsInstance, TranchedPoolInstance} from "../typechain/truffle"
import {deployBaseFixture, deployUninitializedTranchedPoolFixture} from "./util/fixtures"

const testSetup = deployments.createFixture(async ({deployments, getNamedAccounts}) => {
  const [_owner, _person2, _person3] = await web3.eth.getAccounts()
  const owner = asNonNullable(_owner)
  const person2 = asNonNullable(_person2)
  const person3 = asNonNullable(_person3)

  const {poolTokens, goldfinchConfig, goldfinchFactory, backerRewards, usdc, uniqueIdentity, gfi} =
    await deployBaseFixture()
  await goldfinchConfig.bulkAddToGoList([owner, person2])
  await erc20Transfer(usdc, [person2], usdcVal(1000), owner)

  return {
    owner,
    person2,
    person3,
    poolTokens,
    backerRewards,
    goldfinchConfig,
    goldfinchFactory,
    usdc,
    uniqueIdentity,
    gfi,
  }
})

describe("PoolTokens", () => {
  let owner,
    person2,
    person3,
    goldfinchConfig,
    poolTokens,
    pool,
    goldfinchFactory,
    usdc,
    uniqueIdentity,
    backerRewards: BackerRewardsInstance,
    gfi: GFIInstance

  const withPoolSender = async (func, otherPoolAddress?) => {
    // We need to fake the address so we can bypass the pool
    await poolTokens._setSender(otherPoolAddress || pool.address)
    return func().then(async (res) => {
      await poolTokens._setSender("0x0000000000000000000000000000000000000000")
      return res
    })
  }

  beforeEach(async () => {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;({
      owner,
      person2,
      person3,
      poolTokens,
      goldfinchConfig,
      goldfinchFactory,
      usdc,
      uniqueIdentity,
      backerRewards,
      gfi,
    } = await testSetup())

    await poolTokens._disablePoolValidation(true)
  })

  async function addToLegacyGoList(target, goLister) {
    expect(await goldfinchConfig.goList(target)).to.equal(false)
    expect(await goldfinchConfig.hasRole(GO_LISTER_ROLE, goLister)).to.equal(true)
    await goldfinchConfig.addToGoList(target, {from: goLister})
    expect(await goldfinchConfig.goList(target)).to.equal(true)
  }

  async function mintUniqueIdentityToken(recipient, signer) {
    const uniqueIdentityTokenId = new BN(0)
    const expiresAt = (await getCurrentTimestamp()).add(SECONDS_PER_DAY)
    await uniqueIdentity.setSupportedUIDTypes([uniqueIdentityTokenId], [true])
    await mint(hre, uniqueIdentity, uniqueIdentityTokenId, expiresAt, new BN(0), signer, undefined, recipient)
    expect(await uniqueIdentity.balanceOf(recipient, uniqueIdentityTokenId)).to.bignumber.equal(new BN(1))
  }

  describe("initialization", async () => {
    it("should not allow it to be called twice", async () => {
      return expect(poolTokens.__initialize__(owner, goldfinchConfig.address)).to.be.rejectedWith(
        /has already been initialized/
      )
    })
  })

  describe("ownership", async () => {
    it("should be owned by the owner", async () => {
      expect(await poolTokens.hasRole(OWNER_ROLE, owner)).to.be.true
    })
  })

  describe("mint", async () => {
    beforeEach(async function () {
      const result = await goldfinchFactory.createPool(
        person2,
        new BN(20),
        usdcVal(100),
        interestAprAsBN("15.0"),
        new BN(30),
        new BN(365),
        new BN(0),
        new BN(185),
        new BN(0),
        [],
        {from: owner}
      )
      const event = result.logs[result.logs.length - 1]
      pool = await TranchedPool.at(event.args.pool)
      // grant role so the person can deposit into the senior tranche
      await pool.grantRole(await pool.SENIOR_ROLE(), person2)
      await erc20Approve(usdc, pool.address, usdcVal(100000), [person2])
    })

    context("with real pool validation turned on", async () => {
      beforeEach(async () => {
        await poolTokens._disablePoolValidation(false)
      })
      it("should allow validly created pools to call the mint function", async () => {
        return expect(pool.deposit(new BN(1), usdcVal(5), {from: person2})).to.be.fulfilled
      })

      it("should disallow invalidly created pools", async () => {
        // Wasn't created through our factory
        const {tranchedPool: fakePool} = await deployUninitializedTranchedPoolFixture()
        await fakePool.initialize(
          goldfinchConfig.address,
          person2,
          new BN(20),
          usdcVal(1000),
          new BN(15000),
          new BN(30),
          new BN(360),
          new BN(350),
          new BN(180),
          new BN(0),
          []
        )
        // grant role so the person can deposit into the senior tranche
        await fakePool.grantRole(await fakePool.SENIOR_ROLE(), person2)

        return expect(fakePool.deposit(new BN(1), usdcVal(5), {from: person2})).to.be.rejectedWith(/Invalid pool/)
      })
    })

    it("should mint a token with correct info", async () => {
      const amount = usdcVal(5)
      const result = await pool.deposit(new BN(1), amount, {from: person2})
      const event = decodeLogs(result.receipt.rawLogs, poolTokens, "TokenMinted")[0]
      assertNonNullable(event)
      const tokenInfo = await poolTokens.getTokenInfo(event.args.tokenId)
      expect(tokenInfo.pool).to.equal(pool.address)
      expect(tokenInfo.principalAmount).to.bignumber.equal(amount)
      expect(tokenInfo.principalRedeemed).to.bignumber.equal(new BN(0))
      expect(tokenInfo.interestRedeemed).to.bignumber.equal(new BN(0))
    })

    it("should call BackerRewards with tokenId after minting", async () => {
      const amount = usdcVal(5)
      const result = await pool.deposit(new BN(1), amount, {from: person2})
      const event = decodeLogs(result.receipt.rawLogs, poolTokens, "TokenMinted")[0]
      assertNonNullable(event)
      const backerRewardsTokenInfo = await backerRewards.tokens(event.args.tokenId)
      const accRewardsPerPrincipalDollarAtMint = backerRewardsTokenInfo["accRewardsPerPrincipalDollarAtMint"]
      expect(accRewardsPerPrincipalDollarAtMint).to.bignumber.equal(new BN(0))
    })

    it("should use the current rewardsPerPrincipalShare when it's a second drawdown", async () => {
      await setupBackerRewards(gfi, backerRewards, owner)

      const amount = usdcVal(5)
      await pool.deposit(new BN(1), amount, {from: person2})
      await pool.deposit(new BN(2), amount, {from: person2})
      await pool.lockJuniorCapital({from: person2})
      await pool.lockPool({from: person2})
      await pool.drawdown(usdcVal(10), {from: person2})

      // Ensure pool has some interest rewards allocated to it advancing time and paying interest
      await advanceTime({days: new BN(100)})
      await pool.pay(usdcVal(5), {from: person2})
      await pool.initializeNextSlice(new BN(0), {from: person2})

      const result = await pool.deposit(new BN(3), amount, {from: person2})
      const event = decodeLogs(result.receipt.rawLogs, poolTokens, "TokenMinted")[0]
      assertNonNullable(event)
      const backerRewardsTokenInfo = await backerRewards.tokens(event.args.tokenId)
      const accRewardsPerPrincipalDollarAtMint = backerRewardsTokenInfo["accRewardsPerPrincipalDollarAtMint"]
      expect(accRewardsPerPrincipalDollarAtMint).to.bignumber.gt(new BN(0))
    })

    it("allows minting even after the limit on the PoolInfo", async () => {
      const amount = usdcVal(50)
      await pool.deposit(new BN(1), amount, {from: person2})
      const amountThatPutsUsOver = usdcVal(51)
      // This is allowed because the pool will let the depositors redeem unused principal
      await expect(pool.deposit(new BN(1), amountThatPutsUsOver, {from: person2})).to.be.fulfilled
    })

    it("should emit an event", async () => {
      const amount = usdcVal(2)
      const result = await pool.deposit(new BN(1), amount, {from: person2})
      const tokenMinted = decodeLogs(result.receipt.rawLogs, poolTokens, "TokenMinted")[0]
      assertNonNullable(tokenMinted)
      expect(tokenMinted.args.owner).to.equal(person2)
      expect(tokenMinted.args.pool).to.equal(pool.address)
      expect(tokenMinted.args.tokenId).to.exist
      expect(tokenMinted.args.amount).to.bignumber.equal(amount)
      expect(tokenMinted.args.tranche).to.bignumber.equal(new BN(1))
    })

    context("paused", async () => {
      it("reverts", async () => {
        // TODO
      })
    })
  })

  describe("redeem", async () => {
    let tokenIdA, mintAmountA, tokenIdB, mintAmountB
    beforeEach(async function () {
      let result = await goldfinchFactory.createPool(
        person2,
        new BN(20),
        usdcVal(100),
        interestAprAsBN("15.0"),
        new BN(30),
        new BN(365),
        new BN(0),
        new BN(185),
        new BN(0),
        [],
        {from: owner}
      )
      let event = result.logs[result.logs.length - 1]
      pool = await TranchedPool.at(event.args.pool)
      // grant role so the person can deposit into the senior tranche
      await pool.grantRole(await pool.SENIOR_ROLE(), person2)

      await erc20Approve(usdc, pool.address, usdcVal(100000), [person2])

      mintAmountA = usdcVal(5)
      result = await pool.deposit(new BN(1), mintAmountA, {from: person2})
      event = decodeLogs(result.receipt.rawLogs, poolTokens, "TokenMinted")[0]
      tokenIdA = event.args.tokenId

      mintAmountB = usdcVal(50)
      result = await pool.deposit(new BN(1), mintAmountB, {from: person2})
      event = decodeLogs(result.receipt.rawLogs, poolTokens, "TokenMinted")[0]
      tokenIdB = event.args.tokenId
    })

    const redeemToken = async (tokenId, principal, interest) => {
      // We need to fake the address so we can bypass the pool
      return withPoolSender(() => poolTokens.redeem(tokenId, principal, interest))
    }

    it("should update the token with the new info", async () => {
      const principalRedeemed = usdcVal(1)
      const interestRedeemed = usdcVal(2)
      await redeemToken(tokenIdA, principalRedeemed, interestRedeemed)
      const tokenInfo = await poolTokens.getTokenInfo(tokenIdA)
      expect(tokenInfo.principalRedeemed).to.bignumber.eq(principalRedeemed)
      expect(tokenInfo.interestRedeemed).to.bignumber.eq(interestRedeemed)
    })

    it("should only allow redemption up to the total minted of the pool", async () => {
      const totalMinted = mintAmountA.add(mintAmountB)
      const principalRedeemed = totalMinted.add(usdcVal(1))
      const interestRedeemed = usdcVal(0)
      const excessiveRedemption = redeemToken(tokenIdB, principalRedeemed, interestRedeemed)
      return expect(excessiveRedemption).to.be.rejectedWith(/Cannot redeem more than we minted/)
    })

    it("should allow a single principal-redemption equal to a token's principal-deposited amount", async () => {
      const principalRedeemed = mintAmountA
      const interestRedeemed = usdcVal(0)
      const maxRedemption = redeemToken(tokenIdA, principalRedeemed, interestRedeemed)
      return expect(maxRedemption).to.be.fulfilled
    })

    it("should allow a single principal-redemption less than a token's principal-deposited amount", async () => {
      const principalRedeemed = mintAmountA.sub(usdcVal(1))
      const interestRedeemed = usdcVal(0)
      const okRedemption = redeemToken(tokenIdA, principalRedeemed, interestRedeemed)
      return expect(okRedemption).to.be.fulfilled
    })

    it("should allow a second principal-redemption that would cause a token's total principal redeemed to equal its principal-deposited amount", async () => {
      const principalRedeemed1 = mintAmountA.sub(usdcVal(1))
      const interestRedeemed1 = usdcVal(0)
      const okRedemption1 = redeemToken(tokenIdA, principalRedeemed1, interestRedeemed1)
      await expect(okRedemption1).to.be.fulfilled
      const principalRedeemed2 = usdcVal(1)
      const interestRedeemed2 = usdcVal(0)
      const okRedemption2 = redeemToken(tokenIdA, principalRedeemed2, interestRedeemed2)
      return expect(okRedemption2).to.be.fulfilled
    })

    it("should prohibit a single principal-redemption of more than a token's principal-deposited amount", async () => {
      const principalRedeemed = mintAmountA.add(usdcVal(1))
      const interestRedeemed = usdcVal(0)
      const excessiveRedemption = redeemToken(tokenIdA, principalRedeemed, interestRedeemed)
      return expect(excessiveRedemption).to.be.rejectedWith(
        /Cannot redeem more than principal-deposited amount for token/
      )
    })

    it("should prohibit a second principal-redemption that would cause a token's total principal redeemed to exceed its principal-deposited amount", async () => {
      const principalRedeemed1 = mintAmountA.sub(usdcVal(1))
      const interestRedeemed1 = usdcVal(0)
      const okRedemption = redeemToken(tokenIdA, principalRedeemed1, interestRedeemed1)
      await expect(okRedemption).to.be.fulfilled
      const principalRedeemed2 = usdcVal(2)
      const interestRedeemed2 = usdcVal(0)
      const excessiveRedemption = redeemToken(tokenIdA, principalRedeemed2, interestRedeemed2)
      return expect(excessiveRedemption).to.be.rejectedWith(
        /Cannot redeem more than principal-deposited amount for token/
      )
    })

    it("should disallow redeeming tokens that don't exist", async () => {
      const interestRedeemed = usdcVal(2)
      const randomTokenId = "42"
      return expect(redeemToken(randomTokenId, mintAmountA, interestRedeemed)).to.be.rejectedWith(/Invalid tokenId/)
    })

    it("should only allow redemptions that come from the token's pool", async () => {
      const interestRedeemed = usdcVal(2)
      const fakePoolRedemption = withPoolSender(
        () => poolTokens.redeem(tokenIdA, mintAmountA, interestRedeemed),
        person2
      )
      return expect(fakePoolRedemption).to.be.rejectedWith(/Only the token's pool can redeem/)
    })

    it("should emit an event", async () => {
      const interestRedeemed = usdcVal(2)
      const result = await redeemToken(tokenIdA, mintAmountA, interestRedeemed)
      const tokenRedeemedEvent = result.logs[0]
      expect(tokenRedeemedEvent.event).to.eq("TokenRedeemed")
      expect(tokenRedeemedEvent.args.owner).to.equal(person2)
      expect(tokenRedeemedEvent.args.pool).to.equal(pool.address)
      expect(tokenRedeemedEvent.args.tokenId).to.bignumber.equal(tokenIdA)
      expect(tokenRedeemedEvent.args.principalRedeemed).to.bignumber.equal(mintAmountA)
      expect(tokenRedeemedEvent.args.interestRedeemed).to.bignumber.equal(interestRedeemed)
      const tokenInfo = await poolTokens.getTokenInfo(tokenIdA)
      expect(tokenRedeemedEvent.args.tranche).to.bignumber.equal(tokenInfo.tranche)
    })

    context("paused", async () => {
      it("reverts", async () => {
        // TODO
      })
    })
  })

  describe("burning", async () => {
    let tokenId, mintAmount
    beforeEach(async function () {
      let result = await goldfinchFactory.createPool(
        person2,
        new BN(20),
        usdcVal(100),
        interestAprAsBN("15.0"),
        new BN(30),
        new BN(365),
        new BN(0),
        new BN(185),
        new BN(0),
        [],
        {from: owner}
      )
      let event = result.logs[result.logs.length - 1]
      pool = await TranchedPool.at(event.args.pool)
      // grant role so the person can deposit into the senior tranche
      await pool.grantRole(await pool.SENIOR_ROLE(), person2)

      await erc20Approve(usdc, pool.address, usdcVal(100000), [person2])

      mintAmount = usdcVal(5)
      result = await pool.deposit(new BN(1), mintAmount, {from: person2})
      event = decodeLogs(result.receipt.rawLogs, poolTokens, "TokenMinted")[0]
      tokenId = event.args.tokenId
    })

    it("should disallow burning if the token isn't fully redeemed", async () => {
      return expect(withPoolSender(() => poolTokens.burn(tokenId))).to.be.rejectedWith(/Can only burn fully redeemed/)
    })

    it("should allow burning once fully redeemed", async () => {
      await withPoolSender(() => poolTokens.redeem(tokenId, mintAmount, new BN(0)))
      return expect(withPoolSender(() => poolTokens.burn(tokenId))).to.be.fulfilled
    })

    it("burning should zero out all data associated with that tokenId", async () => {
      await withPoolSender(() => poolTokens.redeem(tokenId, mintAmount, new BN(0)))
      await expectAction(() => withPoolSender(() => poolTokens.burn(tokenId))).toChange([
        [async () => (await poolTokens.getTokenInfo(tokenId)).principalAmount, {to: new BN(0)}],
        [async () => (await poolTokens.getTokenInfo(tokenId)).principalRedeemed, {to: new BN(0)}],
        [async () => (await poolTokens.getTokenInfo(tokenId)).pool, {to: ZERO_ADDRESS, bignumber: false}],
      ])
      return expect(poolTokens.ownerOf(tokenId)).to.be.rejectedWith(/owner query for nonexistent token/)
    })

    it("should emit an event", async () => {
      await withPoolSender(() => poolTokens.redeem(tokenId, mintAmount, new BN(0)))
      const result = await withPoolSender(() => poolTokens.burn(tokenId))
      const tokenBurnedEvent = result.logs[2]
      expect(tokenBurnedEvent.event).to.eq("TokenBurned")
      expect(tokenBurnedEvent.args.owner).to.equal(person2)
      expect(tokenBurnedEvent.args.pool).to.equal(pool.address)
      expect(tokenBurnedEvent.args.tokenId).to.bignumber.equal(tokenId)
    })

    context("paused", async () => {
      it("reverts", async () => {
        // TODO
      })
    })
  })

  describe("safeTransfer", () => {
    // TODO

    context("paused", async () => {
      it("reverts", async () => {
        // TODO
      })
    })
  })

  describe("safeTransferFrom", () => {
    // TODO

    context("paused", async () => {
      it("reverts", async () => {
        // TODO
      })
    })
  })

  describe("go listing", async () => {
    let amount
    beforeEach(async function () {
      const result = await goldfinchFactory.createPool(
        person2,
        new BN(20),
        usdcVal(100),
        interestAprAsBN("15.0"),
        new BN(30),
        new BN(365),
        new BN(0),
        new BN(185),
        new BN(0),
        [],
        {from: owner}
      )
      const event = result.logs[result.logs.length - 1]
      pool = await TranchedPool.at(event?.args.pool)
    })
    describe("mint", async () => {
      beforeEach(async function () {
        amount = usdcVal(10)
      })

      context("account with 0 balance UniqueIdentity token (id 0)", () => {
        beforeEach(async () => {
          const uniqueIdentityTokenId = new BN(0)
          expect(await uniqueIdentity.balanceOf(person3, uniqueIdentityTokenId)).to.bignumber.equal(new BN(0))
        })

        context("account is on legacy go-list", () => {
          beforeEach(async () => {
            await addToLegacyGoList(person3, owner)
          })

          it("allows", async () => {
            return expect(
              withPoolSender(() => poolTokens.mint({principalAmount: String(amount), tranche: "1"}, person3))
            ).to.be.fulfilled
          })
        })
        context("account is not on legacy go-list", () => {
          beforeEach(async () => {
            expect(await goldfinchConfig.goList(person3)).to.equal(false)
          })

          it("allows", async () => {
            await expect(
              withPoolSender(() => poolTokens.mint({principalAmount: String(amount), tranche: "1"}, person3))
            ).to.be.fulfilled
          })
        })
      })

      context("account with > 0 balance UniqueIdentity token (id 0)", () => {
        beforeEach(async () => {
          await mintUniqueIdentityToken(person3, owner)
        })

        context("account is on legacy go-list", () => {
          beforeEach(async () => {
            await addToLegacyGoList(person3, owner)
          })

          it("allows", async () => {
            return expect(
              withPoolSender(() => poolTokens.mint({principalAmount: String(amount), tranche: "1"}, person3))
            ).to.be.fulfilled
          })
        })
        context("account is not on legacy go-list", () => {
          beforeEach(async () => {
            expect(await goldfinchConfig.goList(person3)).to.equal(false)
          })

          it("allows", async () => {
            return expect(
              withPoolSender(() => poolTokens.mint({principalAmount: String(amount), tranche: "1"}, person3))
            ).to.be.fulfilled
          })
        })
      })
    })

    describe("transferFrom", async () => {
      let tokenId

      beforeEach(async () => {
        const amount = usdcVal(5)
        // Give some tokens to person2
        const result = await withPoolSender(() =>
          poolTokens.mint({principalAmount: String(amount), tranche: "1"}, person2)
        )
        const event = result.logs[1]
        tokenId = event.args.tokenId
      })

      context("recipient with 0 balance UniqueIdentity token (id 0)", () => {
        beforeEach(async () => {
          const uniqueIdentityTokenId = new BN(0)
          expect(await uniqueIdentity.balanceOf(person3, uniqueIdentityTokenId)).to.bignumber.equal(new BN(0))
        })

        context("recipient is on legacy go-list", () => {
          beforeEach(async () => {
            await addToLegacyGoList(person3, owner)
          })

          it("allows transfer", async () => {
            await expect(poolTokens.transferFrom(person2, person3, tokenId, {from: person2})).to.be.fulfilled
          })
        })
        context("recipient is not on legacy go-list", () => {
          beforeEach(async () => {
            expect(await goldfinchConfig.goList(person3)).to.equal(false)
          })

          it("allows transfer", async () => {
            await expect(poolTokens.transferFrom(person2, person3, tokenId, {from: person2})).to.be.fulfilled
          })
        })
      })

      context("recipient with > 0 balance UniqueIdentity token (id 0)", () => {
        beforeEach(async () => {
          await mintUniqueIdentityToken(person3, owner)
        })

        context("recipient is on legacy go-list", () => {
          beforeEach(async () => {
            await addToLegacyGoList(person3, owner)
          })

          it("allows transfer", async () => {
            await expect(poolTokens.transferFrom(person2, person3, tokenId, {from: person2})).to.be.fulfilled
          })
        })
        context("recipient is not on legacy go-list", () => {
          beforeEach(async () => {
            expect(await goldfinchConfig.goList(person3)).to.equal(false)
          })

          it("allows transfer", async () => {
            await expect(poolTokens.transferFrom(person2, person3, tokenId, {from: person2})).to.be.fulfilled
          })
        })
      })
    })

    describe("safeTransferFrom", () => {
      // TODO Reuse logic from tests of `transferFrom()`.
    })
  })

  describe("updateGoldfinchConfig", async () => {
    describe("setting it", () => {
      it("emits an event", async () => {
        const newConfig = await deployments.deploy("GoldfinchConfig", {from: owner})
        await goldfinchConfig.setGoldfinchConfig(newConfig.address)
        const tx = await poolTokens.updateGoldfinchConfig()
        expectEvent(tx, "GoldfinchConfigUpdated", {
          who: owner,
          configAddress: newConfig.address,
        })
      })
    })

    context("paused", async () => {
      it("does not revert", async () => {
        // TODO
      })
    })
  })
})
