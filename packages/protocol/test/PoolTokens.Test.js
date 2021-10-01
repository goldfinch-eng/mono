/* global web3 artifacts */
const {
  expect,
  decodeLogs,
  usdcVal,
  expectAction,
  ZERO_ADDRESS,
  deployAllContracts,
  erc20Transfer,
  erc20Approve,
} = require("./testHelpers")
const {OWNER_ROLE, GO_LISTER_ROLE, interestAprAsBN} = require("../blockchain_scripts/deployHelpers")
const hre = require("hardhat")
const BN = require("bn.js")
const {deployments} = hre
const TranchedPool = artifacts.require("TranchedPool")
const {expectEvent} = require("@openzeppelin/test-helpers")
const {mint} = require("./goldfinchIdentityHelpers")

describe("PoolTokens", () => {
  let owner, person2, person3, goldfinchConfig, poolTokens, pool, goldfinchFactory, usdc, goldfinchIdentity

  const withPoolSender = async (func, otherPoolAddress) => {
    // We need to fake the address so we can bypass the pool
    await poolTokens._setSender(otherPoolAddress || pool.address)
    return func().then(async (res) => {
      await poolTokens._setSender("0x0000000000000000000000000000000000000000")
      return res
    })
  }

  const testSetup = deployments.createFixture(async ({deployments, getNamedAccounts}) => {
    const {protocol_owner} = await getNamedAccounts()
    // Just to be crystal clear
    owner = protocol_owner

    const {poolTokens, goldfinchConfig, goldfinchFactory, usdc, goldfinchIdentity} = await deployAllContracts(
      deployments
    )
    await goldfinchConfig.bulkAddToGoList([owner, person2])
    await erc20Transfer(usdc, [person2], usdcVal(1000), owner)

    return {poolTokens, goldfinchConfig, goldfinchFactory, usdc, goldfinchIdentity}
  })
  beforeEach(async () => {
    // Pull in our unlocked accounts
    ;[owner, person2, person3] = await web3.eth.getAccounts()
    ;({poolTokens, goldfinchConfig, goldfinchFactory, usdc, goldfinchIdentity} = await testSetup())

    await poolTokens._disablePoolValidation(true)
  })

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
        {from: owner}
      )
      const event = result.logs[result.logs.length - 1]
      pool = await TranchedPool.at(event.args.pool)
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
        const fakePool = await TranchedPool.new()
        await fakePool.initialize(
          goldfinchConfig.address,
          person2,
          new BN(20),
          usdcVal(1000),
          new BN(15000),
          new BN(30),
          new BN(360),
          new BN(350)
        )

        return expect(fakePool.deposit(new BN(1), usdcVal(5), {from: person2})).to.be.rejectedWith(/Invalid pool/)
      })
    })

    it("should mint a token with correct info", async () => {
      const amount = usdcVal(5)
      const result = await pool.deposit(new BN(1), amount, {from: person2})
      const event = decodeLogs(result.receipt.rawLogs, poolTokens, "TokenMinted")[0]
      const tokenInfo = await poolTokens.getTokenInfo(event.args.tokenId)
      expect(tokenInfo.pool).to.equal(pool.address)
      expect(tokenInfo.principalAmount).to.bignumber.equal(amount)
      expect(tokenInfo.principalRedeemed).to.bignumber.equal(new BN(0))
      expect(tokenInfo.interestRedeemed).to.bignumber.equal(new BN(0))
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
      expect(tokenMinted.event).to.eq("TokenMinted")
      expect(tokenMinted.args.owner).to.equal(person2)
      expect(tokenMinted.args.pool).to.equal(pool.address)
      expect(tokenMinted.args.tokenId).to.exist
      expect(tokenMinted.args.amount).to.bignumber.equal(amount)
      expect(tokenMinted.args.tranche).to.bignumber.equal(new BN(1))
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
        {from: owner}
      )
      let event = result.logs[result.logs.length - 1]
      pool = await TranchedPool.at(event.args.pool)

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
        {from: owner}
      )
      let event = result.logs[result.logs.length - 1]
      pool = await TranchedPool.at(event.args.pool)

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
  })

  describe("go listing", async () => {
    let amount
    beforeEach(async function () {
      let result = await goldfinchFactory.createPool(
        person2,
        new BN(20),
        usdcVal(100),
        interestAprAsBN("15.0"),
        new BN(30),
        new BN(365),
        new BN(0),
        {from: owner}
      )
      let event = result.logs[result.logs.length - 1]
      pool = await TranchedPool.at(event.args.pool)
    })
    describe("mint", async () => {
      beforeEach(async function () {
        amount = usdcVal(10)
      })

      context("account with 0 balance GoldfinchIdentity token (id 0)", () => {
        beforeEach(async () => {
          const goldfinchIdentityTokenId = new BN(0)
          expect(await goldfinchIdentity.balanceOf(person3, goldfinchIdentityTokenId)).to.bignumber.equal(new BN(0))
        })

        context("account is on legacy go-list", () => {
          beforeEach(async () => {
            expect(await goldfinchConfig.goList(person3)).to.equal(false)
            expect(await goldfinchConfig.hasRole(GO_LISTER_ROLE, owner)).to.equal(true)
            await goldfinchConfig.addToGoList(person3, {from: owner})
            expect(await goldfinchConfig.goList(person3)).to.equal(true)
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

          it("rejects", async () => {
            await expect(
              withPoolSender(() => poolTokens.mint({principalAmount: String(amount), tranche: "1"}, person3))
            ).to.be.rejectedWith(/has not been go-listed/)
          })
        })
      })

      context("account with > 0 balance GoldfinchIdentity token (id 0)", () => {
        beforeEach(async () => {
          const goldfinchIdentityTokenId = new BN(0)
          const goldfinchIdentityTokenAmount = new BN(1)
          await mint(
            hre,
            goldfinchIdentity,
            person3,
            goldfinchIdentityTokenId,
            goldfinchIdentityTokenAmount,
            new BN(0),
            owner
          )
          expect(await goldfinchIdentity.balanceOf(person3, goldfinchIdentityTokenId)).to.bignumber.equal(
            goldfinchIdentityTokenAmount
          )
        })

        context("account is on legacy go-list", () => {
          beforeEach(async () => {
            expect(await goldfinchConfig.goList(person3)).to.equal(false)
            expect(await goldfinchConfig.hasRole(GO_LISTER_ROLE, owner)).to.equal(true)
            await goldfinchConfig.addToGoList(person3, {from: owner})
            expect(await goldfinchConfig.goList(person3)).to.equal(true)
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
      // it("should respect the go list", async () => {
      //   const amount = usdcVal(5)
      //   // Give some tokens to person2
      //   const result = await withPoolSender(() =>
      //     poolTokens.mint({principalAmount: String(amount), tranche: "1"}, person2)
      //   )
      //   const event = result.logs[1]
      //   const tokenId = event.args.tokenId

      //   // Try to transfer to owner. Should work
      //   await expect(poolTokens.transferFrom(person2, owner, tokenId, {from: person2})).to.be.fulfilled

      //   // Try to transfer to person3 (not on the list). Should fail
      //   await expect(poolTokens.transferFrom(owner, person3, tokenId, {from: owner})).to.be.rejectedWith(
      //     /has not been go-listed/
      //   )
      // })

      context("recipient with 0 balance GoldfinchIdentity token (id 0)", () => {
        context("recipient is on legacy go-list", () => {
          it("allows transfer", async () => {
            // TODO
          })
        })
        context("recipient is not on legacy go-list", () => {
          it("rejects transfer", async () => {
            // TODO
          })
        })
      })

      context("recipient with > 0 balance GoldfinchIdentity token (id 0)", () => {
        context("recipient is on legacy go-list", () => {
          it("allows transfer", async () => {
            // TODO
          })
        })
        context("recipient is not on legacy go-list", () => {
          it("allows transfer", async () => {
            // TODO
          })
        })
      })
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
  })
})
