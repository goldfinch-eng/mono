/* global web3 */
const {OWNER_ROLE, PAUSER_ROLE, CONFIG_KEYS} = require("../blockchain_scripts/deployHelpers")
const bre = require("@nomiclabs/buidler")
const {deployments} = bre
const {
  expect,
  BN,
  getBalance,
  getDeployedAsTruffleContract,
  decimals,
  USDC_DECIMALS,
} = require("./testHelpers.js")
let accounts, owner, person2, person3, reserve
const WITHDRAWL_FEE_DENOMINATOR = new BN(200)

describe("Pool", () => {
  let pool, erc20, fidu, goldfinchConfig
  let depositAmount = new BN(4).mul(USDC_DECIMALS)
  let withdrawAmount = new BN(2).mul(USDC_DECIMALS)
  const decimalsDelta = decimals.div(USDC_DECIMALS)

  let makeDeposit = async (person, amount) => {
    amount = amount || depositAmount
    person = person || person2
    return await pool.deposit(String(amount), {from: person})
  }
  let makeWithdraw = async (person, amount) => {
    amount = amount || withdrawAmount
    person = person || person2
    return await pool.withdraw(amount, {from: person})
  }

  const testSetup = deployments.createFixture(async ({deployments, getNamedAccounts}) => {
    // Just to be crystal clear
    const {protocol_owner} = await getNamedAccounts()
    owner = protocol_owner

    await deployments.run("base_deploy")
    const erc20 = await getDeployedAsTruffleContract(deployments, "ERC20")
    const pool = await getDeployedAsTruffleContract(deployments, "Pool")
    const fidu = await getDeployedAsTruffleContract(deployments, "Fidu")
    const goldfinchConfig = await getDeployedAsTruffleContract(deployments, "GoldfinchConfig")

    // A bit of setup for our test users
    await erc20.transfer(person2, new BN(10000).mul(USDC_DECIMALS), {from: owner})
    await erc20.transfer(person3, new BN(1000).mul(USDC_DECIMALS), {from: owner})
    await erc20.approve(pool.address, new BN(100000).mul(USDC_DECIMALS), {from: person2})

    return {erc20, pool, fidu, goldfinchConfig}
  })

  beforeEach(async () => {
    // Pull in our unlocked accounts
    accounts = await web3.eth.getAccounts()
    ;[owner, person2, person3, reserve] = accounts

    const deployResult = await testSetup()
    erc20 = deployResult.erc20
    pool = deployResult.pool
    fidu = deployResult.fidu
    goldfinchConfig = deployResult.goldfinchConfig
    goldfinchConfig.setTreasuryReserve(reserve)
  })

  describe("Access Controls", () => {
    it("sets the owner", async () => {
      expect(await pool.hasRole(OWNER_ROLE, owner)).to.equal(true)
      expect(await pool.getRoleAdmin(OWNER_ROLE)).to.equal(OWNER_ROLE)
    })

    it("sets the pauser", async () => {
      expect(await pool.hasRole(PAUSER_ROLE, owner)).to.equal(true)
      expect(await pool.getRoleAdmin(PAUSER_ROLE)).to.equal(OWNER_ROLE)
    })

    it("allows the owner to set new addresses as roles", async () => {
      expect(await pool.hasRole(OWNER_ROLE, person2)).to.equal(false)
      await pool.grantRole(OWNER_ROLE, person2, {from: owner})
      expect(await pool.hasRole(OWNER_ROLE, person2)).to.equal(true)
    })

    it("should not allow anyone else to add an owner", async () => {
      return expect(pool.grantRole(OWNER_ROLE, person2, {from: person3})).to.be.rejected
    })
  })

  describe("Pausability", () => {
    describe("after pausing", async () => {
      beforeEach(async () => {
        await makeDeposit()
        await pool.pause()
      })
      it("disallows deposits", async () => {
        return expect(makeDeposit()).to.be.rejectedWith(/Pausable: paused/)
      })
      it("disallows withdrawing", async () => {
        return expect(makeWithdraw()).to.be.rejectedWith(/Pausable: paused/)
      })
      it("allows unpausing", async () => {
        await pool.unpause()
        return expect(makeDeposit()).to.be.fulfilled
      })
    })

    describe("actually pausing", async () => {
      it("should allow the owner to pause", async () => {
        return expect(pool.pause()).to.be.fulfilled
      })
      it("should disallow non-owner to pause", async () => {
        return expect(pool.pause({from: person2})).to.be.rejectedWith(/Must have pauser role to pause/)
      })
    })
  })

  describe("deposit", () => {
    describe("before you have approved the pool to transfer funds on your behalf", async () => {
      it("should fail", async () => {
        const expectedErr = "VM Exception while processing transaction: revert ERC20: transfer amount exceeds allowance"
        return expect(makeDeposit(person3)).to.be.rejectedWith(expectedErr)
      })
    })

    describe("after you have approved the pool to transfer funds", async () => {
      let capitalProvider
      beforeEach(async () => {
        await erc20.approve(pool.address, new BN(100000).mul(USDC_DECIMALS), {from: person2})
        await erc20.approve(pool.address, new BN(100000).mul(USDC_DECIMALS), {from: owner})
        capitalProvider = person2
      })

      it("increases the pools balance of the ERC20 token when you call deposit", async () => {
        const balanceBefore = await getBalance(pool.address, erc20)
        await makeDeposit()
        const balanceAfter = await getBalance(pool.address, erc20)
        const delta = balanceAfter.sub(balanceBefore)
        expect(delta).to.bignumber.equal(depositAmount)
      })

      it("decreases the depositors balance of the ERC20 token when you call deposit", async () => {
        const balanceBefore = await getBalance(capitalProvider, erc20)
        await makeDeposit()
        const balanceAfter = await getBalance(capitalProvider, erc20)
        const delta = balanceBefore.sub(balanceAfter)
        expect(delta).to.bignumber.equal(depositAmount)
      })

      it("gives the depositor the correct amount of Fidu", async () => {
        await makeDeposit()
        const fiduBalance = await getBalance(person2, fidu)
        expect(fiduBalance).to.bignumber.equal(depositAmount.mul(decimalsDelta))
      })

      it("tracks other accounting correctly on Fidu", async () => {
        const totalSupplyBefore = await fidu.totalSupply()
        await makeDeposit()
        const totalSupplyAfter = await fidu.totalSupply()
        expect(totalSupplyAfter.sub(totalSupplyBefore)).to.bignumber.equal(depositAmount.mul(decimalsDelta))
      })

      it("emits an event with the correct data", async () => {
        const result = await makeDeposit()
        const event = result.logs[0]

        expect(event.event).to.equal("DepositMade")
        expect(event.args.capitalProvider).to.equal(capitalProvider)
        expect(event.args.amount).to.bignumber.equal(depositAmount)
        expect(event.args.shares).to.bignumber.equal(depositAmount.mul(decimalsDelta))
      })

      it("increases the totalShares, even when two different people deposit", async () => {
        const secondDepositAmount = new BN(1).mul(USDC_DECIMALS)
        await makeDeposit()
        await makeDeposit(owner, secondDepositAmount)
        const totalShares = await fidu.totalSupply()
        const totalDeposited = depositAmount.mul(decimalsDelta).add(secondDepositAmount.mul(decimalsDelta))
        expect(totalShares).to.bignumber.equal(totalDeposited)
      })
    })
  })

  describe("getNumShares", () => {
    it("calculates correctly", async () => {
      const amount = 3000
      const sharePrice = await pool.sharePrice()
      const numShares = await pool._getNumShares(amount)
      expect(numShares).to.bignumber.equal(
        new BN(amount).mul(decimals.div(USDC_DECIMALS)).mul(decimals).div(sharePrice)
      )
    })
  })

  describe("withdraw", () => {
    let capitalProvider
    beforeEach(async () => {
      await erc20.approve(pool.address, new BN(100000).mul(USDC_DECIMALS), {from: person2})
      await erc20.approve(pool.address, new BN(100000).mul(USDC_DECIMALS), {from: owner})

      capitalProvider = person2
    })

    it("withdraws the correct amount of value from the contract when you call withdraw", async () => {
      await makeDeposit()
      const balanceBefore = await getBalance(pool.address, erc20)
      await makeWithdraw()
      const balanceAfter = await getBalance(pool.address, erc20)
      const delta = balanceBefore.sub(balanceAfter)
      expect(delta).to.bignumber.equal(withdrawAmount)
    })

    it("emits an event with the correct data", async () => {
      await makeDeposit()
      const result = await makeWithdraw()
      const event = result.logs[0]

      expect(event.event).to.equal("WithdrawalMade")
      expect(event.args.capitalProvider).to.equal(capitalProvider)
      expect(event.args.amount).to.bignumber.equal(withdrawAmount)
    })

    it("should emit an event that the reserve received funds", async () => {
      await makeDeposit()
      const result = await makeWithdraw()
      const event = result.logs[1]

      expect(event.event).to.equal("ReserveFundsCollected")
      expect(event.args.user).to.equal(capitalProvider)
      expect(event.args.amount).to.bignumber.equal(withdrawAmount.div(WITHDRAWL_FEE_DENOMINATOR))
    })

    it("sends the amount back to the address, accounting for fees", async () => {
      await makeDeposit()
      const addressValueBefore = await getBalance(person2, erc20)
      await makeWithdraw()
      const addressValueAfter = await getBalance(person2, erc20)
      const expectedFee = withdrawAmount.div(WITHDRAWL_FEE_DENOMINATOR)
      const delta = addressValueAfter.sub(addressValueBefore)
      expect(delta).bignumber.equal(withdrawAmount.sub(expectedFee))
    })

    it("should send the fees to the reserve address", async () => {
      await makeDeposit()
      const reserveBalanceBefore = await getBalance(reserve, erc20)
      await makeWithdraw()
      const reserveBalanceAfter = await getBalance(reserve, erc20)
      const expectedFee = withdrawAmount.div(WITHDRAWL_FEE_DENOMINATOR)
      const delta = reserveBalanceAfter.sub(reserveBalanceBefore)
      expect(delta).bignumber.equal(expectedFee)
    })

    it("reduces your shares of fidu", async () => {
      await makeDeposit()
      const balanceBefore = await getBalance(person2, fidu)
      await makeWithdraw()
      const balanceAfter = await getBalance(person2, fidu)
      const expectedShares = balanceBefore.sub(withdrawAmount.mul(decimals).div(USDC_DECIMALS))
      expect(balanceAfter).to.bignumber.equal(expectedShares)
    })

    it("decreases the totalSupply of Fidu", async () => {
      await makeDeposit()
      const sharesBefore = await fidu.totalSupply()
      await makeWithdraw()
      const sharesAfter = await fidu.totalSupply()
      const expectedShares = sharesBefore.sub(withdrawAmount.mul(decimals.div(USDC_DECIMALS)))
      expect(sharesAfter).to.bignumber.equal(expectedShares)
    })

    it("prevents you from withdrawing more than you have", async () => {
      const expectedErr = /Amount requested is greater than what this address owns/
      return expect(makeWithdraw()).to.be.rejectedWith(expectedErr)
    })

    it("it lets you withdraw your exact total holdings", async () => {
      await makeDeposit(person2, 123)
      await makeWithdraw(person2, 123)
      const sharesAfter = await getBalance(person2, fidu)
      expect(sharesAfter.toNumber()).to.equal(0)
    })
  })

  describe("collectInterestRepayment", async () => {
    beforeEach(async () => {
      await erc20.approve(pool.address, new BN(100000).mul(USDC_DECIMALS), {from: person2})
      await makeDeposit()
    })
    it("should emit an event with the right information", async () => {
      //Pretend the person3 is the credit desk for collecting payments
      await goldfinchConfig.setAddressForTest(CONFIG_KEYS.CreditDesk, person3)

      const amount = new BN(1).mul(USDC_DECIMALS)
      const response = await pool.collectInterestRepayment(person2, amount, {from: person3})
      const event = response.logs[0]
      expect(event.event).to.equal("InterestCollected")
      expect(event.args.payer).to.equal(person2)
      expect(event.args.amount).to.bignumber.equal(amount)
    })

    it("should not allow collection from anyone other than the admin", async () => {
      const amount = new BN(1).mul(USDC_DECIMALS)
      await expect(pool.collectInterestRepayment(person2, amount, {from: person2})).to.be.rejectedWith(
        /Only the credit desk/
      )
      await expect(pool.collectInterestRepayment(person2, amount, {from: owner})).to.be.rejectedWith(
        /Only the credit desk/
      )
    })
  })

  describe("collectPrincipalRepayment", async () => {
    beforeEach(async () => {
      await erc20.approve(pool.address, new BN(100000).mul(USDC_DECIMALS), {from: person2})
      await makeDeposit()
    })
    it("should emit an event with the right information", async () => {
      //Pretend the person3 is the credit desk for collecting payments
      await goldfinchConfig.setAddressForTest(CONFIG_KEYS.CreditDesk, person3)

      const amount = new BN(1).mul(USDC_DECIMALS)
      const response = await pool.collectPrincipalRepayment(person2, amount, {from: person3})
      const event = response.logs[0]
      expect(event.event).to.equal("PrincipalCollected")
      expect(event.args.payer).to.equal(person2)
      expect(event.args.amount).to.bignumber.equal(amount)
    })

    it("should not allow collection from anyone other than the admin", async () => {
      const amount = new BN(1).mul(USDC_DECIMALS)
      await expect(pool.collectPrincipalRepayment(person2, amount, {from: person2})).to.be.rejectedWith(
        /Only the credit desk/
      )
      await expect(pool.collectPrincipalRepayment(person2, amount, {from: owner})).to.be.rejectedWith(
        /Only the credit desk/
      )
    })
  })

  describe("transferFrom", async () => {
    it("should emit an event with the right information", async () => {
      const amount = new BN(1).mul(USDC_DECIMALS)
      // Assume person3 is the credit desk
      await goldfinchConfig.setAddressForTest(CONFIG_KEYS.CreditDesk, person3)

      const response = await pool.transferFrom(person2, pool.address, amount, {from: person3})
      const event = response.logs[0]
      expect(event.event).to.equal("TransferMade")
      expect(event.args.from).to.equal(person2)
      expect(event.args.to).to.equal(pool.address)
      expect(event.args.amount).to.bignumber.equal(amount)
    })
  })

  describe("hard limits", async () => {
    describe("totalFundsLimit", async () => {
      describe("once it's set", async () => {
        let limit = new BN(5000)
        beforeEach(async () => {
          await goldfinchConfig.setNumber(CONFIG_KEYS.TotalFundsLimit, limit.mul(USDC_DECIMALS))
          await goldfinchConfig.setNumber(CONFIG_KEYS.TransactionLimit, limit.mul(new BN(2)).mul(USDC_DECIMALS))
        })

        it("should accept deposits before the limit is reached", async () => {
          return expect(makeDeposit(person2, new BN(1000).mul(USDC_DECIMALS))).to.be.fulfilled
        })

        it("should accept everything right up to the limit", async () => {
          return expect(makeDeposit(person2, new BN(limit).mul(USDC_DECIMALS))).to.be.fulfilled
        })

        it("should fail if you're over the limit", async () => {
          return expect(makeDeposit(person2, new BN(limit).add(new BN(1)).mul(USDC_DECIMALS))).to.be.rejectedWith(
            /put the Pool over the total limit/
          )
        })
      })
    })
    describe("transactionLimit", async () => {
      describe("after setting it", async () => {
        let limit
        beforeEach(async () => {
          limit = new BN(1000)
          await goldfinchConfig.setNumber(CONFIG_KEYS.TotalFundsLimit, limit.mul(new BN(10)).mul(USDC_DECIMALS))
          await goldfinchConfig.setNumber(CONFIG_KEYS.TransactionLimit, limit.mul(USDC_DECIMALS))
        })

        it("should still allow transactions up to the limit", async () => {
          return expect(makeDeposit(person2, new BN(limit).mul(USDC_DECIMALS))).to.be.fulfilled
        })

        it("should block deposits over the limit", async () => {
          return expect(makeDeposit(person2, new BN(limit).add(new BN(1)).mul(USDC_DECIMALS))).to.be.rejectedWith(
            /Amount is over the per-transaction limit/
          )
        })

        it("should block withdrawals over the limit", async () => {
          await makeDeposit(person2, new BN(limit).mul(USDC_DECIMALS))
          await makeDeposit(person2, new BN(limit).mul(USDC_DECIMALS))

          return expect(makeWithdraw(person2, new BN(limit).add(new BN(1)).mul(USDC_DECIMALS))).to.be.rejectedWith(
            /Amount is over the per-transaction limit/
          )
        })
      })
    })
  })

  describe("USDC Mantissa", async () => {
    it("should equal 1e6", async () => {
      expect(await pool._usdcMantissa()).to.bignumber.equal(USDC_DECIMALS)
    })
  })

  describe("Fidu Mantissa", async () => {
    it("should equal 1e18", async () => {
      expect(await pool._fiduMantissa()).to.bignumber.equal(decimals)
    })
  })

  describe("usdcToFidu", async () => {
    it("should equal 1e12", async () => {
      expect(await pool._usdcToFidu(new BN(1))).to.bignumber.equal(new BN(1e12))
    })
  })
})
