/* global web3 */
const {
  expect,
  usdcVal,
  expectAction,
  deployAllContracts,
  advanceTime,
  erc20Approve,
  erc20Transfer,
  getBalance,
  tolerance,
  createPoolWithCreditLine: _createPoolWithCreditLine,
  SECONDS_PER_DAY,
  UNIT_SHARE_PRICE,
} = require("./testHelpers.js")
const {interestAprAsBN, TRANCHES, MAX_UINT, OWNER_ROLE, PAUSER_ROLE} = require("../blockchain_scripts/deployHelpers")
const {expectEvent} = require("@openzeppelin/test-helpers")
const hre = require("hardhat")
const BN = require("bn.js")
const {deployments} = hre
const {ecsign} = require("ethereumjs-util")
const {getApprovalDigest, getWallet} = require("./permitHelpers")

describe("TranchedPool", () => {
  let owner,
    borrower,
    otherPerson,
    goldfinchConfig,
    usdc,
    poolTokens,
    tranchedPool,
    goldfinchFactory,
    creditLine,
    treasury
  let limit = usdcVal(1000)
  let interestApr = interestAprAsBN("5.00")
  let paymentPeriodInDays = new BN(30)
  let termInDays = new BN(365)
  let lateFeeApr = new BN(0)
  let juniorFeePercent = new BN(20)

  const createPoolWithCreditLine = async () => {
    ;({creditLine, tranchedPool} = await _createPoolWithCreditLine({
      people: {owner, borrower},
      goldfinchFactory,
      limit,
      interestApr,
      paymentPeriodInDays,
      termInDays,
      lateFeeApr,
      juniorFeePercent,
      usdc,
    }))
    return tranchedPool
  }

  const getTrancheAmounts = async (trancheInfo) => {
    const interestAmount = await tranchedPool.sharePriceToUsdc(
      trancheInfo.interestSharePrice,
      trancheInfo.principalDeposited
    )
    const principalAmount = await tranchedPool.sharePriceToUsdc(
      trancheInfo.principalSharePrice,
      trancheInfo.principalDeposited
    )
    return [interestAmount, principalAmount]
  }

  beforeEach(async () => {
    // Pull in our unlocked accounts
    ;[owner, borrower, treasury, otherPerson] = await web3.eth.getAccounts()
    ;({usdc, goldfinchConfig, goldfinchFactory, poolTokens} = await deployAllContracts(deployments))
    await goldfinchConfig.bulkAddToGoList([owner, borrower, otherPerson])
    await goldfinchConfig.setTreasuryReserve(treasury)
    await erc20Transfer(usdc, [otherPerson], usdcVal(10000), owner)
    await erc20Transfer(usdc, [borrower], usdcVal(10000), owner)
  })

  describe("initialization", async () => {
    it("sets the right defaults", async () => {
      tranchedPool = await createPoolWithCreditLine()

      const juniorTranche = await tranchedPool.getTranche(TRANCHES.Junior)
      const seniorTranche = await tranchedPool.getTranche(TRANCHES.Senior)
      expect(juniorTranche.principalSharePrice).to.bignumber.eq(UNIT_SHARE_PRICE)
      expect(juniorTranche.interestSharePrice).to.bignumber.eq("0")
      expect(juniorTranche.principalDeposited).to.bignumber.eq("0")
      expect(juniorTranche.lockedUntil).to.bignumber.eq("0")

      expect(seniorTranche.principalSharePrice).to.bignumber.eq(UNIT_SHARE_PRICE)
      expect(seniorTranche.interestSharePrice).to.bignumber.eq("0")
      expect(seniorTranche.principalDeposited).to.bignumber.eq("0")
      expect(seniorTranche.lockedUntil).to.bignumber.eq("0")

      expect(await tranchedPool.creditLine()).to.eq(creditLine.address)
    })
  })

  describe("deposit", async () => {
    beforeEach(async () => {
      tranchedPool = await createPoolWithCreditLine()
    })
    describe("junior tranche", async () => {
      it("does not allow deposits when pool is locked", async () => {
        await tranchedPool.lockJuniorCapital({from: borrower})
        await expect(tranchedPool.deposit(TRANCHES.Junior, usdcVal(10))).to.be.rejectedWith(/Tranche has been locked/)
      })

      it("fails for invalid tranches", async () => {
        await expect(tranchedPool.deposit(0, usdcVal(10))).to.be.rejectedWith(/Unsupported tranche/)
      })

      it("updates the tranche info and mints the token", async () => {
        expect(await poolTokens.balanceOf(owner)).to.bignumber.eq("0")

        const response = await tranchedPool.deposit(TRANCHES.Junior, usdcVal(10))
        const tokenId = response.logs[0].args.tokenId
        let juniorTranche = await tranchedPool.getTranche(TRANCHES.Junior)
        let seniorTranche = await tranchedPool.getTranche(TRANCHES.Senior)

        expect(juniorTranche.principalDeposited).to.bignumber.eq(usdcVal(10))
        expect(seniorTranche.principalDeposited).to.bignumber.eq("0")

        expect(await poolTokens.balanceOf(owner)).to.bignumber.eq("1")
        expect(await usdc.balanceOf(tranchedPool.address)).to.bignumber.eq(usdcVal(10))

        const tokenInfo = await poolTokens.getTokenInfo(tokenId)
        expect(tokenInfo.principalAmount).to.bignumber.eq(usdcVal(10))
        expect(tokenInfo.tranche).to.bignumber.eq("2")
        expect(tokenInfo.principalRedeemed).to.bignumber.eq("0")
        expect(tokenInfo.interestRedeemed).to.bignumber.eq("0")
      })

      describe("multiple deposits", async () => {
        it("Keeps track of them correctly", async () => {
          await tranchedPool.deposit(TRANCHES.Junior, usdcVal(10))
          await tranchedPool.deposit(TRANCHES.Junior, usdcVal(5))
          let juniorTranche = await tranchedPool.getTranche(TRANCHES.Junior)
          let seniorTranche = await tranchedPool.getTranche(TRANCHES.Senior)

          expect(juniorTranche.principalDeposited).to.bignumber.eq(usdcVal(15))
          expect(seniorTranche.principalDeposited).to.bignumber.eq("0")
          // TODO: Eventually should just be a single NFT
          expect(await poolTokens.balanceOf(owner)).to.bignumber.eq("2")
          expect(await usdc.balanceOf(tranchedPool.address)).to.bignumber.eq(usdcVal(15))
        })
      })
    })

    describe("senior tranche", async () => {
      it("does not allow deposits when pool is locked", async () => {
        await tranchedPool.deposit(TRANCHES.Junior, usdcVal(10))
        await tranchedPool.lockJuniorCapital({from: borrower})
        await tranchedPool.lockPool({from: borrower})
        await expect(tranchedPool.deposit(TRANCHES.Senior, usdcVal(10))).to.be.rejectedWith(/Tranche has been locked/)
      })

      it("fails for invalid tranches", async () => {
        await expect(tranchedPool.deposit(3, usdcVal(10))).to.be.rejectedWith(/Unsupported tranche/)
      })

      it("updates the tranche info and mints the token", async () => {
        expect(await poolTokens.balanceOf(owner)).to.bignumber.eq("0")

        const response = await tranchedPool.deposit(TRANCHES.Senior, usdcVal(10))
        const tokenId = response.logs[0].args.tokenId
        let juniorTranche = await tranchedPool.getTranche(TRANCHES.Junior)
        let seniorTranche = await tranchedPool.getTranche(TRANCHES.Senior)

        expect(juniorTranche.principalDeposited).to.bignumber.eq("0")
        expect(seniorTranche.principalDeposited).to.bignumber.eq(usdcVal(10))

        expect(await poolTokens.balanceOf(owner)).to.bignumber.eq("1")
        expect(await usdc.balanceOf(tranchedPool.address)).to.bignumber.eq(usdcVal(10))

        const tokenInfo = await poolTokens.getTokenInfo(tokenId)
        expect(tokenInfo.principalAmount).to.bignumber.eq(usdcVal(10))
        expect(tokenInfo.tranche).to.bignumber.eq("1")
        expect(tokenInfo.principalRedeemed).to.bignumber.eq("0")
        expect(tokenInfo.interestRedeemed).to.bignumber.eq("0")
      })

      describe("multiple deposits", async () => {
        it("Keeps track of them correctly", async () => {
          await tranchedPool.deposit(TRANCHES.Senior, usdcVal(10))
          await tranchedPool.deposit(TRANCHES.Senior, usdcVal(5))
          let juniorTranche = await tranchedPool.getTranche(TRANCHES.Junior)
          let seniorTranche = await tranchedPool.getTranche(TRANCHES.Senior)

          expect(juniorTranche.principalDeposited).to.bignumber.eq("0")
          expect(seniorTranche.principalDeposited).to.bignumber.eq(usdcVal(15))
          // TODO: Eventually should just be a single NFT
          expect(await poolTokens.balanceOf(owner)).to.bignumber.eq("2")
          expect(await usdc.balanceOf(tranchedPool.address)).to.bignumber.eq(usdcVal(15))
        })
      })
    })
  })

  describe("depositWithPermit", async () => {
    beforeEach(async () => {
      tranchedPool = await createPoolWithCreditLine()
    })

    it("deposits using permit", async () => {
      let otherPersonAddress = otherPerson.toLowerCase()
      let tranchedPoolAddress = tranchedPool.address.toLowerCase()
      let nonce = await usdc.nonces(otherPersonAddress)
      let deadline = MAX_UINT
      let value = usdcVal(100)

      // Create signature for permit
      let digest = await getApprovalDigest({
        token: usdc,
        owner: otherPersonAddress,
        spender: tranchedPoolAddress,
        value,
        nonce,
        deadline,
      })
      let wallet = await getWallet(otherPersonAddress)
      let {v, r, s} = ecsign(Buffer.from(digest.slice(2), "hex"), Buffer.from(wallet.privateKey.slice(2), "hex"))

      let receipt = await tranchedPool.depositWithPermit(TRANCHES.Junior, value, deadline, v, r, s, {
        from: otherPersonAddress,
      })

      // Verify deposit was correct
      let tokenId = receipt.logs[0].args.tokenId
      let juniorTranche = await tranchedPool.getTranche(TRANCHES.Junior)
      let seniorTranche = await tranchedPool.getTranche(TRANCHES.Senior)

      expect(juniorTranche.principalDeposited).to.bignumber.eq(usdcVal(100))
      expect(seniorTranche.principalDeposited).to.bignumber.eq("0")

      expect(await poolTokens.balanceOf(otherPersonAddress)).to.bignumber.eq("1")
      expect(await usdc.balanceOf(tranchedPool.address)).to.bignumber.eq(usdcVal(100))

      const tokenInfo = await poolTokens.getTokenInfo(tokenId)
      expect(tokenInfo.principalAmount).to.bignumber.eq(usdcVal(100))
      expect(tokenInfo.tranche).to.bignumber.eq(TRANCHES.Junior.toString())
      expect(tokenInfo.principalRedeemed).to.bignumber.eq("0")
      expect(tokenInfo.interestRedeemed).to.bignumber.eq("0")

      // Verify that permit creates allowance for amount only
      expect(await usdc.allowance(otherPersonAddress, tranchedPoolAddress)).to.bignumber.eq("0")
    })
  })

  describe("withdraw", async () => {
    beforeEach(async () => {
      tranchedPool = await createPoolWithCreditLine()
    })

    describe("validations", async () => {
      it("does not allow you to withdraw if you don't own the pool token", async () => {
        let receipt = await tranchedPool.deposit(TRANCHES.Junior, usdcVal(10), {from: owner})
        const tokenId = receipt.logs[0].args.tokenId

        await expect(tranchedPool.withdraw(tokenId, usdcVal(10), {from: otherPerson})).to.be.rejectedWith(
          /Only the token owner is allowed/
        )
        await expect(tranchedPool.withdrawMax(tokenId, {from: otherPerson})).to.be.rejectedWith(
          /Only the token owner is allowed/
        )
      })
      it("does not allow you to withdraw if pool token is from a different pool")
      it("does not allow you to withdraw if no amount is available", async () => {})
    })

    describe("before the pool is locked", async () => {
      it("lets you withdraw everything you put in", async () => {
        let response = await tranchedPool.deposit(TRANCHES.Junior, usdcVal(10))
        const tokenId = response.logs[0].args.tokenId

        await tranchedPool.withdraw(tokenId, usdcVal(10))
        let juniorTranche = await tranchedPool.getTranche(TRANCHES.Junior)
        expect(juniorTranche.principalDeposited).to.bignumber.eq("0")
        expect(await usdc.balanceOf(tranchedPool.address)).to.bignumber.eq("0")

        const tokenInfo = await poolTokens.getTokenInfo(tokenId)
        expect(tokenInfo.principalAmount).to.bignumber.eq(usdcVal(10))
        expect(tokenInfo.principalRedeemed).to.bignumber.eq(usdcVal(10))
        expect(tokenInfo.interestRedeemed).to.bignumber.eq("0")
      })
    })

    describe("after the pool is locked", async () => {
      it("does not let you withdraw if no payments have come back", async () => {
        let response = await tranchedPool.deposit(TRANCHES.Junior, usdcVal(10))
        const tokenId = response.logs[0].args.tokenId

        await tranchedPool.lockJuniorCapital({from: borrower})

        await expect(tranchedPool.withdraw(tokenId, usdcVal(10))).to.be.rejectedWith(/Tranche is locked/)
      })

      it("lets you withdraw pro-rata share of payments", async () => {
        // Total junior tranche investment is split between 2 people
        await erc20Approve(usdc, tranchedPool.address, usdcVal(100000), [otherPerson])
        await tranchedPool.deposit(TRANCHES.Junior, usdcVal(500), {from: otherPerson})
        let response = await tranchedPool.deposit(TRANCHES.Junior, usdcVal(500))
        const tokenId = response.logs[0].args.tokenId

        await tranchedPool.lockJuniorCapital({from: borrower})
        await tranchedPool.lockPool({from: borrower})
        await tranchedPool.drawdown(usdcVal(1000), {from: borrower})
        await advanceTime(tranchedPool, {days: termInDays.toNumber()})
        let payAmount = usdcVal(1050)
        await erc20Approve(usdc, tranchedPool.address, payAmount, [borrower])
        await tranchedPool.pay(payAmount, {from: borrower})

        // Total amount owed to junior:
        //   interest_accrued = 1000 * 0.05 = 50
        //   protocol_fee = interest_accrued * 0.1 = 5
        //   1000 + interest_accrued - protocol_fee = 1045
        // Amount owed to one of the junior investors:
        //   1045 / 2 = 522.5
        await expectAction(async () => tranchedPool.withdraw(tokenId, usdcVal(52250).div(new BN(100)))).toChange([
          [async () => await getBalance(owner, usdc), {by: usdcVal(52250).div(new BN(100))}],
        ])
        // After withdrawing the max, the junior investor should not be able to withdraw more
        await expect(tranchedPool.withdraw(tokenId, usdcVal(10))).to.be.rejectedWith(/Invalid redeem amount/)
      })

      it("emits an event", async () => {
        let response = await tranchedPool.deposit(TRANCHES.Junior, usdcVal(1000))
        const tokenId = response.logs[0].args.tokenId

        await tranchedPool.lockJuniorCapital({from: borrower})
        await tranchedPool.lockPool({from: borrower})
        await tranchedPool.drawdown(usdcVal(1000), {from: borrower})
        await advanceTime(tranchedPool, {days: termInDays.toNumber()})
        let payAmount = usdcVal(1050)
        await erc20Approve(usdc, tranchedPool.address, payAmount, [borrower])
        await tranchedPool.pay(payAmount, {from: borrower})

        // Total amount owed to junior:
        //   principal = 1000
        //   interest_accrued = 1000 * 0.05 = 50
        //   protocol_fee = interest_accrued * 0.1 = 5
        //   principal + interest_accrued - protocol_fee = 1045
        let receipt = await tranchedPool.withdraw(tokenId, usdcVal(1045))
        expectEvent(receipt, "WithdrawalMade", {
          owner: owner,
          tranche: new BN(TRANCHES.Junior),
          tokenId: tokenId,
          interestWithdrawn: usdcVal(45),
          principalWithdrawn: usdcVal(1000),
        })
      })
    })

    it("does not allow you to withdraw during the drawdown period", async () => {
      let response = await tranchedPool.deposit(TRANCHES.Junior, usdcVal(10))
      const juniorTokenId = response.logs[0].args.tokenId

      await tranchedPool.lockJuniorCapital({from: borrower})

      await expect(tranchedPool.withdraw(juniorTokenId, usdcVal(10))).to.be.rejectedWith(/Tranche is locked/)

      response = await tranchedPool.deposit(TRANCHES.Senior, usdcVal(40))
      const seniorTokenId = response.logs[0].args.tokenId
      await tranchedPool.lockPool({from: borrower})

      await expect(tranchedPool.withdraw(seniorTokenId, usdcVal(10))).to.be.rejectedWith(/Tranche is locked/)

      await tranchedPool.drawdown(usdcVal(25), {from: borrower})

      advanceTime(tranchedPool, {days: 2})

      // After the drawdown period, each tranche can withdraw unused capital
      await expectAction(async () => tranchedPool.withdrawMax(juniorTokenId)).toChange([
        [async () => await getBalance(owner, usdc), {by: usdcVal(5)}],
      ])
      await expectAction(async () => tranchedPool.withdrawMax(seniorTokenId)).toChange([
        [async () => await getBalance(owner, usdc), {by: usdcVal(20)}],
      ])
    })
  })

  describe("withdrawMax", async () => {
    beforeEach(async () => {
      tranchedPool = await createPoolWithCreditLine()
    })

    it("should withdraw the max", async () => {
      // Total junior tranche investment is split between 2 people
      await erc20Approve(usdc, tranchedPool.address, usdcVal(100000), [otherPerson])
      await tranchedPool.deposit(TRANCHES.Junior, usdcVal(500), {from: otherPerson})
      let response = await tranchedPool.deposit(TRANCHES.Junior, usdcVal(500))
      const tokenId = response.logs[0].args.tokenId

      await tranchedPool.lockJuniorCapital({from: borrower})
      await tranchedPool.lockPool({from: borrower})
      await tranchedPool.drawdown(usdcVal(1000), {from: borrower})
      let payAmount = usdcVal(1050)
      await advanceTime(tranchedPool, {days: termInDays.toNumber()})
      await erc20Approve(usdc, tranchedPool.address, payAmount, [borrower])
      await tranchedPool.pay(payAmount, {from: borrower})

      // Total amount owed to junior:
      //   interest_accrued = 1000 * 0.05 = 50
      //   protocol_fee = interest_accrued * 0.1 = 5
      //   1000 + interest_accrued - protocol_fee = 1045
      // Amount owed to one of the junior investors:
      //   1045 / 2 = 522.5
      await expectAction(async () => tranchedPool.withdrawMax(tokenId)).toChange([
        [async () => await getBalance(owner, usdc), {by: usdcVal(52250).div(new BN(100))}],
      ])
      await expectAction(async () => tranchedPool.withdrawMax(tokenId)).toChange([
        [async () => await getBalance(owner, usdc), {by: usdcVal(0)}],
      ])
    })

    it("emits an event", async () => {
      let response = await tranchedPool.deposit(TRANCHES.Junior, usdcVal(1000))
      const tokenId = response.logs[0].args.tokenId

      await tranchedPool.lockJuniorCapital({from: borrower})
      await tranchedPool.lockPool({from: borrower})
      await tranchedPool.drawdown(usdcVal(1000), {from: borrower})
      await advanceTime(tranchedPool, {days: termInDays.toNumber()})
      let payAmount = usdcVal(1050)
      await erc20Approve(usdc, tranchedPool.address, payAmount, [borrower])
      await tranchedPool.pay(payAmount, {from: borrower})

      // Total amount owed to junior:
      //   principal = 1000
      //   interest_accrued = 1000 * 0.05 = 50
      //   protocol_fee = interest_accrued * 0.1 = 5
      //   principal + interest_accrued - protocol_fee = 1045
      let receipt = await tranchedPool.withdrawMax(tokenId)
      expectEvent(receipt, "WithdrawalMade", {
        owner: owner,
        tranche: new BN(TRANCHES.Junior),
        tokenId: tokenId,
        interestWithdrawn: usdcVal(45),
        principalWithdrawn: usdcVal(1000),
      })
    })

    describe("when deposits are over the limit", async () => {
      it("lets you withdraw the unused amounts", async () => {
        const juniorDeposit = limit
        const seniorDeposit = limit.mul(new BN(4))
        let response = await tranchedPool.deposit(TRANCHES.Junior, juniorDeposit)
        const juniorTokenId = response.logs[0].args.tokenId
        response = await tranchedPool.deposit(TRANCHES.Senior, seniorDeposit)
        const seniorTokenId = response.logs[0].args.tokenId
        await tranchedPool.lockJuniorCapital({from: borrower})
        await tranchedPool.lockPool({from: borrower})

        expect(await creditLine.limit()).to.bignumber.eq(limit)

        await expectAction(async () => tranchedPool.drawdown(limit, {from: borrower})).toChange([
          [() => creditLine.balance(), {to: limit}],
          [() => usdc.balanceOf(borrower), {by: limit}],
          [() => usdc.balanceOf(tranchedPool.address), {to: limit.mul(new BN(4))}], // 5x limit was deposited. 4x still remaining
        ])

        advanceTime(tranchedPool, {days: termInDays.toNumber()})

        // Only 20% of the capital was used, so remaining 80% should be available for drawdown
        await expectAction(async () => tranchedPool.withdrawMax(juniorTokenId)).toChange([
          [() => getBalance(owner, usdc), {by: juniorDeposit.mul(new BN(80)).div(new BN(100))}],
        ])
        await expectAction(async () => tranchedPool.withdrawMax(seniorTokenId)).toChange([
          [() => getBalance(owner, usdc), {by: seniorDeposit.mul(new BN(80)).div(new BN(100))}],
        ])

        // Fully pay off the loan
        await tranchedPool.pay(limit.add(limit.mul(new BN(5)).div(new BN(100))), {from: borrower})

        // Remaining 20% of principal should be withdrawn
        let receipt = await tranchedPool.withdrawMax(juniorTokenId)
        expectEvent(receipt, "WithdrawalMade", {
          tranche: new BN(TRANCHES.Junior),
          tokenId: juniorTokenId,
          principalWithdrawn: juniorDeposit.mul(new BN(20)).div(new BN(100)),
        })

        receipt = await tranchedPool.withdrawMax(seniorTokenId)
        expectEvent(receipt, "WithdrawalMade", {
          tranche: new BN(TRANCHES.Senior),
          tokenId: seniorTokenId,
          principalWithdrawn: seniorDeposit.mul(new BN(20)).div(new BN(100)),
        })
      })
    })
  })

  describe("access controls", () => {
    let LOCKER_ROLE = web3.utils.keccak256("LOCKER_ROLE")
    beforeEach(async () => {
      tranchedPool = await createPoolWithCreditLine()
    })

    it("sets the owner to governance", async () => {
      expect(await tranchedPool.hasRole(OWNER_ROLE, owner)).to.equal(true)
      expect(await tranchedPool.hasRole(OWNER_ROLE, borrower)).to.equal(false)
      expect(await tranchedPool.getRoleAdmin(OWNER_ROLE)).to.equal(OWNER_ROLE)
    })

    it("sets the pauser to governance", async () => {
      expect(await tranchedPool.hasRole(PAUSER_ROLE, owner)).to.equal(true)
      expect(await tranchedPool.hasRole(PAUSER_ROLE, borrower)).to.equal(false)
      expect(await tranchedPool.getRoleAdmin(PAUSER_ROLE)).to.equal(OWNER_ROLE)
    })

    it("sets the locker to borrower and governance", async () => {
      expect(await tranchedPool.hasRole(LOCKER_ROLE, borrower)).to.equal(true)
      expect(await tranchedPool.hasRole(LOCKER_ROLE, owner)).to.equal(true)
      expect(await tranchedPool.hasRole(LOCKER_ROLE, otherPerson)).to.equal(false)
      expect(await tranchedPool.getRoleAdmin(LOCKER_ROLE)).to.equal(OWNER_ROLE)
    })

    it("allows the owner to set new addresses as roles", async () => {
      expect(await tranchedPool.hasRole(OWNER_ROLE, otherPerson)).to.equal(false)
      await tranchedPool.grantRole(OWNER_ROLE, otherPerson, {from: owner})
      expect(await tranchedPool.hasRole(OWNER_ROLE, otherPerson)).to.equal(true)
    })

    it("should not allow anyone else to add an owner", async () => {
      return expect(tranchedPool.grantRole(OWNER_ROLE, otherPerson, {from: borrower})).to.be.rejected
    })
  })

  describe("pausability", () => {
    beforeEach(async () => {
      tranchedPool = await createPoolWithCreditLine()
    })

    describe("after pausing", async () => {
      let tokenId

      beforeEach(async () => {
        let receipt = await tranchedPool.deposit(TRANCHES.Junior, usdcVal(10))
        tokenId = receipt.logs[0].args.tokenId

        await tranchedPool.pause()
      })

      it("disallows deposits", async () => {
        await expect(tranchedPool.deposit(TRANCHES.Junior, usdcVal(10))).to.be.rejectedWith(/Pausable: paused/)

        let nonce = await usdc.nonces(owner)
        let deadline = MAX_UINT
        let digest = await getApprovalDigest({
          token: usdc,
          owner: owner,
          spender: tranchedPool.address,
          value: usdcVal(10),
          nonce,
          deadline,
        })
        let wallet = await getWallet(owner)
        let {v, r, s} = ecsign(Buffer.from(digest.slice(2), "hex"), Buffer.from(wallet.privateKey.slice(2), "hex"))
        await expect(
          tranchedPool.depositWithPermit(TRANCHES.Junior, usdcVal(10), deadline, v, r, s)
        ).to.be.rejectedWith(/Pausable: paused/)
      })

      it("disallows withdrawing", async () => {
        await expect(tranchedPool.withdraw(tokenId, usdcVal(5))).to.be.rejectedWith(/Pausable: paused/)
        await expect(tranchedPool.withdrawMax(tokenId)).to.be.rejectedWith(/Pausable: paused/)
      })

      it("disallows drawdown", async () => {
        await expect(tranchedPool.drawdown(usdcVal(10), {from: borrower})).to.be.rejectedWith(/Pausable: paused/)
      })

      it("disallows pay", async () => {
        await expect(tranchedPool.pay(usdcVal(10), {from: borrower})).to.be.rejectedWith(/Pausable: paused/)
      })

      it("disallows assess", async () => {
        await expect(tranchedPool.assess({from: borrower})).to.be.rejectedWith(/Pausable: paused/)
      })

      it("disallows lockJuniorCapital", async () => {
        await expect(tranchedPool.lockJuniorCapital(), {from: borrower}).to.be.rejectedWith(/Pausable: paused/)
      })

      it("disallows lockPool", async () => {
        await expect(tranchedPool.lockPool(), {from: borrower}).to.be.rejectedWith(/Pausable: paused/)
      })

      it("allows unpausing", async () => {
        await tranchedPool.unpause()
        await expect(tranchedPool.withdraw(tokenId, usdcVal(10))).to.be.fulfilled
        await expect(tranchedPool.deposit(TRANCHES.Junior, usdcVal(10))).to.be.fulfilled
        await expect(tranchedPool.lockJuniorCapital()).to.be.fulfilled
        await expect(tranchedPool.lockPool()).to.be.fulfilled
        await expect(tranchedPool.drawdown(usdcVal(10), {from: borrower})).to.be.fulfilled
        await expect(tranchedPool.pay(usdcVal(10), {from: borrower})).to.be.fulfilled
      })
    })

    describe("actually pausing", async () => {
      it("should allow the owner to pause", async () => {
        await expect(tranchedPool.pause({from: owner})).to.be.fulfilled
      })
      it("should disallow non-owner to pause", async () => {
        await expect(tranchedPool.pause({from: borrower})).to.be.rejectedWith(/Must have pauser role/)
      })
    })
  })

  describe("locking", async () => {
    beforeEach(async () => {
      tranchedPool = await createPoolWithCreditLine()
    })

    describe("junior tranche", async () => {
      describe("as the borrower", async () => {
        it("locks the junior tranche", async () => {
          let actor = borrower
          await tranchedPool.deposit(TRANCHES.Senior, usdcVal(10))
          const oneDayFromNow = (await tranchedPool.currentTimestamp()).add(SECONDS_PER_DAY)
          await expectAction(async () => tranchedPool.lockJuniorCapital({from: actor})).toChange([
            [async () => (await tranchedPool.getTranche(TRANCHES.Junior)).lockedUntil, {increase: true}],
            [async () => (await tranchedPool.getTranche(TRANCHES.Junior)).principalSharePrice, {unchanged: true}],
          ])
          // Should be locked upto approximately 1 day from now (plus or minus a few seconds)
          expect((await tranchedPool.getTranche(TRANCHES.Junior)).lockedUntil).to.be.bignumber.closeTo(
            oneDayFromNow,
            new BN(5)
          )
        })
      })

      describe("as the owner", async () => {
        it("locks the junior tranche", async () => {
          await tranchedPool.deposit(TRANCHES.Senior, usdcVal(10))
          const oneDayFromNow = (await tranchedPool.currentTimestamp()).add(SECONDS_PER_DAY)
          await expectAction(async () => tranchedPool.lockJuniorCapital({from: borrower})).toChange([
            [async () => (await tranchedPool.getTranche(TRANCHES.Junior)).lockedUntil, {increase: true}],
            [async () => (await tranchedPool.getTranche(TRANCHES.Junior)).principalSharePrice, {unchanged: true}],
          ])
          // Should be locked upto approximately 1 day from now (plus or minus a few seconds)
          expect((await tranchedPool.getTranche(TRANCHES.Junior)).lockedUntil).to.be.bignumber.closeTo(
            oneDayFromNow,
            new BN(5)
          )
        })
      })

      describe("as someone else", async () => {
        it("does not lock", async () => {
          let actor = otherPerson
          await tranchedPool.deposit(TRANCHES.Senior, usdcVal(10))
          await expect(tranchedPool.lockJuniorCapital({from: actor})).to.be.rejectedWith(/Must have locker role/)
        })
      })

      it("does not allow locking twice", async () => {
        await tranchedPool.lockJuniorCapital({from: borrower})
        await expect(tranchedPool.lockJuniorCapital({from: borrower})).to.be.rejectedWith(/already locked/)
      })
    })

    describe("senior tranche", async () => {
      beforeEach(async () => {
        await tranchedPool.deposit(TRANCHES.Senior, usdcVal(8))
        await tranchedPool.deposit(TRANCHES.Junior, usdcVal(2))
        await tranchedPool.lockJuniorCapital({from: borrower})
      })

      describe("as the borrower", async () => {
        it("locks the senior tranche", async () => {
          let actor = borrower

          const oneDayFromNow = (await tranchedPool.currentTimestamp()).add(SECONDS_PER_DAY)

          await expectAction(async () => tranchedPool.lockPool({from: actor})).toChange([
            [async () => (await tranchedPool.getTranche(TRANCHES.Senior)).lockedUntil, {increase: true}],
            [async () => (await tranchedPool.getTranche(TRANCHES.Senior)).principalSharePrice, {unchanged: true}],
            // Limit is total of senior and junior deposits
            [async () => creditLine.limit(), {to: usdcVal(10)}],
          ])

          const seniorLockedUntil = (await tranchedPool.getTranche(TRANCHES.Senior)).lockedUntil
          expect(seniorLockedUntil).to.be.bignumber.closeTo(oneDayFromNow, new BN(5))
          // Junior is also locked to the same time
          expect((await tranchedPool.getTranche(TRANCHES.Junior)).lockedUntil).to.be.bignumber.eq(seniorLockedUntil)
        })
      })

      describe("as the owner", async () => {
        it("locks the senior tranche", async () => {
          let actor = owner
          const oneDayFromNow = (await tranchedPool.currentTimestamp()).add(SECONDS_PER_DAY)

          await expectAction(async () => tranchedPool.lockPool({from: actor})).toChange([
            [async () => (await tranchedPool.getTranche(TRANCHES.Senior)).lockedUntil, {increase: true}],
            [async () => (await tranchedPool.getTranche(TRANCHES.Senior)).principalSharePrice, {unchanged: true}],
            // Limit is total of senior and junior deposits
            [async () => creditLine.limit(), {to: usdcVal(10)}],
          ])
          const seniorLockedUntil = (await tranchedPool.getTranche(TRANCHES.Senior)).lockedUntil
          expect(seniorLockedUntil).to.be.bignumber.closeTo(oneDayFromNow, new BN(5))
          // Junior is also locked to the same time
          expect((await tranchedPool.getTranche(TRANCHES.Junior)).lockedUntil).to.be.bignumber.eq(seniorLockedUntil)
        })
      })

      describe("as someone else", async () => {
        it("does not lock", async () => {
          let actor = otherPerson
          await expect(tranchedPool.lockPool({from: actor})).to.be.rejectedWith(/Must have locker role/)
        })
      })
    })
  })
  describe("drawdown", async () => {
    beforeEach(async () => {
      tranchedPool = await createPoolWithCreditLine()
    })

    describe("when deposits are over the limit", async () => {
      it("does not adjust the limit up", async () => {
        await tranchedPool.deposit(TRANCHES.Junior, limit.mul(new BN(2)))
        await tranchedPool.deposit(TRANCHES.Senior, limit.mul(new BN(4)))
        await tranchedPool.lockJuniorCapital({from: borrower})
        await tranchedPool.lockPool({from: borrower})

        expect(await creditLine.limit()).to.bignumber.eq(limit)
      })
    })

    describe("when deposits are under the limit", async () => {
      it("adjusts the limit down", async () => {
        await tranchedPool.deposit(TRANCHES.Junior, usdcVal(2))
        await tranchedPool.deposit(TRANCHES.Senior, usdcVal(8))
        await tranchedPool.lockJuniorCapital({from: borrower})
        await tranchedPool.lockPool({from: borrower})

        expect(await creditLine.limit()).to.bignumber.eq(usdcVal(10))
        expect(await creditLine.limit()).to.bignumber.lt(limit)
      })
    })

    describe("when pool is already locked", async () => {
      beforeEach(async () => {
        await tranchedPool.deposit(TRANCHES.Junior, usdcVal(2))
        await tranchedPool.deposit(TRANCHES.Senior, usdcVal(8))
        await tranchedPool.lockJuniorCapital({from: borrower})
        await tranchedPool.lockPool({from: borrower})
      })

      describe("validations", async () => {
        it("does not allow drawing down more than the limit", async () => {
          await expect(tranchedPool.drawdown(usdcVal(20))).to.be.rejectedWith(/Cannot drawdown more than the limit/)
        })

        it("does not allow drawing down when payments are late", async () => {
          await tranchedPool.drawdown(usdcVal(5))
          await advanceTime(tranchedPool, {days: paymentPeriodInDays.mul(new BN(3))})
          await expect(tranchedPool.drawdown(usdcVal(5))).to.be.rejectedWith(
            /Cannot drawdown when payments are past due/
          )
        })
      })

      it("draws down the capital to the borrower", async () => {
        await expectAction(async () => tranchedPool.drawdown(usdcVal(10))).toChange([
          [async () => usdc.balanceOf(borrower), {by: usdcVal(10)}],
        ])
      })

      it("it updates the creditline accounting variables", async () => {
        await expectAction(async () => tranchedPool.drawdown(usdcVal(10))).toChange([
          [async () => creditLine.balance(), {by: usdcVal(10)}],
          [async () => creditLine.lastFullPaymentTime(), {increase: true}],
          [async () => creditLine.nextDueTime(), {increase: true}],
          [async () => creditLine.interestAccruedAsOf(), {increase: true}],
        ])
      })

      it("supports multiple drawdowns", async () => {
        await expectAction(async () => tranchedPool.drawdown(usdcVal(7))).toChange([
          [async () => creditLine.balance(), {by: usdcVal(7)}],
          [async () => creditLine.lastFullPaymentTime(), {increase: true}],
          [async () => creditLine.nextDueTime(), {increase: true}],
          [async () => creditLine.interestAccruedAsOf(), {increase: true}],
        ])

        await expectAction(async () => tranchedPool.drawdown(usdcVal(3))).toChange([
          [async () => creditLine.balance(), {by: usdcVal(3)}],
          [async () => creditLine.lastFullPaymentTime(), {unchanged: true}],
          [async () => creditLine.nextDueTime(), {unchanged: true}],
          [async () => creditLine.interestAccruedAsOf(), {unchanged: true}],
        ])
      })

      it("sets the principal share price to be proportional to the amount drawn down", async () => {
        let juniorPrincipalAmount, seniorPrincipalAmount
        ;[, juniorPrincipalAmount] = await getTrancheAmounts(await tranchedPool.getTranche(TRANCHES.Junior))
        ;[, seniorPrincipalAmount] = await getTrancheAmounts(await tranchedPool.getTranche(TRANCHES.Senior))

        // Before any drawdown, the share price should be 1 to reflect the full amounts deposited
        expect(juniorPrincipalAmount).to.bignumber.eq(usdcVal(2))
        expect(seniorPrincipalAmount).to.bignumber.eq(usdcVal(8))

        await tranchedPool.drawdown(usdcVal(5))
        ;[, juniorPrincipalAmount] = await getTrancheAmounts(await tranchedPool.getTranche(TRANCHES.Junior))
        ;[, seniorPrincipalAmount] = await getTrancheAmounts(await tranchedPool.getTranche(TRANCHES.Senior))

        expect(juniorPrincipalAmount).to.bignumber.eq(usdcVal(1)) // 50% of 2$
        expect(seniorPrincipalAmount).to.bignumber.eq(usdcVal(4)) // 50% of 8$

        await tranchedPool.drawdown(usdcVal(5))
        ;[, juniorPrincipalAmount] = await getTrancheAmounts(await tranchedPool.getTranche(TRANCHES.Junior))
        ;[, seniorPrincipalAmount] = await getTrancheAmounts(await tranchedPool.getTranche(TRANCHES.Senior))
        expect(juniorPrincipalAmount).to.bignumber.eq(usdcVal(0)) // 0% of 2$
        expect(seniorPrincipalAmount).to.bignumber.eq(usdcVal(0)) // 0% of 8$
      })
    })
  })

  describe("tranching", async () => {
    beforeEach(async () => {
      // 100$ creditline with 10% interest. Senior tranche gets 8% of the total interest, and junior tranche gets 2%
      interestApr = interestAprAsBN("10.00")
      termInDays = new BN(365)
      tranchedPool = await createPoolWithCreditLine()
    })

    it("calculates share price using term start time", async () => {
      await tranchedPool.deposit(TRANCHES.Junior, usdcVal(100))
      await tranchedPool.lockJuniorCapital({from: borrower})
      await tranchedPool.lockPool({from: borrower})

      // Start loan tern halfOfTerm days from now
      let halfOfTerm = termInDays.div(new BN(2))
      await advanceTime(tranchedPool, {days: halfOfTerm.toNumber()})
      await tranchedPool.drawdown(usdcVal(100), {from: borrower})

      // Advance termInDays total days from now
      await advanceTime(tranchedPool, {days: halfOfTerm.add(new BN(1)).toNumber()})
      await tranchedPool.pay(usdcVal(5), {from: borrower})

      let juniorTranche = await tranchedPool.getTranche(TRANCHES.Junior)
      const juniorInterestAmount = await tranchedPool.sharePriceToUsdc(
        juniorTranche.interestSharePrice,
        juniorTranche.principalDeposited
      )

      // Should be around half of full term's interest, since the drawdown happened 6 months
      // from this payment:
      // ~$4.43 (rather than ~$5, since interest is accrued at last second of prior period)
      expect(juniorInterestAmount).to.bignumber.eq(new BN("4438356"))
      expect(await usdc.balanceOf(treasury)).to.bignumber.eq(new BN("493150"))
    })

    context("only junior investment", async () => {
      it("still works", async () => {
        await tranchedPool.deposit(TRANCHES.Junior, usdcVal(100))
        await tranchedPool.lockJuniorCapital({from: borrower})
        await tranchedPool.lockPool({from: borrower})
        await tranchedPool.drawdown(usdcVal(100), {from: borrower})

        // Ensure a full term has passed
        await advanceTime(tranchedPool, {days: termInDays.toNumber()})
        await tranchedPool.pay(usdcVal(110), {from: borrower})

        let juniorTranche = await tranchedPool.getTranche(TRANCHES.Junior)
        let seniorTranche = await tranchedPool.getTranche(TRANCHES.Senior)

        let juniorInterestAmount, juniorPrincipalAmount, seniorInterestAmount, seniorPrincipalAmount
        ;[juniorInterestAmount, juniorPrincipalAmount] = await getTrancheAmounts(juniorTranche)
        ;[seniorInterestAmount, seniorPrincipalAmount] = await getTrancheAmounts(seniorTranche)

        expect(seniorInterestAmount).to.bignumber.eq(new BN(0))
        expect(seniorPrincipalAmount).to.bignumber.eq(new BN(0))
        expect(juniorInterestAmount).to.bignumber.eq(usdcVal(9))
        expect(juniorPrincipalAmount).to.bignumber.eq(usdcVal(100))
        expect(await usdc.balanceOf(treasury)).to.bignumber.eq(usdcVal(1))
      })
    })

    context("junior and senior are invested", async () => {
      beforeEach(async () => {
        usdc.transfer(borrower, usdcVal(15), {from: owner}) // Transfer money for interest payment
        expect(await usdc.balanceOf(treasury)).to.bignumber.eq("0")

        await tranchedPool.deposit(TRANCHES.Junior, usdcVal(20))
        await tranchedPool.deposit(TRANCHES.Senior, usdcVal(80))
        await tranchedPool.lockJuniorCapital({from: borrower})
        await tranchedPool.lockPool({from: borrower})
        await tranchedPool.drawdown(usdcVal(100), {from: borrower})
      })

      describe("when full payment is received", async () => {
        it("distributes across senior and junior tranches correctly", async () => {
          // Ensure a full term has passed
          await advanceTime(tranchedPool, {days: termInDays.toNumber()})

          await tranchedPool.pay(usdcVal(10).add(usdcVal(100)), {from: borrower})
          expect(await creditLine.interestApr()).to.bignumber.eq(interestAprAsBN(10))

          // 100$ loan, with 10% interest. 80% senior and 20% junior. Junior fee of 20%. Reserve fee of 10%
          // Senior share of interest 8$. Net interest = 8 * (100 - junior fee percent + reserve fee percent) = 5.6
          // Junior share of interest 2$. Net interest = 2 + (8 * junior fee percent) - (2 * reserve fee percent) = 3.4
          // Protocol fee = 1$. Total = 5.6 + 3.4 + 1 = 10
          let interestAmount, principalAmount
          ;[interestAmount, principalAmount] = await getTrancheAmounts(await tranchedPool.getTranche(TRANCHES.Senior))
          expect(interestAmount).to.bignumber.eq(usdcVal(56).div(new BN(10)))
          expect(principalAmount).to.bignumber.eq(usdcVal(80))
          ;[interestAmount, principalAmount] = await getTrancheAmounts(await tranchedPool.getTranche(TRANCHES.Junior))
          expect(interestAmount).to.bignumber.eq(usdcVal(34).div(new BN(10)))
          expect(principalAmount).to.bignumber.eq(usdcVal(20))

          expect(await usdc.balanceOf(treasury)).to.bignumber.eq(usdcVal(1))
        })

        it("distributes across senior and junior tranches correctly for multiple payments", async () => {
          // Advance to the half way point
          const halfway = SECONDS_PER_DAY.mul(termInDays).div(new BN(2))
          await advanceTime(tranchedPool, {seconds: halfway.toNumber()})

          // Principal payment should be 0, while interest payment should be slightly less than half. This
          // is because interest is accrued from the most recent nextDueTime rather than the current timestamp.
          // 180.0 / 365 * 10 = 4.93150684931506 (180 because we round to the most recent time in paymentPeriodInDays)
          await tranchedPool.pay(new BN("4931506"), {from: borrower})

          let interestAmount, principalAmount
          ;[interestAmount, principalAmount] = await getTrancheAmounts(await tranchedPool.getTranche(TRANCHES.Senior))
          expect(interestAmount).to.bignumber.eq(new BN("2761643"))
          expect(principalAmount).to.bignumber.eq(usdcVal(0))
          ;[interestAmount, principalAmount] = await getTrancheAmounts(await tranchedPool.getTranche(TRANCHES.Junior))
          expect(interestAmount).to.bignumber.eq(new BN("1676713"))
          expect(principalAmount).to.bignumber.eq(usdcVal(0))

          expect(await usdc.balanceOf(treasury)).to.bignumber.eq(new BN("493150"))

          // Now advance to the end of the loan period and collect interest again, now the numbers should match the full
          //amounts in the previous test

          await advanceTime(tranchedPool, {seconds: halfway.toNumber()})
          // Collect the remaining interest and the principal
          await tranchedPool.pay(new BN("5068493").add(usdcVal(100)), {from: borrower})
          ;[interestAmount, principalAmount] = await getTrancheAmounts(await tranchedPool.getTranche(TRANCHES.Senior))
          expect(interestAmount).to.bignumber.closeTo(usdcVal(56).div(new BN(10)), tolerance)
          expect(principalAmount).to.bignumber.eq(usdcVal(80))
          ;[interestAmount, principalAmount] = await getTrancheAmounts(await tranchedPool.getTranche(TRANCHES.Junior))
          expect(interestAmount).to.bignumber.closeTo(usdcVal(34).div(new BN(10)), tolerance)
          expect(principalAmount).to.bignumber.eq(usdcVal(20))

          expect(await usdc.balanceOf(treasury)).to.bignumber.closeTo(usdcVal(1), tolerance)
        })
      })

      describe("when there is an interest shortfall", async () => {
        it("distributes to the senior tranche first before the junior", async () => {
          // Ensure a full term has passed
          await advanceTime(tranchedPool, {days: termInDays.toNumber()})

          await tranchedPool.pay(usdcVal(6))

          let interestAmount, principalAmount
          ;[interestAmount, principalAmount] = await getTrancheAmounts(await tranchedPool.getTranche(TRANCHES.Senior))
          // Senior interest amount should be 5.6, but we deducted 0.6$ of protocol fee first,
          // so they only received 5.4
          expect(interestAmount).to.bignumber.eq(usdcVal(54).div(new BN(10)))
          // No principal payment until interest is received
          expect(principalAmount).to.bignumber.eq(usdcVal(0))
          ;[interestAmount, principalAmount] = await getTrancheAmounts(await tranchedPool.getTranche(TRANCHES.Junior))
          expect(interestAmount).to.bignumber.eq(usdcVal(0).div(new BN(10)))
          expect(principalAmount).to.bignumber.eq(usdcVal(0))

          // 10% of 6$ of interest collected
          expect(await usdc.balanceOf(treasury)).to.bignumber.eq(usdcVal(6).div(new BN(10)))

          // Second partial payment. Senior is made whole first and then junior is paid for subsequent interest
          // payments
          await tranchedPool.pay(usdcVal(3))
          ;[interestAmount, principalAmount] = await getTrancheAmounts(await tranchedPool.getTranche(TRANCHES.Senior))
          // Senior interest filled upto 5.6
          expect(interestAmount).to.bignumber.eq(usdcVal(56).div(new BN(10)))
          // No principal available yet
          expect(principalAmount).to.bignumber.eq(usdcVal(0))
          ;[interestAmount, principalAmount] = await getTrancheAmounts(await tranchedPool.getTranche(TRANCHES.Junior))
          // Should be 3.4$, but we only have 2.5$ available (of 3$, 0.2 went to fill the principal interest, and 0.3 to the fee)
          expect(interestAmount).to.bignumber.eq(usdcVal(25).div(new BN(10)))
          // Still no principal available for the junior
          expect(principalAmount).to.bignumber.eq(usdcVal(0))

          // 0.6$ (from previous interest collection) + 0.3$ => 0.9$
          expect(await usdc.balanceOf(treasury)).to.bignumber.eq(usdcVal(9).div(new BN(10)))

          // Final interest payment and first principal payment. Interest is fully paid, and senior gets all of
          // the principal
          await tranchedPool.pay(usdcVal(11))
          ;[interestAmount, principalAmount] = await getTrancheAmounts(await tranchedPool.getTranche(TRANCHES.Senior))
          // Interest unchanged, gets the entire principal portion
          expect(interestAmount).to.bignumber.eq(usdcVal(56).div(new BN(10)))
          expect(principalAmount).to.bignumber.eq(usdcVal(10))
          ;[interestAmount, principalAmount] = await getTrancheAmounts(await tranchedPool.getTranche(TRANCHES.Junior))
          // Full 3.4 of interest, but no principal yet
          expect(interestAmount).to.bignumber.eq(usdcVal(34).div(new BN(10)))
          expect(principalAmount).to.bignumber.eq(usdcVal(0))

          // 1$ of total interest collected
          expect(await usdc.balanceOf(treasury)).to.bignumber.eq(usdcVal(1))

          await tranchedPool.pay(usdcVal(90))
          ;[interestAmount, principalAmount] = await getTrancheAmounts(await tranchedPool.getTranche(TRANCHES.Senior))
          // Interest still unchanged, principal is fully paid off
          expect(interestAmount).to.bignumber.eq(usdcVal(56).div(new BN(10)))
          expect(principalAmount).to.bignumber.eq(usdcVal(80))
          ;[interestAmount, principalAmount] = await getTrancheAmounts(await tranchedPool.getTranche(TRANCHES.Junior))
          // Interest unchanged, principal also fully paid
          expect(interestAmount).to.bignumber.eq(usdcVal(34).div(new BN(10)))
          expect(principalAmount).to.bignumber.eq(usdcVal(20))

          // No additional fees collected (payments were all principal)
          expect(await usdc.balanceOf(treasury)).to.bignumber.eq(usdcVal(1))
        })
      })

      describe("when there is extra interest", async () => {
        // This test is the same as the interest shortfall test, except we'll do it in two payments, and there's an
        // extra 1$ of interest in the last payment
        it("distributes the extra interest solely to the junior", async () => {
          // Ensure a full term has passed
          await advanceTime(tranchedPool, {days: termInDays.toNumber()})

          await tranchedPool.pay(usdcVal(109))

          let interestAmount, principalAmount
          ;[interestAmount, principalAmount] = await getTrancheAmounts(await tranchedPool.getTranche(TRANCHES.Senior))
          // Senior interest and principal fully paid
          expect(interestAmount).to.bignumber.eq(usdcVal(56).div(new BN(10)))
          expect(principalAmount).to.bignumber.eq(usdcVal(80))
          // Junior interest fully paid, last 1$ of principal still outstanding
          ;[interestAmount, principalAmount] = await getTrancheAmounts(await tranchedPool.getTranche(TRANCHES.Junior))
          expect(interestAmount).to.bignumber.eq(usdcVal(34).div(new BN(10)))
          expect(principalAmount).to.bignumber.eq(usdcVal(19))

          // Full 1$ protocol fee (10% of 10$ of total interest) collected
          expect(await usdc.balanceOf(treasury)).to.bignumber.eq(usdcVal(1))

          // 1$ of junior principal remaining, but any additional payment on top of that goes to junior interest
          await tranchedPool.pay(usdcVal(2))
          ;[interestAmount, principalAmount] = await getTrancheAmounts(await tranchedPool.getTranche(TRANCHES.Senior))
          // Unchanged
          expect(interestAmount).to.bignumber.eq(usdcVal(56).div(new BN(10)))
          expect(principalAmount).to.bignumber.eq(usdcVal(80))
          ;[interestAmount, principalAmount] = await getTrancheAmounts(await tranchedPool.getTranche(TRANCHES.Junior))
          // Additional 0.9 of interest (1$ - 10% protocol fee)
          expect(interestAmount).to.bignumber.eq(usdcVal(43).div(new BN(10)))
          // Principal unchanged, we don't expect any new principal back
          expect(principalAmount).to.bignumber.eq(usdcVal(20))

          // Additional 0.1$ of interest collected
          expect(await usdc.balanceOf(treasury)).to.bignumber.eq(usdcVal(11).div(new BN(10)))
        })
      })

      describe("early repayments", async () => {
        it("should apply the additional principal payment according to the leverage ratio", async () => {
          // Advance to the half way point
          const halfway = SECONDS_PER_DAY.mul(termInDays).div(new BN(2))
          await advanceTime(tranchedPool, {seconds: halfway.toNumber()})

          // Principal payment should be split by leverage ratio, while interest payment should be slightly less than half. This
          // is because interest is accrued from the most recent nextDueTime rather than the current timestamp.
          const expectedSeniorInterest = new BN("2761643")
          const expectedJuniorInterest = new BN("1676713")
          const expectedProtocolFee = new BN("493150")
          const totalPartialInterest = expectedSeniorInterest.add(expectedJuniorInterest).add(expectedProtocolFee)
          // 180.0 / 365 * 10 = 4.93150684931506 (180 because we round to the most recent time in paymentPeriodInDays)
          expect(totalPartialInterest).to.bignumber.eq(new BN("4931506"))
          await tranchedPool.pay(usdcVal(50).add(totalPartialInterest), {from: borrower})
          let interestAmount, principalAmount
          ;[interestAmount, principalAmount] = await getTrancheAmounts(await tranchedPool.getTranche(TRANCHES.Senior))
          expect(interestAmount).to.bignumber.eq(expectedSeniorInterest)
          expect(principalAmount).to.bignumber.eq(usdcVal(40))
          ;[interestAmount, principalAmount] = await getTrancheAmounts(await tranchedPool.getTranche(TRANCHES.Junior))
          expect(interestAmount).to.bignumber.eq(expectedJuniorInterest)
          expect(principalAmount).to.bignumber.eq(usdcVal(10))

          expect(await usdc.balanceOf(treasury)).to.bignumber.eq(expectedProtocolFee)

          // Now advance to the end of the loan period and collect interest again. Now the total interest owed should
          // be the interested accrued above * 1.5 (i.e. with a 100$ drawdown and 10% interest, we accrue 5$ for the
          // first 6 months. And since we pay back 50% of principal in the middle, we accrued additional 50% of the 5$,
          // for a total of 7.5$ of interest at the end)

          await advanceTime(tranchedPool, {seconds: halfway.toNumber()})

          await tranchedPool.assess()
          // 185.0 / 365 * 5 = 2.5342465753424657 (185 because that's the number of days left in the term for interest to accrue)
          const remainingInterest = new BN("2534246")
          expect(await creditLine.interestOwed()).to.bignumber.eq(remainingInterest)
          expect(await creditLine.principalOwed()).to.bignumber.eq(usdcVal(50))

          // Collect the remaining interest and the principal
          await tranchedPool.pay(usdcVal(50).add(remainingInterest), {from: borrower})
          ;[interestAmount, principalAmount] = await getTrancheAmounts(await tranchedPool.getTranche(TRANCHES.Senior))
          // We would normally expect 7.5$ of total interest (10% interest on 100$ for 182.5 days and 10% interest on
          // 50$ for 182.5 days). But because we round to the nearest nextDueTime in the past, these amount are slightly
          // less: we collected 10% interest on 100$ for 180 days and 10% interest on 50$ for 185 days. So total
          // interest collected is 7.465753424657534 rather than 7.5

          // Senior = 7.465753424657534 * (leverage ratio of 0.8) * (1- junior fee of 20% - protocol fee of 10%) = 4.18
          expect(interestAmount).to.bignumber.closeTo(usdcVal(418).div(new BN(100)), tolerance)
          expect(principalAmount).to.bignumber.eq(usdcVal(80))
          ;[interestAmount, principalAmount] = await getTrancheAmounts(await tranchedPool.getTranche(TRANCHES.Junior))
          // Junior = 7.465753424657534 - senior interest - 10% protocol fee = 2.5383561643835613
          expect(interestAmount).to.bignumber.closeTo(usdcVal(2538).div(new BN(1000)), tolerance)
          expect(principalAmount).to.bignumber.eq(usdcVal(20))

          // 10% of total interest
          const expectedFee = totalPartialInterest.add(remainingInterest).div(new BN(10))
          expect(await usdc.balanceOf(treasury)).to.bignumber.closeTo(expectedFee, tolerance)
        })
      })
    })
  })
})
