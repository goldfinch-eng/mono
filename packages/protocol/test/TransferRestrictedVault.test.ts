/* global web3  */
import BN from "bn.js"
import {
  createPoolWithCreditLine,
  usdcVal,
  erc20Transfer,
  erc20Approve,
  expect,
  ZERO_ADDRESS,
  SECONDS_PER_DAY,
  decodeLogs,
  expectAction,
  advanceTime,
  getFirstLog,
} from "./testHelpers"
import {time} from "@openzeppelin/test-helpers"
import {interestAprAsBN, MAX_UINT} from "../blockchain_scripts/deployHelpers"
import {ecsign} from "ethereumjs-util"
import {getApprovalDigest, getWallet} from "./permitHelpers"
import {assertNonNullable} from "@goldfinch-eng/utils"
import {GoldfinchFactoryInstance} from "../typechain/truffle"
import {deployBaseFixture} from "./util/fixtures"
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
  goldfinchFactory: GoldfinchFactoryInstance,
  seniorPool,
  fidu

describe("TransferRestrictedVault", async () => {
  beforeEach(async () => {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;[owner, borrower, treasury, otherPerson] = await web3.eth.getAccounts()
    ;({usdc, goldfinchConfig, goldfinchFactory, poolTokens, transferRestrictedVault, seniorPool, fidu} =
      await deployBaseFixture())
    await goldfinchConfig.bulkAddToGoList([owner, borrower, otherPerson, transferRestrictedVault.address])
    await goldfinchConfig.setTreasuryReserve(treasury)
    await erc20Transfer(usdc, [otherPerson], usdcVal(10000), owner)
    await erc20Transfer(usdc, [borrower], usdcVal(10000), owner)

    const juniorInvestmentAmount = usdcVal(10000)
    const limit = juniorInvestmentAmount.mul(new BN(10))
    const interestApr = interestAprAsBN("5.00")
    const paymentPeriodInDays = new BN(30)
    const termInDays = new BN(365)
    const lateFeeApr = new BN(0)
    const juniorFeePercent = new BN(20)
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
      const receipt = await transferRestrictedVault.depositJunior(tranchedPool.address, usdcVal(1000))
      const vaultMintEvent = getFirstLog(decodeLogs(receipt.receipt.rawLogs, transferRestrictedVault, "Transfer"))
      const poolTokenMintEvent = getFirstLog(decodeLogs(receipt.receipt.rawLogs, poolTokens, "TokenMinted"))

      expect(vaultMintEvent.args.from).to.equal(ZERO_ADDRESS)
      expect(vaultMintEvent.args.to).to.equal(owner)

      expect(poolTokenMintEvent.args.owner).to.equal(transferRestrictedVault.address)
      expect(poolTokenMintEvent.args.pool).to.equal(tranchedPool.address)
      expect(poolTokenMintEvent.args.amount).to.bignumber.equal(usdcVal(1000))

      const tokenId = vaultMintEvent.args.tokenId
      const poolTokenId = poolTokenMintEvent.args.tokenId
      const juniorPosition = await transferRestrictedVault.poolTokenPositions(tokenId)

      const currentTime = await time.latest()
      const expectedLockedUntil = currentTime.add(new BN(365).mul(SECONDS_PER_DAY))

      expect(await poolTokens.ownerOf(poolTokenId)).to.equal(transferRestrictedVault.address)
      expect(await transferRestrictedVault.ownerOf(tokenId)).to.equal(owner)
      expect(juniorPosition.tokenId).to.bignumber.equal(poolTokenId)
      expect(juniorPosition.lockedUntil).to.bignumber.equal(expectedLockedUntil)
    })
  })

  describe("depositJuniorWithPermit", async () => {
    it("mints an NFT representing a junior pool position", async () => {
      const value = usdcVal(1000)
      const nonce = await usdc.nonces(owner)
      const deadline = MAX_UINT

      // Create signature for permit
      const digest = await getApprovalDigest({
        token: usdc,
        owner: owner,
        spender: transferRestrictedVault.address,
        value,
        nonce,
        deadline,
      })
      const wallet = await getWallet(owner)
      assertNonNullable(wallet)
      const {v, r, s} = ecsign(Buffer.from(digest.slice(2), "hex"), Buffer.from(wallet.privateKey.slice(2), "hex"))

      const receipt = await transferRestrictedVault.depositJuniorWithPermit(
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

      const vaultMintEvent = getFirstLog(decodeLogs(receipt.receipt.rawLogs, transferRestrictedVault, "Transfer"))
      const poolTokenMintEvent = getFirstLog(decodeLogs(receipt.receipt.rawLogs, poolTokens, "TokenMinted"))

      expect(vaultMintEvent.args.from).to.equal(ZERO_ADDRESS)
      expect(vaultMintEvent.args.to).to.equal(owner)

      expect(poolTokenMintEvent.args.owner).to.equal(transferRestrictedVault.address)
      expect(poolTokenMintEvent.args.pool).to.equal(tranchedPool.address)
      expect(poolTokenMintEvent.args.amount).to.bignumber.equal(usdcVal(1000))

      const tokenId = vaultMintEvent.args.tokenId
      const poolTokenId = poolTokenMintEvent.args.tokenId
      const juniorPosition = await transferRestrictedVault.poolTokenPositions(tokenId)

      const currentTime = await time.latest()
      const expectedLockedUntil = currentTime.add(new BN(365).mul(SECONDS_PER_DAY))

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
      const receipt = await transferRestrictedVault.depositSenior(usdcVal(1000))
      const vaultMintEvent = getFirstLog(decodeLogs(receipt.receipt.rawLogs, transferRestrictedVault, "Transfer"))
      const seniorPoolDepositEvent = getFirstLog(decodeLogs(receipt.receipt.rawLogs, seniorPool, "DepositMade"))

      expect(vaultMintEvent.args.from).to.equal(ZERO_ADDRESS)
      expect(vaultMintEvent.args.to).to.equal(owner)

      expect(seniorPoolDepositEvent.args.capitalProvider).to.equal(transferRestrictedVault.address)
      expect(seniorPoolDepositEvent.args.amount).to.bignumber.equal(usdcVal(1000))

      const tokenId = vaultMintEvent.args.tokenId
      const shares = seniorPoolDepositEvent.args.shares
      const position = await transferRestrictedVault.fiduPositions(tokenId)

      const currentTime = await time.latest()
      const expectedLockedUntil = currentTime.add(new BN(365).mul(SECONDS_PER_DAY))

      expect(await transferRestrictedVault.ownerOf(tokenId)).to.equal(owner)
      expect(await fidu.balanceOf(transferRestrictedVault.address)).to.bignumber.equal(shares)
      expect(position.amount).to.bignumber.equal(shares)
      expect(position.lockedUntil).to.bignumber.equal(expectedLockedUntil)
    })
  })

  describe("depositSeniorWithPermit", async () => {
    it("mints an NFT representing a senior pool position", async () => {
      const value = usdcVal(1000)
      const nonce = await usdc.nonces(owner)
      const deadline = MAX_UINT

      // Create signature for permit
      const digest = await getApprovalDigest({
        token: usdc,
        owner: owner,
        spender: transferRestrictedVault.address,
        value,
        nonce,
        deadline,
      })
      const wallet = await getWallet(owner)
      assertNonNullable(wallet)
      const {v, r, s} = ecsign(Buffer.from(digest.slice(2), "hex"), Buffer.from(wallet.privateKey.slice(2), "hex"))

      const receipt = await transferRestrictedVault.depositSeniorWithPermit(value, deadline, v, r, s, {
        from: owner,
      })

      const vaultMintEvent = getFirstLog(decodeLogs(receipt.receipt.rawLogs, transferRestrictedVault, "Transfer"))
      const seniorPoolDepositEvent = getFirstLog(decodeLogs(receipt.receipt.rawLogs, seniorPool, "DepositMade"))

      expect(vaultMintEvent.args.from).to.equal(ZERO_ADDRESS)
      expect(vaultMintEvent.args.to).to.equal(owner)

      expect(seniorPoolDepositEvent.args.capitalProvider).to.equal(transferRestrictedVault.address)
      expect(seniorPoolDepositEvent.args.amount).to.bignumber.equal(usdcVal(1000))

      const tokenId = vaultMintEvent.args.tokenId
      const shares = seniorPoolDepositEvent.args.shares
      const position = await transferRestrictedVault.fiduPositions(tokenId)

      const currentTime = await time.latest()
      const expectedLockedUntil = currentTime.add(new BN(365).mul(SECONDS_PER_DAY))

      expect(await transferRestrictedVault.ownerOf(tokenId)).to.equal(owner)
      expect(await fidu.balanceOf(transferRestrictedVault.address)).to.bignumber.equal(shares)
      expect(position.amount).to.bignumber.equal(shares)
      expect(position.lockedUntil).to.bignumber.equal(expectedLockedUntil)
    })
  })

  describe("withdrawSenior", async () => {
    let tokenId
    const amount = usdcVal(1000)

    beforeEach(async () => {
      await erc20Approve(usdc, transferRestrictedVault.address, usdcVal(10000), [otherPerson])
      await transferRestrictedVault.depositSenior(usdcVal(10000), {from: otherPerson})

      await erc20Approve(usdc, transferRestrictedVault.address, usdcVal(100000), [owner])
      const receipt = await transferRestrictedVault.depositSenior(amount)
      tokenId = getFirstLog(decodeLogs(receipt.receipt.rawLogs, transferRestrictedVault, "Transfer")).args.tokenId
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
        const receipt = await transferRestrictedVault.depositJunior(tranchedPool.address, amount)
        tokenId = getFirstLog(decodeLogs(receipt.receipt.rawLogs, transferRestrictedVault, "Transfer")).args.tokenId
      })

      it("reverts", async () => {
        await expect(transferRestrictedVault.withdrawSenior(tokenId, amount)).to.be.rejectedWith(/Not enough Fidu/)
      })
    })

    it("withdraws USDC", async () => {
      const position = await transferRestrictedVault.fiduPositions(tokenId)
      const withdrawalFee = amount.div(WITHDRAWL_FEE_DENOMINATOR)
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
    const amount = usdcVal(1000)

    beforeEach(async () => {
      await erc20Approve(usdc, transferRestrictedVault.address, usdcVal(10000), [otherPerson])
      await transferRestrictedVault.depositSenior(usdcVal(10000), {from: otherPerson})

      await erc20Approve(usdc, transferRestrictedVault.address, usdcVal(100000), [owner])
      const receipt = await transferRestrictedVault.depositSenior(amount)
      tokenId = getFirstLog(decodeLogs(receipt.receipt.rawLogs, transferRestrictedVault, "Transfer")).args.tokenId
      const position = await transferRestrictedVault.fiduPositions(tokenId)
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
        const receipt = await transferRestrictedVault.depositJunior(tranchedPool.address, amount)
        tokenId = getFirstLog(decodeLogs(receipt.receipt.rawLogs, transferRestrictedVault, "Transfer")).args.tokenId
      })

      it("reverts", async () => {
        await expect(transferRestrictedVault.withdrawSeniorInFidu(tokenId, shares)).to.be.rejectedWith(
          /Not enough Fidu/
        )
      })
    })

    it("withdraws USDC", async () => {
      const withdrawalFee = amount.div(WITHDRAWL_FEE_DENOMINATOR)
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
    const amount = usdcVal(1000)

    beforeEach(async () => {
      await erc20Approve(usdc, transferRestrictedVault.address, usdcVal(100000), [owner])
      const receipt = await transferRestrictedVault.depositJunior(tranchedPool.address, amount)
      tokenId = getFirstLog(decodeLogs(receipt.receipt.rawLogs, transferRestrictedVault, "Transfer")).args.tokenId
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
        const receipt = await transferRestrictedVault.depositSenior(amount)
        tokenId = getFirstLog(decodeLogs(receipt.receipt.rawLogs, transferRestrictedVault, "Transfer")).args.tokenId
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
      const receipt = await transferRestrictedVault.depositJunior(tranchedPool.address, usdcVal(1000))
      const tokenId = getFirstLog(decodeLogs(receipt.receipt.rawLogs, transferRestrictedVault, "Transfer")).args.tokenId

      await transferRestrictedVault.approve(otherPerson, tokenId)
      await expect(transferRestrictedVault.transferFrom(owner, otherPerson, tokenId)).to.be.rejectedWith(
        /tokens cannot be transferred/
      )
    })
  })
  describe("safeTransferFrom", async () => {
    it("reverts", async () => {
      await erc20Approve(usdc, transferRestrictedVault.address, usdcVal(100000), [owner])
      const receipt = await transferRestrictedVault.depositJunior(tranchedPool.address, usdcVal(1000))
      const tokenId = getFirstLog(decodeLogs(receipt.receipt.rawLogs, transferRestrictedVault, "Transfer")).args.tokenId

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
      const receipt1 = await transferRestrictedVault.depositJunior(tranchedPool.address, usdcVal(1000))
      tokenId1 = getFirstLog(decodeLogs(receipt1.receipt.rawLogs, transferRestrictedVault, "Transfer")).args.tokenId
      const receipt2 = await transferRestrictedVault.depositSenior(usdcVal(500))
      tokenId2 = getFirstLog(decodeLogs(receipt2.receipt.rawLogs, transferRestrictedVault, "Transfer")).args.tokenId
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
        await advanceTime({days: 365})
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
        const juniorPosition = await transferRestrictedVault.poolTokenPositions(tokenId1)
        await transferRestrictedVault.transferPosition(tokenId1, owner)
        expect(await poolTokens.ownerOf(juniorPosition.tokenId)).to.equal(owner)

        // Fidu position has been transferred
        const shares = await fidu.balanceOf(transferRestrictedVault.address)
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
