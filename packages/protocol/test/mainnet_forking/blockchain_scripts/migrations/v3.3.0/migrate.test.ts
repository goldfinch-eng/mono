import BN from "bn.js"
import {fundWithWhales} from "@goldfinch-eng/protocol/blockchain_scripts/helpers/fundWithWhales"
import {deployments} from "hardhat"
import {
  LOCKER_ROLE,
  SIGNER_ROLE,
  getProtocolOwner,
  getTruffleContract,
} from "packages/protocol/blockchain_scripts/deployHelpers"
import {TEST_TIMEOUT} from "../../../MainnetForking.test"
import {
  BorrowerInstance,
  GoldfinchFactoryInstance,
  ERC20Instance,
  CallableLoanInstance,
  UniqueIdentityInstance,
  MembershipOrchestratorInstance,
  PoolTokensInstance,
  GFIInstance,
  GoldfinchConfigInstance,
} from "@goldfinch-eng/protocol/typechain/truffle"
import {MAINNET_WARBLER_LABS_MULTISIG} from "@goldfinch-eng/protocol/blockchain_scripts/mainnetForkingHelpers"
import {
  advanceAndMineBlock,
  advanceTime,
  decodeAndGetFirstLog,
  getCurrentTimestamp,
  getTruffleContractAtAddress,
  usdcVal,
} from "@goldfinch-eng/protocol/test/testHelpers"
import {NON_US_UID_TYPES} from "@goldfinch-eng/utils"
import {getERC20Address, MAINNET_CHAIN_ID} from "@goldfinch-eng/protocol/blockchain_scripts/deployHelpers"
import {
  FAZZ_DEAL_FUNDABLE_AT,
  FAZZ_DEAL_LIMIT_IN_DOLLARS,
  FAZZ_DEAL_UNCALLED_CAPITAL_TRANCHE,
  FAZZ_MAINNET_BORROWER_CONTRACT_ADDRESS,
  FAZZ_MAINNET_CALLABLE_LOAN,
  FAZZ_MAINNET_EOA,
} from "@goldfinch-eng/protocol/blockchain_scripts/helpers/createCallableLoanForBorrower"
import hre from "hardhat"
import {impersonateAccount} from "@goldfinch-eng/protocol/blockchain_scripts/helpers/impersonateAccount"
import {mintUidIfNotMinted} from "@goldfinch-eng/protocol/test/util/uniqueIdentity"
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers"
import {EXISTING_POOL_TO_TOKEN} from "@goldfinch-eng/protocol/test/util/tranchedPool"
import {CallRequestSubmitted} from "@goldfinch-eng/protocol/typechain/truffle/contracts/protocol/core/callable/CallableLoan"
import {CONFIG_KEYS} from "@goldfinch-eng/protocol/blockchain_scripts/configKeys"

// https://etherscan.io/tx/0x18de9f70e363ffeb11e17aebfe283c552dc1bb08e79f668f262d4e19fdf7327b
const EXAMPLE_FAZZ_POOL_TOKEN = 946
const EXAMPLE_FAZZ_POOL_TOKEN_OWNER = "0xc0d67e9ab24e98e84d3efc150ae14c5754db33d4"

// Only makes sense in CI where test pollution occurs.
// Otherwise, we should be able to consistently advanceTime from the mainnet forked block
const EXAMPLE_CALL_SUBMISSION_TIMESTAMP = 1692146432 // Wed Aug 16 2023 00:40:32 GMT+0000

// Empty bytes padding the rest of a word after filling the 4 bytes of an error selector
const ERROR_SELECTOR_BUFFER = "000000000000000000000000"
const UNKNOWN_CUSTOM_ERROR_PREFIX =
  "VM Exception while processing transaction: reverted with an unrecognized custom error (return data: "
const setupTest = deployments.createFixture(async () => {
  await deployments.fixture("pendingMainnetMigrations", {keepExistingDeployments: true})

  await fundWithWhales(["USDC"], [await getProtocolOwner()])
  await fundWithWhales(["GFI"], [await getProtocolOwner()])

  return {
    gfConfig: await getTruffleContract<GoldfinchConfigInstance>("GoldfinchConfig"),
    uniqueIdentity: await getTruffleContract<UniqueIdentityInstance>("UniqueIdentity"),
    gfFactory: await getTruffleContract<GoldfinchFactoryInstance>("GoldfinchFactory"),
    membershipOrchestrator: await getTruffleContract<MembershipOrchestratorInstance>("MembershipOrchestrator"),
    poolTokens: await getTruffleContract<PoolTokensInstance>("PoolTokens"),
    gfi: await getTruffleContract<GFIInstance>("GFI"),
    usdc: await getTruffleContract<ERC20Instance>("ERC20", {at: getERC20Address("USDC", MAINNET_CHAIN_ID)}),
  }
})

