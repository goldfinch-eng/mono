/* global web3  */
const BN = require("bn.js")
const hre = require("hardhat")
const {deployments} = hre
const {
  createPoolWithCreditLine,
  usdcVal,
  deployAllContracts,
  erc20Transfer,
  erc20Approve,
  expect,
  ZERO_ADDRESS,
  SECONDS_PER_DAY,
  decodeLogs,
  expectAction,
  advanceTime,
} = require("./testHelpers")
const {time} = require("@openzeppelin/test-helpers")
const {interestAprAsBN, MAX_UINT} = require("../blockchain_scripts/deployHelpers")
const {ecsign} = require("ethereumjs-util")
const {getApprovalDigest, getWallet} = require("./permitHelpers")
const WITHDRAWL_FEE_DENOMINATOR = new BN(200)

let owner,
  borrower,
  otherPerson,
  goldfinchConfig,
  usdc,
  poolTokens,
  tranchedPool,
  transferRestrictedVault,
  treasury,
  goldfinchFactory,
  seniorFund,
  fidu

describe("TransferRestrictedVault", async () => {
  beforeEach(async () => {
    ;[owner, borrower, treasury, otherPerson] = await web3.eth.getAccounts()
    ;({usdc, goldfinchConfig, goldfinchFactory, poolTokens, transferRestrictedVault, seniorFund, fidu} =
      await deployAllContracts(deployments))
    await goldfinchConfig.bulkAddToGoList([owner, borrower, otherPerson, transferRestrictedVault.address])
    await goldfinchConfig.setTreasuryReserve(treasury)
    await erc20Transfer(usdc, [otherPerson], usdcVal(10000), owner)
    await erc20Transfer(usdc, [borrower], usdcVal(10000), owner)

    let juniorInvestmentAmount = usdcVal(10000)
    let limit = juniorInvestmentAmount.mul(new BN(10))
    let interestApr = interestAprAsBN("5.00")
    let paymentPeriodInDays = new BN(30)
    let termInDays = new BN(365)
    let lateFeeApr = new BN(0)
    let juniorFeePercent = new BN(20)
    ;({tranchedPool} = await createPoolWithCreditLine({
      people: {owner, borrower},
      goldfinchFactory,
      juniorFeePercent,
      limit,
      interestApr,
      paymentPeriodInDays,
      termInDays,
      lateFeeApr,
      usdc,
    }))
  })

  describe("depositJunior", async () => {
    beforeEach(async () => {
      await erc20Approve(usdc, transferRestrictedVault.address, usdcVal(100000), [owner])
    })

    context("sender is not go-listed", async () => {
      it("reverts", async () => {
        await goldfinchConfig.removeFromGoList(owner)
        await expect(
          transferRestrictedVault.depositJunior(tranchedPool.address, usdcVal(1000), {from: owner})
        ).to.be.rejectedWith(/This address has not been go-listed/)
      })
    })

    it("mints an NFT representing a junior pool position", async () => {
      let receipt = await transferRestrictedVault.depositJunior(tranchedPool.address, usdcVal(1000))
      let vaultMintEvent = decodeLogs(receipt.receipt.rawLogs, transferRestrictedVault, "Transfer")[0]
      let poolTokenMintEvent = decodeLogs(receipt.receipt.rawLogs, poolTokens, "TokenMinted")[0]

      expect(vaultMintEvent.args.from).to.equal(ZERO_ADDRESS)
      expect(vaultMintEvent.args.to).to.equal(owner)

      expect(poolTokenMintEvent.args.owner).to.equal(transferRestrictedVault.address)
      expect(poolTokenMintEvent.args.pool).to.equal(tranchedPool.address)
      expect(poolTokenMintEvent.args.amount).to.bignumber.equal(usdcVal(1000))

      let tokenId = vaultMintEvent.args.tokenId
      let poolTokenId = poolTokenMintEvent.args.tokenId
      let juniorPosition = await transferRestrictedVault.poolTokenPositions(tokenId)

      let currentTime = await time.latest()
      let expectedLockedUntil = currentTime.add(new BN(365).mul(SECONDS_PER_DAY))

      expect(await poolTokens.ownerOf(poolTokenId)).to.equal(transferRestrictedVault.address)
      expect(await transferRestrictedVault.ownerOf(tokenId)).to.equal(owner)
      expect(juniorPosition.tokenId).to.bignumber.equal(poolTokenId)
      expect(juniorPosition.lockedUntil).to.bignumber.equal(expectedLockedUntil)
    })
  })

  describe("depositJuniorWithPermit", async () => {
    it("mints an NFT representing a junior pool position", async () => {
      let value = usdcVal(1000)
      let nonce = await usdc.nonces(owner)
      let deadline = MAX_UINT

      // Create signature for permit
      let digest = await getApprovalDigest({
        token: usdc,
        owner: owner,
        spender: transferRestrictedVault.address,
        value,
        nonce,
        deadline,
      })
      let wallet = await getWallet(owner)
      let {v, r, s} = ecsign(Buffer.from(digest.slice(2), "hex"), Buffer.from(wallet.privateKey.slice(2), "hex"))

      let receipt = await transferRestrictedVault.depositJuniorWithPermit(
        tranchedPool.address,
        value,
        deadline,
        v,
        r,
        s,
        {
          from: owner,
        }
      )

      let vaultMintEvent = decodeLogs(receipt.receipt.rawLogs, transferRestrictedVault, "Transfer")[0]
      let poolTokenMintEvent = decodeLogs(receipt.receipt.rawLogs, poolTokens, "TokenMinted")[0]

      expect(vaultMintEvent.args.from).to.equal(ZERO_ADDRESS)
      expect(vaultMintEvent.args.to).to.equal(owner)

      expect(poolTokenMintEvent.args.owner).to.equal(transferRestrictedVault.address)
      expect(poolTokenMintEvent.args.pool).to.equal(tranchedPool.address)
      expect(poolTokenMintEvent.args.amount).to.bignumber.equal(usdcVal(1000))

      let tokenId = vaultMintEvent.args.tokenId
      let poolTokenId = poolTokenMintEvent.args.tokenId
      let juniorPosition = await transferRestrictedVault.poolTokenPositions(tokenId)

      let currentTime = await time.latest()
      let expectedLockedUntil = currentTime.add(new BN(365).mul(SECONDS_PER_DAY))

      expect(await poolTokens.ownerOf(poolTokenId)).to.equal(transferRestrictedVault.address)
      expect(await transferRestrictedVault.ownerOf(tokenId)).to.equal(owner)
      expect(juniorPosition.tokenId).to.bignumber.equal(poolTokenId)
      expect(juniorPosition.lockedUntil).to.bignumber.equal(expectedLockedUntil)
    })
  })

  describe("depositSenior", async () => {
    beforeEach(async () => {
      await erc20Approve(usdc, transferRestrictedVault.address, usdcVal(100000), [owner])
    })

    it("mints an NFT representing a senior pool position", async () => {
      let receipt = await transferRestrictedVault.depositSenior(usdcVal(1000))
      let vaultMintEvent = decodeLogs(receipt.receipt.rawLogs, transferRestrictedVault, "Transfer")[0]
      let seniorFundDepositEvent = decodeLogs(receipt.receipt.rawLogs, seniorFund, "DepositMade")[0]

      expect(vaultMintEvent.args.from).to.equal(ZERO_ADDRESS)
      expect(vaultMintEvent.args.to).to.equal(owner)

      expect(seniorFundDepositEvent.args.capitalProvider).to.equal(transferRestrictedVault.address)
      expect(seniorFundDepositEvent.args.amount).to.bignumber.equal(usdcVal(1000))

      let tokenId = vaultMintEvent.args.tokenId
      let shares = seniorFundDepositEvent.args.shares
      let position = await transferRestrictedVault.fiduPositions(tokenId)

      let currentTime = await time.latest()
      let expectedLockedUntil = currentTime.add(new BN(365).mul(SECONDS_PER_DAY))

      expect(await transferRestrictedVault.ownerOf(tokenId)).to.equal(owner)
      expect(await fidu.balanceOf(transferRestrictedVault.address)).to.bignumber.equal(shares)
      expect(position.amount).to.bignumber.equal(shares)
      expect(position.lockedUntil).to.bignumber.equal(expectedLockedUntil)
    })
  })

  describe("depositSeniorWithPermit", async () => {
    it("mints an NFT representing a senior pool position", async () => {
      let value = usdcVal(1000)
      let nonce = await usdc.nonces(owner)
      let deadline = MAX_UINT

      // Create signature for permit
      let digest = await getApprovalDigest({
        token: usdc,
        owner: owner,
        spender: transferRestrictedVault.address,
        value,
        nonce,
        deadline,
      })
      let wallet = await getWallet(owner)
      let {v, r, s} = ecsign(Buffer.from(digest.slice(2), "hex"), Buffer.from(wallet.privateKey.slice(2), "hex"))

      let receipt = await transferRestrictedVault.depositSeniorWithPermit(value, deadline, v, r, s, {
        from: owner,
      })

      let vaultMintEvent = decodeLogs(receipt.receipt.rawLogs, transferRestrictedVault, "Transfer")[0]
      let seniorFundDepositEvent = decodeLogs(receipt.receipt.rawLogs, seniorFund, "DepositMade")[0]

      expect(vaultMintEvent.args.from).to.equal(ZERO_ADDRESS)
      expect(vaultMintEvent.args.to).to.equal(owner)

      expect(seniorFundDepositEvent.args.capitalProvider).to.equal(transferRestrictedVault.address)
      expect(seniorFundDepositEvent.args.amount).to.bignumber.equal(usdcVal(1000))

      let tokenId = vaultMintEvent.args.tokenId
      let shares = seniorFundDepositEvent.args.shares
      let position = await transferRestrictedVault.fiduPositions(tokenId)

      let currentTime = await time.latest()
      let expectedLockedUntil = currentTime.add(new BN(365).mul(SECONDS_PER_DAY))

      expect(await transferRestrictedVault.ownerOf(tokenId)).to.equal(owner)
      expect(await fidu.balanceOf(transferRestrictedVault.address)).to.bignumber.equal(shares)
      expect(position.amount).to.bignumber.equal(shares)
      expect(position.lockedUntil).to.bignumber.equal(expectedLockedUntil)
    })
  })

  describe("withdrawSenior", async () => {
    let tokenId
    let amount = usdcVal(1000)

    beforeEach(async () => {
      await erc20Approve(usdc, transferRestrictedVault.address, usdcVal(100000), [owner])
      let receipt = await transferRestrictedVault.depositSenior(amount)
      tokenId = decodeLogs(receipt.receipt.rawLogs, transferRestrictedVault, "Transfer")[0].args.tokenId
    })

    context("not the owner of tokenId", async () => {
      it("reverts", async () => {
        await expect(
          transferRestrictedVault.withdrawSenior(tokenId, usdcVal(500), {from: otherPerson})
        ).to.be.rejectedWith(/Only the token owner is allowed to call this function/)
      })
    })

    context("withdrawing more than your position", async () => {
      it("reverts", async () => {
        await expect(transferRestrictedVault.withdrawSenior(tokenId, usdcVal(5000))).to.be.rejectedWith(
          /Not enough Fidu/
        )
      })
    })

    context("withdrawing the wrong type of position", async () => {
      beforeEach(async () => {
        let receipt = await transferRestrictedVault.depositJunior(tranchedPool.address, amount)
        tokenId = decodeLogs(receipt.receipt.rawLogs, transferRestrictedVault, "Transfer")[0].args.tokenId
      })

      it("reverts", async () => {
        await expect(transferRestrictedVault.withdrawSenior(tokenId, amount)).to.be.rejectedWith(/Not enough Fidu/)
      })
    })

    it("withdraws USDC", async () => {
      let position = await transferRestrictedVault.fiduPositions(tokenId)
      let withdrawalFee = amount.div(WITHDRAWL_FEE_DENOMINATOR)
      await expectAction(() => transferRestrictedVault.withdrawSenior(tokenId, amount)).toChange([
        [() => usdc.balanceOf(owner), {by: amount.sub(withdrawalFee)}],
        [() => fidu.balanceOf(transferRestrictedVault.address), {by: position.amount.neg()}],
        [async () => (await transferRestrictedVault.fiduPositions(tokenId)).amount, {by: position.amount.neg()}],
      ])
      // Trying to withdraw more should revert
      await expect(transferRestrictedVault.withdrawSenior(tokenId, new BN(1))).to.be.rejectedWith(/Not enough Fidu/)
    })
  })

  describe("withdrawSeniorInFidu", async () => {
    let tokenId, shares
    let amount = usdcVal(1000)

    beforeEach(async () => {
      await erc20Approve(usdc, transferRestrictedVault.address, usdcVal(100000), [owner])
      let receipt = await transferRestrictedVault.depositSenior(amount)
      tokenId = decodeLogs(receipt.receipt.rawLogs, transferRestrictedVault, "Transfer")[0].args.tokenId
      let position = await transferRestrictedVault.fiduPositions(tokenId)
      shares = position.amount
    })

    context("not the owner of tokenId", async () => {
      it("reverts", async () => {
        await expect(
          transferRestrictedVault.withdrawSeniorInFidu(tokenId, shares, {from: otherPerson})
        ).to.be.rejectedWith(/Only the token owner is allowed to call this function/)
      })
    })

    context("withdrawing more than your position", async () => {
      it("reverts", async () => {
        await expect(transferRestrictedVault.withdrawSeniorInFidu(tokenId, shares.add(new BN(1)))).to.be.rejectedWith(
          /Not enough Fidu/
        )
      })
    })

    context("withdrawing the wrong type of position", async () => {
      beforeEach(async () => {
        let receipt = await transferRestrictedVault.depositJunior(tranchedPool.address, amount)
        tokenId = decodeLogs(receipt.receipt.rawLogs, transferRestrictedVault, "Transfer")[0].args.tokenId
      })

      it("reverts", async () => {
        await expect(transferRestrictedVault.withdrawSeniorInFidu(tokenId, shares)).to.be.rejectedWith(
          /Not enough Fidu/
        )
      })
    })

    it("withdraws USDC", async () => {
      let withdrawalFee = amount.div(WITHDRAWL_FEE_DENOMINATOR)
      await expectAction(() => transferRestrictedVault.withdrawSeniorInFidu(tokenId, shares)).toChange([
        [() => usdc.balanceOf(owner), {by: amount.sub(withdrawalFee)}],
        [() => fidu.balanceOf(transferRestrictedVault.address), {by: shares.neg()}],
        [async () => (await transferRestrictedVault.fiduPositions(tokenId)).amount, {by: shares.neg()}],
      ])
      // Trying to withdraw more should revert
      await expect(transferRestrictedVault.withdrawSenior(tokenId, new BN(1))).to.be.rejectedWith(/Not enough Fidu/)
    })
  })

  describe("withdrawJunior", async () => {
    let tokenId
    let amount = usdcVal(1000)

    beforeEach(async () => {
      await erc20Approve(usdc, transferRestrictedVault.address, usdcVal(100000), [owner])
      let receipt = await transferRestrictedVault.depositJunior(tranchedPool.address, amount)
      tokenId = decodeLogs(receipt.receipt.rawLogs, transferRestrictedVault, "Transfer")[0].args.tokenId
    })

    context("not the token of ownerId", async () => {
      it("reverts", async () => {
        await expect(
          transferRestrictedVault.withdrawJunior(tokenId, usdcVal(500), {from: otherPerson})
        ).to.be.rejectedWith(/Only the token owner is allowed to call this function/)
      })
    })

    context("withdrawing more than your position", async () => {
      it("reverts", async () => {
        await expect(transferRestrictedVault.withdrawJunior(tokenId, amount.add(new BN(1)))).to.be.rejectedWith(
          /Invalid redeem amount/
        )
      })
    })

    context("withdrawing the wrong type of position", async () => {
      beforeEach(async () => {
        let receipt = await transferRestrictedVault.depositSenior(amount)
        tokenId = decodeLogs(receipt.receipt.rawLogs, transferRestrictedVault, "Transfer")[0].args.tokenId
      })

      it("reverts", async () => {
        await expect(transferRestrictedVault.withdrawJunior(tokenId, amount)).to.be.rejectedWith(/Position is empty/)
      })
    })

    it("withdraws USDC", async () => {
      // We can withdraw the full amount because the pool has not yet been locked for drawdown
      await expectAction(() => transferRestrictedVault.withdrawJunior(tokenId, amount)).toChange([
        [() => usdc.balanceOf(owner), {by: amount}],
      ])
      // But trying to withdraw more should result in an error
      await expect(transferRestrictedVault.withdrawJunior(tokenId, new BN(1))).to.be.rejectedWith(
        /Invalid redeem amount/
      )
    })
  })

  describe("transferFrom", async () => {
    it("reverts", async () => {
      await erc20Approve(usdc, transferRestrictedVault.address, usdcVal(100000), [owner])
      let receipt = await transferRestrictedVault.depositJunior(tranchedPool.address, usdcVal(1000))
      let tokenId = decodeLogs(receipt.receipt.rawLogs, transferRestrictedVault, "Transfer")[0].args.tokenId

      await transferRestrictedVault.approve(otherPerson, tokenId)
      await expect(transferRestrictedVault.transferFrom(owner, otherPerson, tokenId)).to.be.rejectedWith(
        /tokens cannot be transferred/
      )
    })
  })
  describe("safeTransferFrom", async () => {
    it("reverts", async () => {
      await erc20Approve(usdc, transferRestrictedVault.address, usdcVal(100000), [owner])
      let receipt = await transferRestrictedVault.depositJunior(tranchedPool.address, usdcVal(1000))
      let tokenId = decodeLogs(receipt.receipt.rawLogs, transferRestrictedVault, "Transfer")[0].args.tokenId

      await transferRestrictedVault.approve(otherPerson, tokenId)
      await expect(
        transferRestrictedVault.safeTransferFrom(owner, otherPerson, tokenId, web3.utils.asciiToHex("test"))
      ).to.be.rejectedWith(/tokens cannot be transferred/)
    })
  })

  describe("transferPosition", async () => {
    let tokenId1, tokenId2
    beforeEach(async () => {
      await erc20Approve(usdc, transferRestrictedVault.address, usdcVal(100000), [owner])
      let receipt1 = await transferRestrictedVault.depositJunior(tranchedPool.address, usdcVal(1000))
      tokenId1 = decodeLogs(receipt1.receipt.rawLogs, transferRestrictedVault, "Transfer")[0].args.tokenId
      let receipt2 = await transferRestrictedVault.depositSenior(usdcVal(500))
      tokenId2 = decodeLogs(receipt2.receipt.rawLogs, transferRestrictedVault, "Transfer")[0].args.tokenId
    })

    context("before timelock", async () => {
      it("reverts", async () => {
        await expect(transferRestrictedVault.transferPosition(tokenId1, owner)).to.be.rejectedWith(
          /Underlying position cannot be transferred until lockedUntil/
        )
        await expect(transferRestrictedVault.transferPosition(tokenId2, owner)).to.be.rejectedWith(
          /Underlying position cannot be transferred until lockedUntil/
        )
      })
    })

    context("after timelock", async () => {
      beforeEach(async () => {
        await advanceTime(null, {days: 365})
      })

      context("not the owner of tokenId", async () => {
        it("reverts", async () => {
          await expect(
            transferRestrictedVault.transferPosition(tokenId1, otherPerson, {from: otherPerson})
          ).to.be.rejectedWith(/don't own/)
        })
      })

      it("transfers underlying position", async () => {
        // PoolTokens position has been transferred
        let juniorPosition = await transferRestrictedVault.poolTokenPositions(tokenId1)
        await transferRestrictedVault.transferPosition(tokenId1, owner)
        expect(await poolTokens.ownerOf(juniorPosition.tokenId)).to.equal(owner)

        // Fidu position has been transferred
        let shares = await fidu.balanceOf(transferRestrictedVault.address)
        await expectAction(() => transferRestrictedVault.transferPosition(tokenId2, owner)).toChange([
          [async () => await fidu.balanceOf(owner), {by: shares}],
          [async () => await fidu.balanceOf(transferRestrictedVault.address), {by: shares.neg()}],
        ])

        // Tokens have been burned
        await expect(transferRestrictedVault.ownerOf(tokenId1)).to.be.rejectedWith(/nonexistent token/)
        await expect(transferRestrictedVault.ownerOf(tokenId2)).to.be.rejectedWith(/nonexistent token/)
      })
    })
  })
})
