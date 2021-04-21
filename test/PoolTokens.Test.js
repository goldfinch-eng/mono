/* global web3 */
const {expect, getDeployedAsTruffleContract, usdcVal, expectAction, ZERO_ADDRESS} = require("./testHelpers.js")
const {OWNER_ROLE} = require("../blockchain_scripts/deployHelpers")
const hre = require("hardhat")
const BN = require("bn.js")
const {deployments} = hre
describe("PoolTokens", () => {
  let owner, person2, person3, goldfinchConfig, poolTokens

  const testSetup = deployments.createFixture(async ({deployments, getNamedAccounts}) => {
    const {protocol_owner} = await getNamedAccounts()
    // Just to be crystal clear
    owner = protocol_owner

    await deployments.run("base_deploy")
    const poolTokens = await getDeployedAsTruffleContract(deployments, "PoolTokens")
    const goldfinchConfig = await getDeployedAsTruffleContract(deployments, "GoldfinchConfig")
    await goldfinchConfig.bulkAddToGoList([owner, person2])
    // TODO: make this a tranched pool when we can hook up all the pieces

    return {poolTokens, goldfinchConfig}
  })
  beforeEach(async () => {
    // Pull in our unlocked accounts
    ;[owner, person2, person3] = await web3.eth.getAccounts()
    ;({poolTokens, goldfinchConfig} = await testSetup())
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
    it("should mint a token with correct info", async () => {
      const amount = usdcVal(5)
      const result = await poolTokens.mint({principalAmount: String(amount), tranche: "1"}, person2, {
        from: owner,
      })
      const event = result.logs[1]
      const tokenInfo = await poolTokens.getTokenInfo(event.args.tokenId)
      // TODO: This should really be the pool address and not owner.
      // But until we hook up the real pools, it will be equal to owner, who is actually
      // doing the sending
      expect(tokenInfo.pool).to.equal(owner)
      expect(tokenInfo.principalAmount).to.bignumber.equal(amount)
      expect(tokenInfo.principalRedeemed).to.bignumber.equal(new BN(0))
      expect(tokenInfo.interestRedeemed).to.bignumber.equal(new BN(0))
    })

    it("should set the limit on the PoolInfo", async () => {
      const amount = usdcVal(5)
      await poolTokens.mint({principalAmount: String(amount), tranche: "1"}, person2, {
        from: owner,
      })
      const poolInfo = await poolTokens.pools(owner)
      expect(poolInfo.limit).to.bignumber.equal(usdcVal(1000))
    })

    it("should disallow minting after the limit on the PoolInfo", async () => {
      const amount = usdcVal(500)
      await poolTokens.mint({principalAmount: String(amount), tranche: "1"}, person2, {
        from: owner,
      })
      const amountThatPutsUsOver = usdcVal(501)
      return expect(
        poolTokens.mint({principalAmount: String(amountThatPutsUsOver), tranche: "1"}, person2, {
          from: owner,
        })
      ).to.be.rejectedWith(/Cannot mint/)
    })

    it("should emit an event", async () => {
      const amount = usdcVal(2)
      const result = await poolTokens.mint({principalAmount: String(amount), tranche: "1"}, person2)
      const tokenMinted = result.logs[1]
      expect(tokenMinted.event).to.eq("TokenMinted")
      // TODO: Fix this after getting pools to send this.
      expect(tokenMinted.args.owner).to.equal(person2)
      expect(tokenMinted.args.pool).to.equal(owner)
      expect(tokenMinted.args.tokenId).to.exist
      expect(tokenMinted.args.amount).to.bignumber.equal(amount)
      expect(tokenMinted.args.tranche).to.bignumber.equal(new BN(1))
    })
  })

  describe("redeem", async () => {
    let tokenId, mintAmount
    beforeEach(async function () {
      mintAmount = usdcVal(5)
      const result = await poolTokens.mint({principalAmount: String(mintAmount), tranche: "1"}, person2, {
        from: owner,
      })
      const event = result.logs[1]
      tokenId = event.args.tokenId
    })

    it("should update the token with the new info", async () => {
      const principalRedeemed = usdcVal(1)
      const interestRedeemed = usdcVal(2)
      await poolTokens.redeem(tokenId, principalRedeemed, interestRedeemed)
      const tokenInfo = await poolTokens.getTokenInfo(tokenId)
      expect(tokenInfo.principalRedeemed).to.bignumber.eq(principalRedeemed)
      expect(tokenInfo.interestRedeemed).to.bignumber.eq(interestRedeemed)
    })

    it("should only allow redemption up to the total minted of a token", async () => {
      const principalRedeemed = mintAmount
      const interestRedeemed = usdcVal(2)
      await poolTokens.redeem(tokenId, principalRedeemed, interestRedeemed)
      return expect(poolTokens.redeem(tokenId, usdcVal(1), interestRedeemed)).to.be.rejectedWith(
        /Cannot redeem more than we minted/
      )
    })

    it("should disallow redeeming tokesn that don't exist", async () => {
      const interestRedeemed = usdcVal(2)
      const randomTokenId = "42"
      return expect(poolTokens.redeem(randomTokenId, mintAmount, interestRedeemed)).to.be.rejectedWith(
        /Invalid tokenId/
      )
    })

    it("should only allow redemptions that come from the token's pool", async () => {
      const interestRedeemed = usdcVal(2)
      return expect(poolTokens.redeem(tokenId, mintAmount, interestRedeemed, {from: person2})).to.be.rejectedWith(
        /Only the token's pool can redeem/
      )
    })

    it("should emit an event", async () => {
      const interestRedeemed = usdcVal(2)
      const result = await poolTokens.redeem(tokenId, mintAmount, interestRedeemed)
      const tokenRedeemedEvent = result.logs[0]
      expect(tokenRedeemedEvent.event).to.eq("TokenRedeemed")
      // TODO: Fix this after getting pools to send this.
      expect(tokenRedeemedEvent.args.owner).to.equal(person2)
      expect(tokenRedeemedEvent.args.pool).to.equal(owner)
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
      mintAmount = usdcVal(5)
      const result = await poolTokens.mint({principalAmount: String(mintAmount), tranche: "1"}, person2, {
        from: owner,
      })
      const event = result.logs[1]
      tokenId = event.args.tokenId
    })

    it("should disallow burning if the token isn't fully redeemed", async () => {
      return expect(poolTokens.burn(tokenId)).to.be.rejectedWith(/Can only burn fully redeemed/)
    })

    it("should allow burning once fully redeemed", async () => {
      await poolTokens.redeem(tokenId, mintAmount, new BN(0))
      return expect(poolTokens.burn(tokenId)).to.be.fulfilled
    })

    it("burning should zero out all data associated with that tokenId", async () => {
      await poolTokens.redeem(tokenId, mintAmount, new BN(0))
      await expectAction(() => poolTokens.burn(tokenId)).toChange([
        [async () => (await poolTokens.getTokenInfo(tokenId)).principalAmount, {to: new BN(0)}],
        [async () => (await poolTokens.getTokenInfo(tokenId)).principalRedeemed, {to: new BN(0)}],
        [async () => (await poolTokens.getTokenInfo(tokenId)).pool, {to: ZERO_ADDRESS}],
      ])
      return expect(poolTokens.ownerOf(tokenId)).to.be.rejectedWith(/owner query for nonexistent token/)
    })

    it("should emit an event", async () => {
      await poolTokens.redeem(tokenId, mintAmount, new BN(0))
      const result = await poolTokens.burn(tokenId)
      const tokenBurnedEvent = result.logs[2]
      expect(tokenBurnedEvent.event).to.eq("TokenBurned")
      expect(tokenBurnedEvent.args.owner).to.equal(person2)
      // TODO: Fix this after getting pools to send this.
      expect(tokenBurnedEvent.args.pool).to.equal(owner)
      expect(tokenBurnedEvent.args.tokenId).to.bignumber.equal(tokenId)
    })
  })

  describe("go listing", async () => {
    describe("mint", async () => {
      let amount
      beforeEach(async function () {
        amount = usdcVal(10)
      })
      context("before you have been added to the go list", async () => {
        it("should require adding them in order to work", async () => {
          await expect(
            poolTokens.mint({principalAmount: String(amount), tranche: "1"}, person3, {from: owner})
          ).to.be.rejectedWith(/has not been go-listed/)
          await goldfinchConfig.addToGoList(person3)
          return expect(poolTokens.mint({principalAmount: String(amount), tranche: "1"}, person3, {from: owner})).to.be
            .fulfilled
        })
      })
      context("after you've already been added", async () => {
        beforeEach(async () => {
          await goldfinchConfig.addToGoList(person3)
        })
        it("should allow that person to receive a minted token", async () => {
          return expect(poolTokens.mint({principalAmount: String(amount), tranche: "1"}, person3, {from: owner})).to.be
            .fulfilled
        })
      })
    })
  })

  describe("transferFrom", async () => {
    it("should respect the go list", async () => {
      const amount = usdcVal(5)
      // Give some tokens to person2
      const result = await poolTokens.mint({principalAmount: String(amount), tranche: "1"}, person2, {from: owner})
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