describe("v3.3.0", async function () {
  this.timeout(TEST_TIMEOUT)

  let usdc: ERC20Instance
  let gfConfig: GoldfinchConfigInstance
  let gfFactory: GoldfinchFactoryInstance
  let membershipOrchestrator: MembershipOrchestratorInstance
  let poolTokens: PoolTokensInstance
  let gfi: GFIInstance
  let uniqueIdentity: UniqueIdentityInstance
  let defaultLenderAddress: string
  let borrowerContract: BorrowerInstance
  let callableLoanInstance: CallableLoanInstance
  let allSigners: SignerWithAddress[]
  let lenders: [string, string, string]
  let signer: string
  let requiresLockerRoleSelector: string

  beforeEach(async () => {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;({usdc, gfFactory, gfConfig, uniqueIdentity, membershipOrchestrator, poolTokens, gfi} = await setupTest())
    allSigners = await hre.ethers.getSigners()
    signer = (await allSigners[0]?.getAddress()) as string
    defaultLenderAddress = (await allSigners[1]?.getAddress()) as string
    lenders = allSigners.slice(2, 5).map((signer) => signer.address) as typeof lenders
    const utils = hre.ethers.utils
    requiresLockerRoleSelector = utils.hexDataSlice(
      utils.keccak256(utils.toUtf8Bytes("RequiresLockerRole(address)")),
      0,
      4
    )
    await fundWithWhales(["USDC"], [FAZZ_MAINNET_EOA])
    await fundWithWhales(["GFI", "USDC", "ETH"], [defaultLenderAddress, MAINNET_WARBLER_LABS_MULTISIG, ...lenders])
    await gfFactory.grantRole(await gfFactory.BORROWER_ROLE(), FAZZ_MAINNET_EOA)
    borrowerContract = await getTruffleContractAtAddress<BorrowerInstance>(
      "Borrower",
      FAZZ_MAINNET_BORROWER_CONTRACT_ADDRESS
    )
    await impersonateAccount(hre, MAINNET_WARBLER_LABS_MULTISIG)
    await uniqueIdentity.grantRole(SIGNER_ROLE, signer, {from: MAINNET_WARBLER_LABS_MULTISIG})
    await mintUidIfNotMinted(hre, new BN(NON_US_UID_TYPES[0] as number), uniqueIdentity, defaultLenderAddress, signer)
    await mintUidIfNotMinted(hre, new BN(NON_US_UID_TYPES[0] as number), uniqueIdentity, lenders[0], signer)
    await mintUidIfNotMinted(hre, new BN(NON_US_UID_TYPES[0] as number), uniqueIdentity, lenders[1], signer)
    await mintUidIfNotMinted(hre, new BN(NON_US_UID_TYPES[0] as number), uniqueIdentity, lenders[2], signer)

    callableLoanInstance = await getTruffleContractAtAddress<CallableLoanInstance>(
      "CallableLoan",
      FAZZ_MAINNET_CALLABLE_LOAN
    )

    // Add Fazz signer for rest of tests
    await impersonateAccount(hre, FAZZ_MAINNET_EOA)
  })

  describe("GoldfinchFactory", async () => {
    it("has granted the borrower role to '0x229Db88850B319BD4cA751490F3176F511823372'", async () => {
      const borrowerRole = await gfFactory.BORROWER_ROLE()
      await expect(MAINNET_WARBLER_LABS_MULTISIG).to.eq("0x229Db88850B319BD4cA751490F3176F511823372")
      await expect(gfFactory.hasRole(borrowerRole, "0x229Db88850B319BD4cA751490F3176F511823372")).to.eventually.be.true
    })
  })

  describe("Membership", async () => {
    const lenderAddress = "0x4E93750897c19c738031B4ab2458c2c21801899c"
    const originalPoolTokenId = "934" // https://etherscan.io/tx/0x808451d68ba3fdc60cacae9ef6e34f667aff22704e32cacfadd6d9898bca0767
    const gfiDepositAmount = 10000

    this.beforeEach(async () => {
      await impersonateAccount(hre, lenderAddress)
      await gfi.setCap((await gfi.cap()).add(new BN(gfiDepositAmount)))
      await gfi.mint(lenderAddress, gfiDepositAmount)
    })

    it("allows uncalled tokens in membership", async () => {
      await gfi.approve(membershipOrchestrator.address, String(gfiDepositAmount), {from: lenderAddress})
      await poolTokens.approve(membershipOrchestrator.address, originalPoolTokenId, {from: lenderAddress})

      await membershipOrchestrator.deposit(
        {
          gfi: String(gfiDepositAmount),
          capitalDeposits: [
            {
              assetAddress: poolTokens.address,
              id: originalPoolTokenId,
            },
          ],
        },
        {from: lenderAddress}
      )
    })

    it("does not allow called tokens in membership", async () => {
      const callAmount = new BN(10000000) // 10 dollars

      await gfi.approve(membershipOrchestrator.address, String(gfiDepositAmount), {from: lenderAddress})
      await poolTokens.approve(membershipOrchestrator.address, originalPoolTokenId, {from: lenderAddress})

      await hre.ethers.provider.send("evm_setNextBlockTimestamp", [EXAMPLE_CALL_SUBMISSION_TIMESTAMP])

      const callResult = await callableLoanInstance.submitCall(callAmount, originalPoolTokenId, {
        from: lenderAddress,
      })

      const callEvent = decodeAndGetFirstLog<CallRequestSubmitted>(
        callResult.receipt.rawLogs,
        callableLoanInstance,
        "CallRequestSubmitted"
      )

      // can't submit old pool token anymore
      await expect(
        membershipOrchestrator.deposit(
          {
            gfi: String(gfiDepositAmount),
            capitalDeposits: [
              {
                assetAddress: poolTokens.address,
                id: originalPoolTokenId,
              },
            ],
          },
          {from: lenderAddress}
        )
      ).to.be.rejectedWith(/nonexistent token/)

      // can't submit called pool token
      await poolTokens.approve(membershipOrchestrator.address, callEvent.args.callRequestedTokenId, {
        from: lenderAddress,
      })
      await expect(
        membershipOrchestrator.deposit(
          {
            gfi: String(gfiDepositAmount),
            capitalDeposits: [
              {
                assetAddress: poolTokens.address,
                id: callEvent.args.callRequestedTokenId,
              },
            ],
          },
          {from: lenderAddress}
        )
        // Hardhat doesn't recognize the custom error
      ).to.be.rejected

      // can submit new uncalled pool token
      await poolTokens.approve(membershipOrchestrator.address, callEvent.args.remainingTokenId, {
        from: lenderAddress,
      })
      await membershipOrchestrator.deposit(
        {
          gfi: String(gfiDepositAmount),
          capitalDeposits: [
            {
              assetAddress: poolTokens.address,
              id: callEvent.args.remainingTokenId,
            },
          ],
        },
        {from: lenderAddress}
      )

      // console.log("XXX1", await poolTokens.tokens(callEvent.args.remainingTokenId))
      // console.log("XXX2", (await poolTokens.tokens(callEvent.args.remainingTokenId))[2].toString())
      // console.log("XXX3", (await poolTokens.tokens(callEvent.args.remainingTokenId))[3].toString())
      // const expectedRemainingTokenAmount = depositAmount.sub(callAmount)
      // const capital = await membershipOrchestrator.totalCapitalHeldBy(defaultLenderAddress)
      // console.log("YYY", capital[1].toString())
      // expect(capital[1]).to.equal(expectedRemainingTokenAmount)
    })
  })

  describe("Lender", async () => {
    it("can submit a call request", async () => {
      await hre.ethers.provider.send("evm_setNextBlockTimestamp", [EXAMPLE_CALL_SUBMISSION_TIMESTAMP])

      await fundWithWhales(["ETH"], [EXAMPLE_FAZZ_POOL_TOKEN_OWNER])
      await impersonateAccount(hre, EXAMPLE_FAZZ_POOL_TOKEN_OWNER)
      await callableLoanInstance.submitCall(1000, EXAMPLE_FAZZ_POOL_TOKEN, {
        from: EXAMPLE_FAZZ_POOL_TOKEN_OWNER,
      })
    })
    /**
    TODO: Reintroduce these tests for a generic callable loan. They are currently failing
          because the Fazz callable loan is past the funding phase.
    context("with a generic deposit", async () => {
      beforeEach(async () => {
        await makeDeposit({
          depositAmount,
          lender: defaultLenderAddress,
        })
        originalPoolTokenId = (
          await poolTokens.tokenOfOwnerByIndex(
            defaultLenderAddress,
            (await poolTokens.balanceOf(defaultLenderAddress)).sub(new BN(1))
          )
        ).toString()

        await borrowerContract.drawdown(callableLoanInstance.address, depositAmount.div(new BN(10)), FAZZ_MAINNET_EOA, {
          from: FAZZ_MAINNET_EOA,
        })

        // Advance past the drawdown locking period
        await advanceAndMineBlock({days: 120})
      })

      it("can submit a call request", async () => {
        await callableLoanInstance.submitCall(1000, originalPoolTokenId, {
          from: defaultLenderAddress,
        })
      })
    })

    it("can support multiple depositors", async () => {
      const previousBalance = await usdc.balanceOf(callableLoanInstance.address)
      console.log("previous balance", previousBalance.toString())
      await makeDeposit({lender: lenders[0], depositAmount: usdcVal(100)})
      expect(await usdc.balanceOf(callableLoanInstance.address)).to.equal(previousBalance.add(usdcVal(100)))
      await makeDeposit({lender: lenders[1], depositAmount: usdcVal(1000)})
      expect(await usdc.balanceOf(callableLoanInstance.address)).to.equal(previousBalance.add(usdcVal(1100)))
      await makeDeposit({lender: lenders[2], depositAmount: usdcVal(10000)})
      expect(await usdc.balanceOf(callableLoanInstance.address)).to.equal(previousBalance.add(usdcVal(11100)))
    })

    it("can support a combination of deposits then withdrawals", async () => {
      const lender0OriginalBalance = await usdc.balanceOf(lenders[0])
      const lender1OriginalBalance = await usdc.balanceOf(lenders[1])
      const lender2OriginalBalance = await usdc.balanceOf(lenders[2])

      // Deposit for lender 0
      await makeDeposit({lender: lenders[0], depositAmount: usdcVal(100)})

      // Withdraw $0.50 USDC lender 0 pool token
      const lender0PoolToken = await poolTokens.tokenOfOwnerByIndex(
        lenders[0],
        (await poolTokens.balanceOf(lenders[0])).sub(new BN(1))
      )
      await expect(callableLoanInstance.withdraw(lender0PoolToken, usdcVal(101), {from: lenders[0]})).to.be.rejected
      await expect(callableLoanInstance.withdraw(lender0PoolToken, usdcVal(50), {from: lenders[0]})).to.not.be.rejected
      expect(await usdc.balanceOf(lenders[0])).to.equal(lender0OriginalBalance.sub(usdcVal(50)))

      // Deposit for lender 1 & 2 back-to-back
      await makeDeposit({lender: lenders[1], depositAmount: usdcVal(1000)})
      await makeDeposit({lender: lenders[2], depositAmount: usdcVal(10000)})

      const lender1PoolToken = await poolTokens.tokenOfOwnerByIndex(
        lenders[1],
        (await poolTokens.balanceOf(lenders[1])).sub(new BN(1))
      )
      await expect(callableLoanInstance.withdraw(lender1PoolToken, usdcVal(1001), {from: lenders[1]})).to.be.rejected
      await expect(callableLoanInstance.withdraw(lender1PoolToken, usdcVal(1000), {from: lenders[1]})).to.not.be
        .rejected
      expect(await usdc.balanceOf(lenders[1])).to.equal(lender1OriginalBalance)

      const lender2PoolToken = await poolTokens.tokenOfOwnerByIndex(
        lenders[2],
        (await poolTokens.balanceOf(lenders[2])).sub(new BN(1))
      )
      await expect(callableLoanInstance.withdraw(lender2PoolToken, usdcVal(10001), {from: lenders[2]})).to.be.rejected
      await expect(callableLoanInstance.withdraw(lender2PoolToken, usdcVal(6000), {from: lenders[2]})).to.not.be
        .rejected
      expect(await usdc.balanceOf(lenders[2])).to.equal(lender2OriginalBalance.sub(usdcVal(4000)))
    })
    it("can withdraw before drawdown", async () => {
      const previousBalance = await usdc.balanceOf(defaultLenderAddress)

      await expect(callableLoanInstance.withdraw(originalPoolTokenId, usdcVal(1000), {from: defaultLenderAddress})).to
        .not.be.rejected

      expect(await usdc.balanceOf(defaultLenderAddress)).to.equal(previousBalance.add(usdcVal(1000)))
    })
     

    it("does not allow someone to withdraw someone elses pool token", async () => {
      // Deposit for lender 0
      await makeDeposit({lender: lenders[0], depositAmount: usdcVal(100)})

      // Deposit for lender 1
      await makeDeposit({lender: lenders[1], depositAmount: usdcVal(1000)})

      const lender0PoolToken = await poolTokens.tokenOfOwnerByIndex(
        lenders[0],
        (await poolTokens.balanceOf(lenders[0])).sub(new BN(1))
      )
      await expect(callableLoanInstance.withdraw(lender0PoolToken, usdcVal(100), {from: lenders[1]})).to.be.rejected
      await expect(callableLoanInstance.withdraw(lender0PoolToken, usdcVal(100), {from: lenders[0]})).to.not.be.rejected
    })*/

    it("does not allow someone to withdraw someone elses pool token", async () => {
      await advanceTime({days: 30})

      await fundWithWhales(["ETH", "USDC"], [EXAMPLE_FAZZ_POOL_TOKEN_OWNER])
      await impersonateAccount(hre, EXAMPLE_FAZZ_POOL_TOKEN_OWNER)
      await usdc.approve(callableLoanInstance.address, usdcVal(1_000), {from: EXAMPLE_FAZZ_POOL_TOKEN_OWNER})
      await callableLoanInstance.methods["pay(uint256)"](usdcVal(1_000), {from: EXAMPLE_FAZZ_POOL_TOKEN_OWNER})

      await advanceTime({days: 90})

      await expect(callableLoanInstance.withdrawMax(EXAMPLE_FAZZ_POOL_TOKEN, {from: lenders[1]})).to.be.rejected
      await expect(callableLoanInstance.withdrawMax(EXAMPLE_FAZZ_POOL_TOKEN, {from: EXAMPLE_FAZZ_POOL_TOKEN_OWNER})).to
        .not.be.rejected
    })

    it("does not allow someone to withdraw any tranched pool token on callable loans", async () => {
      const existingPools = Object.keys(EXISTING_POOL_TO_TOKEN)
      const promises = existingPools.map(async (existingPool) => {
        const examplePoolTokenId = EXISTING_POOL_TO_TOKEN[existingPool]
        const poolTokenOwner = await poolTokens.ownerOf(examplePoolTokenId)

        await impersonateAccount(hre, poolTokenOwner)

        // Pool token owner cannot withdraw
        await expect(callableLoanInstance.withdraw(examplePoolTokenId, 1, {from: poolTokenOwner})).to.be.rejected

        // Arbitrary address cannot withdraw
        await expect(callableLoanInstance.withdraw(examplePoolTokenId, 1, {from: FAZZ_MAINNET_EOA})).to.be.rejected

        try {
          await fundWithWhales(["ETH"], [poolTokenOwner])
        } catch (e) {
          // poolToken owner cannot transfer their asset since they are not a valid
          // ETH recipient (must be a smart contract)
          return
        }

        // Transfer pool token to callable loan
        await poolTokens.transferFrom(poolTokenOwner, callableLoanInstance.address, examplePoolTokenId, {
          from: poolTokenOwner,
        })

        await expect(callableLoanInstance.withdraw(examplePoolTokenId, 1, {from: poolTokenOwner})).to.be.rejected
        await expect(callableLoanInstance.withdraw(examplePoolTokenId, 1, {from: FAZZ_MAINNET_EOA})).to.be.rejected
      })
      await Promise.all(promises)
    })
  })

  describe("Borrower", async () => {
    it("has the locker role", async () => {
      expect(await callableLoanInstance.hasRole(LOCKER_ROLE, borrowerContract.address)).to.be.true
    })
    it("throws an error when attempting to lockJuniorCapital", async () => {
      await expect(
        borrowerContract.lockJuniorCapital(callableLoanInstance.address, {from: FAZZ_MAINNET_EOA})
      ).to.eventually.be.rejectedWith()
    })

    it("throws an error when attempting to lockPool", async () => {
      await expect(
        borrowerContract.lockPool(callableLoanInstance.address, {from: FAZZ_MAINNET_EOA})
      ).to.eventually.be.rejectedWith()
    })

    /*
    TODO: Reintroduce these tests for a generic callable loan. They are currently failing
      because the Fazz callable loan is past the funding phase.
    it("can initially not successfully drawdown and transfer funds to the borrower address, but it can after warbler gov unpauses drawdowns", async () => {
      await makeDeposit({depositAmount: usdcVal(FAZZ_DEAL_LIMIT_IN_DOLLARS).div(new BN(20))})

      const previousBorrowerBalance = await usdc.balanceOf(FAZZ_MAINNET_EOA)
      const previousLoanBalance = await usdc.balanceOf(callableLoanInstance.address)

      expect(await usdc.balanceOf(FAZZ_MAINNET_EOA)).to.equal(previousBorrowerBalance) // .add(usdcVal(100)))
      expect(await usdc.balanceOf(callableLoanInstance.address)).to.equal(previousLoanBalance) // .sub(usdcVal(100)))

      await borrowerContract.drawdown(callableLoanInstance.address, usdcVal(100), FAZZ_MAINNET_EOA, {
        from: FAZZ_MAINNET_EOA,
      })

      expect(await usdc.balanceOf(FAZZ_MAINNET_EOA)).to.equal(previousBorrowerBalance.add(usdcVal(100)))
      expect(await usdc.balanceOf(callableLoanInstance.address)).to.equal(previousLoanBalance.sub(usdcVal(100)))

      await borrowerContract.drawdown(callableLoanInstance.address, usdcVal(200), FAZZ_MAINNET_EOA, {
        from: FAZZ_MAINNET_EOA,
      })

      expect(await usdc.balanceOf(FAZZ_MAINNET_EOA)).to.equal(previousBorrowerBalance.add(usdcVal(300)))
      expect(await usdc.balanceOf(callableLoanInstance.address)).to.equal(previousLoanBalance.sub(usdcVal(300)))

      await borrowerContract.drawdown(callableLoanInstance.address, usdcVal(99700), FAZZ_MAINNET_EOA, {
        from: FAZZ_MAINNET_EOA,
      })

      expect(await usdc.balanceOf(FAZZ_MAINNET_EOA)).to.equal(previousBorrowerBalance.add(usdcVal(100_000)))
      expect(await usdc.balanceOf(callableLoanInstance.address)).to.equal(previousLoanBalance.sub(usdcVal(100_000)))
    })
    */

    it("can successfully pay on behalf of the borrower using the pay function", async () => {
      await advanceTime({days: 90})

      const previousBorrowerBalance = await usdc.balanceOf(FAZZ_MAINNET_EOA)
      const previousLoanBalance = await usdc.balanceOf(callableLoanInstance.address)

      await usdc.approve(borrowerContract.address, usdcVal(100), {from: FAZZ_MAINNET_EOA})

      // Assumes a 10% reserve fee and assumes a $100 interest payment.
      await borrowerContract.methods["pay(address,uint256)"](callableLoanInstance.address, usdcVal(100), {
        from: FAZZ_MAINNET_EOA,
      })

      expect(await usdc.balanceOf(FAZZ_MAINNET_EOA)).to.equal(previousBorrowerBalance.sub(usdcVal(100)))
      expect(await usdc.balanceOf(callableLoanInstance.address)).to.equal(previousLoanBalance.add(usdcVal(90)))
    })

    it("throws an error if anyone but the borrower attempts to call any of the functions", async () => {
      for (let i = 3; i < 10; i++) {
        const randoUser = (await allSigners[i]?.getAddress()) as string
        await impersonateAccount(hre, randoUser)
        const requiresLockerRoleError = unknownCustomError(
          `${requiresLockerRoleSelector}${ERROR_SELECTOR_BUFFER}${randoUser.slice(2).toLowerCase()}`
        )
        await expect(
          borrowerContract.initialize(randoUser, randoUser, {from: randoUser})
        ).to.eventually.be.rejectedWith("Contract instance has already been initialized")
        await expect(
          borrowerContract.lockJuniorCapital(callableLoanInstance.address, {from: randoUser})
        ).to.eventually.be.rejectedWith("Must have admin role to perform this action")
        await expect(
          borrowerContract.lockPool(callableLoanInstance.address, {from: randoUser})
        ).to.eventually.be.rejectedWith("Must have admin role to perform this action")
        await expect(
          borrowerContract.drawdown(callableLoanInstance.address, usdcVal(100), randoUser, {from: randoUser})
        ).to.eventually.be.rejectedWith("Must have admin role to perform this action")
        await expect(
          borrowerContract.drawdown(callableLoanInstance.address, usdcVal(FAZZ_DEAL_LIMIT_IN_DOLLARS), randoUser, {
            from: randoUser,
          })
        ).to.eventually.be.rejectedWith("Must have admin role to perform this action")
        await expect(
          borrowerContract.drawdownWithSwapOnOneInch(
            callableLoanInstance.address,
            usdcVal(FAZZ_DEAL_LIMIT_IN_DOLLARS),
            randoUser,
            usdc.address,
            usdcVal(FAZZ_DEAL_LIMIT_IN_DOLLARS),
            [usdc.address],
            {
              from: randoUser,
            }
          )
        ).to.eventually.be.rejectedWith("Must have admin role to perform this action")
        await expect(
          borrowerContract.transferERC20(usdc.address, randoUser, usdcVal(FAZZ_DEAL_LIMIT_IN_DOLLARS), {
            from: randoUser,
          })
        ).to.eventually.be.rejectedWith("Must have admin role to perform this action")
        await expect(
          borrowerContract.methods["pay(address,uint256)"](randoUser, usdcVal(FAZZ_DEAL_LIMIT_IN_DOLLARS), {
            from: randoUser,
          })
        ).to.eventually.be.rejectedWith("Must have admin role to perform this action")
        await expect(
          borrowerContract.methods["pay(address,uint256,uint256)"](
            randoUser,
            usdcVal(FAZZ_DEAL_LIMIT_IN_DOLLARS),
            usdcVal(FAZZ_DEAL_LIMIT_IN_DOLLARS),
            {
              from: randoUser,
            }
          )
        ).to.eventually.be.rejectedWith("Must have admin role to perform this action")
        await expect(
          borrowerContract.payInFull(randoUser, usdcVal(FAZZ_DEAL_LIMIT_IN_DOLLARS), {from: randoUser})
        ).to.eventually.be.rejectedWith("Must have admin role to perform this action")
        await expect(
          borrowerContract.payWithSwapOnOneInch(
            callableLoanInstance.address,
            usdcVal(FAZZ_DEAL_LIMIT_IN_DOLLARS),
            usdc.address,
            usdcVal(FAZZ_DEAL_LIMIT_IN_DOLLARS),
            [1],
            {
              from: randoUser,
            }
          )
        ).to.eventually.be.rejectedWith("Must have admin role to perform this action")
        await expect(
          borrowerContract.payMultipleWithSwapOnOneInch(
            [],
            [0],
            usdcVal(FAZZ_DEAL_LIMIT_IN_DOLLARS),
            usdc.address,
            [1],
            {
              from: randoUser,
            }
          )
        ).to.eventually.be.rejectedWith("Must have admin role to perform this action")
        await expect(callableLoanInstance.setAllowedUIDTypes([1], {from: randoUser})).to.eventually.be.rejectedWith(
          requiresLockerRoleError
        )
        await expect(callableLoanInstance.setFundableAt(0, {from: randoUser})).to.eventually.be.rejectedWith(
          requiresLockerRoleError
        )
        await expect(callableLoanInstance.drawdown(usdcVal(100), {from: randoUser})).to.eventually.be.rejectedWith(
          requiresLockerRoleError
        )
      }
    })
  })

  describe("Scenario: Borrower pays back loan on correct schedule and lenders can withdraw", async () => {
    it("reserve is paid and lenders can withdraw correct amounts", async () => {
      await hre.ethers.provider.send("evm_setNextBlockTimestamp", [EXAMPLE_CALL_SUBMISSION_TIMESTAMP])

      await fundWithWhales(["ETH", "USDC"], [EXAMPLE_FAZZ_POOL_TOKEN_OWNER, FAZZ_MAINNET_EOA])
      await impersonateAccount(hre, EXAMPLE_FAZZ_POOL_TOKEN_OWNER)

      const reserveAddress = await gfConfig.getAddress(CONFIG_KEYS.TreasuryReserve)
      const previousBorrowerBalance = await usdc.balanceOf(FAZZ_MAINNET_EOA)
      const previousLoanBalance = await usdc.balanceOf(callableLoanInstance.address)
      const previousReserveBalance = await usdc.balanceOf(reserveAddress)
      const reserveFeeNumerator = new BN(90)
      const reserveFeeDenominator = new BN(100)
      const marginOfError = 100

      const callSubmissionAmount = usdcVal(100)

      const callResult = await callableLoanInstance.submitCall(callSubmissionAmount, EXAMPLE_FAZZ_POOL_TOKEN, {
        from: EXAMPLE_FAZZ_POOL_TOKEN_OWNER,
      })

      const callEvent = decodeAndGetFirstLog<CallRequestSubmitted>(
        callResult.receipt.rawLogs,
        callableLoanInstance,
        "CallRequestSubmitted"
      )

      // Assumes a 10% reserve fee and assumes a $100 interest payment.
      let nextDueTime = await callableLoanInstance.nextDueTime()
      let interestOwed = await callableLoanInstance.interestOwedAt(nextDueTime)
      let totalInterestOwed = interestOwed

      await usdc.approve(borrowerContract.address, interestOwed, {from: FAZZ_MAINNET_EOA})
      await borrowerContract.methods["pay(address,uint256)"](callableLoanInstance.address, interestOwed, {
        from: FAZZ_MAINNET_EOA,
      })

      await advanceAndMineBlock({days: 30})
      nextDueTime = await callableLoanInstance.nextDueTime()
      interestOwed = await callableLoanInstance.interestOwedAt(nextDueTime)
      totalInterestOwed = totalInterestOwed.add(interestOwed)

      await usdc.approve(borrowerContract.address, interestOwed, {from: FAZZ_MAINNET_EOA})
      await borrowerContract.methods["pay(address,uint256)"](callableLoanInstance.address, interestOwed, {
        from: FAZZ_MAINNET_EOA,
      })

      await advanceAndMineBlock({days: 30})
      nextDueTime = await callableLoanInstance.nextDueTime()
      interestOwed = await callableLoanInstance.interestOwedAt(nextDueTime)
      totalInterestOwed = totalInterestOwed.add(interestOwed)

      await usdc.approve(borrowerContract.address, interestOwed.add(callSubmissionAmount), {from: FAZZ_MAINNET_EOA})
      await borrowerContract.methods["pay(address,uint256)"](
        callableLoanInstance.address,
        interestOwed.add(callSubmissionAmount),
        {
          from: FAZZ_MAINNET_EOA,
        }
      )

      expect(await usdc.balanceOf(FAZZ_MAINNET_EOA)).to.be.closeTo(
        previousBorrowerBalance.sub(totalInterestOwed.add(usdcVal(100))),
        marginOfError
      )
      expect(await usdc.balanceOf(callableLoanInstance.address)).to.be.closeTo(
        previousLoanBalance.add(
          totalInterestOwed.mul(reserveFeeNumerator).div(reserveFeeDenominator).add(usdcVal(100))
        ),
        marginOfError
      )
      const reserveFee = totalInterestOwed.mul(new BN(100).sub(reserveFeeNumerator)).div(reserveFeeDenominator)
      expect(await usdc.balanceOf(reserveAddress)).to.be.closeTo(previousReserveBalance.add(reserveFee), marginOfError)

      const expectCorrectWithdrawal = async (tokenId) => {
        const availableToWithdrawResult = await callableLoanInstance.availableToWithdraw(tokenId)
        const beforeWithdrawBalance = await usdc.balanceOf(EXAMPLE_FAZZ_POOL_TOKEN_OWNER)
        await callableLoanInstance.withdrawMax(tokenId, {from: EXAMPLE_FAZZ_POOL_TOKEN_OWNER})
        expect(await usdc.balanceOf(EXAMPLE_FAZZ_POOL_TOKEN_OWNER)).to.be.closeTo(
          beforeWithdrawBalance.add(availableToWithdrawResult[0]).add(availableToWithdrawResult[1]),
          marginOfError
        )
      }
      await expectCorrectWithdrawal(callEvent.args.callRequestedTokenId)
      await expectCorrectWithdrawal(callEvent.args.remainingTokenId)
    })
  })

  async function makeDeposit({lender = defaultLenderAddress, depositAmount}: {lender?: string; depositAmount: BN}) {
    const currentTimestamp = await getCurrentTimestamp()
    if (currentTimestamp < new BN(FAZZ_DEAL_FUNDABLE_AT)) {
      await advanceTime({toSecond: new BN(FAZZ_DEAL_FUNDABLE_AT).add(new BN(1))})
    }
    await impersonateAccount(hre, lender)
    await usdc.approve(callableLoanInstance.address, depositAmount, {from: lender})
    await callableLoanInstance.deposit(FAZZ_DEAL_UNCALLED_CAPITAL_TRANCHE, depositAmount, {
      from: lender,
    })
  }

  function unknownCustomError(errorString: string) {
    return `${UNKNOWN_CUSTOM_ERROR_PREFIX}${errorString})`
  }
})
