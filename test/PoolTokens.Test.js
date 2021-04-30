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
} = require("./testHelpers.js")
const {OWNER_ROLE, interestAprAsBN} = require("../blockchain_scripts/deployHelpers")
const hre = require("hardhat")
const BN = require("bn.js")
const {deployments} = hre
const TranchedPool = artifacts.require("TranchedPool")

describe("PoolTokens", () => {
  let owner, person2, person3, goldfinchConfig, poolTokens, creditDesk, pool, usdc

  const withPoolSender = async (func) => {
    // We need to fake the address so we can bypass the pool
    await poolTokens._setSender(pool.address)
    return func().then(async (res) => {
      await poolTokens._setSender("0x0000000000000000000000000000000000000000")
      return res
    })
  }

  const testSetup = deployments.createFixture(async ({deployments, getNamedAccounts}) => {
    const {protocol_owner} = await getNamedAccounts()
    // Just to be crystal clear
    owner = protocol_owner

    const {poolTokens, goldfinchConfig, creditDesk, usdc} = await deployAllContracts(deployments)
    await creditDesk.setUnderwriterGovernanceLimit(person2, usdcVal(1000), {from: owner})
    await goldfinchConfig.bulkAddToGoList([owner, person2])
    await erc20Transfer(usdc, [person2], usdcVal(1000), owner)

    return {poolTokens, goldfinchConfig, creditDesk, usdc}
  })
  beforeEach(async () => {
    // Pull in our unlocked accounts
    ;[owner, person2, person3] = await web3.eth.getAccounts()
    ;({poolTokens, goldfinchConfig, creditDesk, usdc} = await testSetup())

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
      const result = await creditDesk.createPool(
        person2,
        usdcVal(100),
        interestAprAsBN("15.0"),
        new BN(30),
        new BN(365),
        new BN(0),
        {from: person2}
      )
      const event = result.logs[result.logs.length - 1]
      pool = await TranchedPool.at(event.args.pool)
      await erc20Approve(usdc, pool.address, usdcVal(100000), [person2])
    })

    it("should allow validly created pools to call the mint function", async () => {
      return expect(pool.deposit(new BN(1), usdcVal(5), {from: person2})).to.be.fulfilled
    })

    it("should mint a token with correct info", async () => {
      const amount = usdcVal(5)
      const result = await pool.deposit(new BN(1), amount, {from: person2})
      const event = decodeLogs(result.receipt.rawLogs, poolTokens.abi, "TokenMinted")[0]
      const tokenInfo = await poolTokens.getTokenInfo(event.args.tokenId)
      expect(tokenInfo.pool).to.equal(pool.address)
      expect(tokenInfo.principalAmount).to.bignumber.equal(amount)
      expect(tokenInfo.principalRedeemed).to.bignumber.equal(new BN(0))
      expect(tokenInfo.interestRedeemed).to.bignumber.equal(new BN(0))
    })

    it("should set the limit on the PoolInfo", async () => {
      const amount = usdcVal(5)
      await pool.deposit(new BN(1), amount, {from: person2})
      const poolInfo = await poolTokens.pools(pool.address)
      expect(poolInfo.limit).to.bignumber.equal(usdcVal(100))
    })

    it("should disallow minting after the limit on the PoolInfo", async () => {
      const amount = usdcVal(50)
      await pool.deposit(new BN(1), amount, {from: person2})
      const amountThatPutsUsOver = usdcVal(51)
      return expect(pool.deposit(new BN(1), amountThatPutsUsOver, {from: person2})).to.be.rejectedWith(/Cannot mint/)
    })

    it("should emit an event", async () => {
      const amount = usdcVal(2)
      const result = await pool.deposit(new BN(1), amount, {from: person2})
      const tokenMinted = decodeLogs(result.receipt.rawLogs, poolTokens.abi, "TokenMinted")[0]
      expect(tokenMinted.event).to.eq("TokenMinted")
      expect(tokenMinted.args.owner).to.equal(person2)
      expect(tokenMinted.args.pool).to.equal(pool.address)
      expect(tokenMinted.args.tokenId).to.exist
      expect(tokenMinted.args.amount).to.bignumber.equal(amount)
      expect(tokenMinted.args.tranche).to.bignumber.equal(new BN(1))
    })
  })

  describe("redeem", async () => {
    let tokenId, mintAmount
    beforeEach(async function () {
      let result = await creditDesk.createPool(
        person2,
        usdcVal(100),
        interestAprAsBN("15.0"),
        new BN(30),
        new BN(365),
        new BN(0),
        {from: person2}
      )
      let event = result.logs[result.logs.length - 1]
      pool = await TranchedPool.at(event.args.pool)

      await erc20Approve(usdc, pool.address, usdcVal(100000), [person2])

      mintAmount = usdcVal(5)
      result = await pool.deposit(new BN(1), mintAmount, {from: person2})
      event = decodeLogs(result.receipt.rawLogs, poolTokens.abi, "TokenMinted")[0]
      tokenId = event.args.tokenId
    })

    const redeemToken = async (tokenId, principal, interest) => {
      // We need to fake the address so we can bypass the pool
      return withPoolSender(() => poolTokens.redeem(tokenId, principal, interest))
    }

    it("should update the token with the new info", async () => {
      const principalRedeemed = usdcVal(1)
      const interestRedeemed = usdcVal(2)
      await redeemToken(tokenId, principalRedeemed, interestRedeemed)
      const tokenInfo = await poolTokens.getTokenInfo(tokenId)
      expect(tokenInfo.principalRedeemed).to.bignumber.eq(principalRedeemed)
      expect(tokenInfo.interestRedeemed).to.bignumber.eq(interestRedeemed)
    })

    it("should only allow redemption up to the total minted of a token", async () => {
      const principalRedeemed = mintAmount
      const interestRedeemed = usdcVal(2)
      await redeemToken(tokenId, principalRedeemed, interestRedeemed)
      return expect(redeemToken(tokenId, usdcVal(1), interestRedeemed)).to.be.rejectedWith(
        /Cannot redeem more than we minted/
      )
    })

    it("should disallow redeeming tokesn that don't exist", async () => {
      const interestRedeemed = usdcVal(2)
      const randomTokenId = "42"
      return expect(redeemToken(randomTokenId, mintAmount, interestRedeemed)).to.be.rejectedWith(/Invalid tokenId/)
    })

    it("should only allow redemptions that come from the token's pool", async () => {
      const interestRedeemed = usdcVal(2)
      return expect(poolTokens.redeem(tokenId, mintAmount, interestRedeemed)).to.be.rejectedWith(
        /Only the token's pool can redeem/
      )
    })

    it("should emit an event", async () => {
      const interestRedeemed = usdcVal(2)
      const result = await redeemToken(tokenId, mintAmount, interestRedeemed)
      const tokenRedeemedEvent = result.logs[0]
      expect(tokenRedeemedEvent.event).to.eq("TokenRedeemed")
      expect(tokenRedeemedEvent.args.owner).to.equal(person2)
      expect(tokenRedeemedEvent.args.pool).to.equal(pool.address)
      expect(tokenRedeemedEvent.args.tokenId).to.bignumber.equal(tokenId)
      expect(tokenRedeemedEvent.args.principalRedeemed).to.bignumber.equal(mintAmount)
      expect(tokenRedeemedEvent.args.interestRedeemed).to.bignumber.equal(interestRedeemed)
      const tokenInfo = await poolTokens.getTokenInfo(tokenId)
      expect(tokenRedeemedEvent.args.tranche).to.bignumber.equal(tokenInfo.tranche)
    })
  })

  describe("burning", async () => {
    let tokenId, mintAmount
    beforeEach(async function () {
      let result = await creditDesk.createPool(
        person2,
        usdcVal(100),
        interestAprAsBN("15.0"),
        new BN(30),
        new BN(365),
        new BN(0),
        {from: person2}
      )
      let event = result.logs[result.logs.length - 1]
      pool = await TranchedPool.at(event.args.pool)

      await erc20Approve(usdc, pool.address, usdcVal(100000), [person2])

      mintAmount = usdcVal(5)
      result = await pool.deposit(new BN(1), mintAmount, {from: person2})
      event = decodeLogs(result.receipt.rawLogs, poolTokens.abi, "TokenMinted")[0]
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
        [async () => (await poolTokens.getTokenInfo(tokenId)).pool, {to: ZERO_ADDRESS}],
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
      let result = await creditDesk.createPool(
        person2,
        usdcVal(100),
        interestAprAsBN("15.0"),
        new BN(30),
        new BN(365),
        new BN(0),
        {from: person2}
      )
      let event = result.logs[result.logs.length - 1]
      pool = await TranchedPool.at(event.args.pool)
    })
    describe("mint", async () => {
      beforeEach(async function () {
        amount = usdcVal(10)
      })
      context("before you have been added to the go list", async () => {
        it("should require adding them in order to work", async () => {
          await expect(
            withPoolSender(() => poolTokens.mint({principalAmount: String(amount), tranche: "1"}, person3))
          ).to.be.rejectedWith(/has not been go-listed/)
          await goldfinchConfig.addToGoList(person3)
          return expect(withPoolSender(() => poolTokens.mint({principalAmount: String(amount), tranche: "1"}, person3)))
            .to.be.fulfilled
        })
      })
      context("after you've already been added", async () => {
        beforeEach(async () => {
          await goldfinchConfig.addToGoList(person3)
        })
        it("should allow that person to receive a minted token", async () => {
          return expect(withPoolSender(() => poolTokens.mint({principalAmount: String(amount), tranche: "1"}, person3)))
            .to.be.fulfilled
        })
      })
    })

    describe("transferFrom", async () => {
      it("should respect the go list", async () => {
        const amount = usdcVal(5)
        // Give some tokens to person2
        const result = await withPoolSender(() =>
          poolTokens.mint({principalAmount: String(amount), tranche: "1"}, person2)
        )
        const event = result.logs[1]
        const tokenId = event.args.tokenId

        // Try to transfer to owner. Should work
        await expect(poolTokens.transferFrom(person2, owner, tokenId, {from: person2})).to.be.fulfilled

        // Try to transfer to person3 (not on the list). Should fail
        await expect(poolTokens.transferFrom(owner, person3, tokenId, {from: owner})).to.be.rejectedWith(
          /has not been go-listed/
        )
      })
    })
  })
})
