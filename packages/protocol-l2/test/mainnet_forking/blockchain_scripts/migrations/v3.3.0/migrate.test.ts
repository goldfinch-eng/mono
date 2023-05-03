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
} from "@goldfinch-eng/protocol/typechain/truffle"
const Borrower = artifacts.require("Borrower")
import {
  MAINNET_GOVERNANCE_MULTISIG,
  MAINNET_WARBLER_LABS_MULTISIG,
} from "@goldfinch-eng/protocol/blockchain_scripts/mainnetForkingHelpers"
import {
  advanceTime,
  getCurrentTimestamp,
  getTruffleContractAtAddress,
  usdcVal,
} from "@goldfinch-eng/protocol/test/testHelpers"
import {NON_US_UID_TYPES, assertNonNullable} from "@goldfinch-eng/utils"
import {BorrowerCreated} from "@goldfinch-eng/protocol/typechain/truffle/contracts/protocol/core/GoldfinchFactory"
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

const setupTest = deployments.createFixture(async () => {
  await deployments.fixture("pendingMainnetMigrations", {keepExistingDeployments: true})

  await fundWithWhales(["USDC"], [await getProtocolOwner()])
  await fundWithWhales(["GFI"], [await getProtocolOwner()])

  return {
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

  beforeEach(async () => {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;({usdc, gfFactory, uniqueIdentity, membershipOrchestrator, poolTokens, gfi} = await setupTest())
    allSigners = await hre.ethers.getSigners()
    signer = (await allSigners[0]?.getAddress()) as string
    defaultLenderAddress = (await allSigners[1]?.getAddress()) as string
    lenders = allSigners.slice(2, 5).map((signer) => signer.address) as typeof lenders

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
    let originalPoolTokenId: string

    beforeEach(async () => {
      await makeDeposit({depositAmount: usdcVal(FAZZ_DEAL_LIMIT_IN_DOLLARS).div(new BN(20))})
      originalPoolTokenId = (
        await poolTokens.tokenOfOwnerByIndex(
          defaultLenderAddress,
          (await poolTokens.balanceOf(defaultLenderAddress)).sub(new BN(1))
        )
      ).toString()
    })

    it("allows uncalled tokens in membership", async () => {
      const gfiDepositAmount = 10000
      await gfi.approve(membershipOrchestrator.address, String(gfiDepositAmount), {from: defaultLenderAddress})
      await poolTokens.approve(membershipOrchestrator.address, originalPoolTokenId, {from: defaultLenderAddress})

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
        {from: defaultLenderAddress}
      )

      const scores = await membershipOrchestrator.memberScoreOf(defaultLenderAddress)
      expect(scores[1]).to.equal(new BN(31622776601683))

      const capital = await membershipOrchestrator.totalCapitalHeldBy(defaultLenderAddress)
      const depositAmount = (await callableLoanInstance.limit()).div(new BN(20))
      expect(capital[1]).to.equal(depositAmount)
    })

    it("does not allow called tokens in membership", async () => {
      // TODO - When drawdowns are enabled, uncomment the remainder of this method

      const gfiDepositAmount = 10000
      const callAmount = 10000000

      await gfi.approve(membershipOrchestrator.address, String(gfiDepositAmount), {from: defaultLenderAddress})
      await poolTokens.approve(membershipOrchestrator.address, originalPoolTokenId, {from: defaultLenderAddress})

      await expect(
        borrowerContract.drawdown(callableLoanInstance.address, usdcVal(100_000), FAZZ_MAINNET_EOA, {
          from: FAZZ_MAINNET_EOA,
        })
      ).to.be.rejectedWith(/CannotDrawdownWhenDrawdownsPaused/)
      await advanceTime({days: 30})
      /*const callResult = */
      await expect(
        callableLoanInstance.submitCall(new BN(callAmount), originalPoolTokenId, {
          from: defaultLenderAddress,
        })
      ).to.be.rejectedWith(/RequiresUpgrade/)

      // const callEvent = decodeAndGetFirstLog<CallRequestSubmitted>(
      //   callResult.receipt.rawLogs,
      //   callableLoanInstance,
      //   "CallRequestSubmitted"
      // )

      // // can't submit old pool token anymore
      // await expect(
      //   membershipOrchestrator.deposit(
      //     {
      //       gfi: String(gfiDepositAmount),
      //       capitalDeposits: [
      //         {
      //           assetAddress: poolTokens.address,
      //           id: originalPoolTokenId,
      //         },
      //       ],
      //     },
      //     {from: defaultLenderAddress}
      //   )
      // ).to.be.rejectedWith(/nonexistent token/)

      // // can't submit called pool token
      // await poolTokens.approve(membershipOrchestrator.address, callEvent.args.callRequestedTokenId, {
      //   from: defaultLenderAddress,
      // })
      // await expect(
      //   membershipOrchestrator.deposit(
      //     {
      //       gfi: String(gfiDepositAmount),
      //       capitalDeposits: [
      //         {
      //           assetAddress: poolTokens.address,
      //           id: callEvent.args.callRequestedTokenId,
      //         },
      //       ],
      //     },
      //     {from: defaultLenderAddress}
      //   )
      // ).to.be.rejectedWith(/InvalidAssetWithId/)

      // // can submit new uncalled pool token
      // await poolTokens.approve(membershipOrchestrator.address, callEvent.args.remainingTokenId, {
      //   from: defaultLenderAddress,
      // })
      // await expect(
      //   membershipOrchestrator.deposit(
      //     {
      //       gfi: String(gfiDepositAmount),
      //       capitalDeposits: [
      //         {
      //           assetAddress: poolTokens.address,
      //           id: callEvent.args.remainingTokenId,
      //         },
      //       ],
      //     },
      //     {from: defaultLenderAddress}
      //   )
      // ).to.not.be.rejected

      // const capital = await membershipOrchestrator.totalCapitalHeldBy(defaultLenderAddress)
      // const depositAmount = (await callableLoanInstance.limit()).div(new BN(20))
      // expect(capital[1]).to.equal(depositAmount.sub(new BN(callAmount)))
    })
  })

  describe("Lender", async () => {
    let originalPoolTokenId: string

    context("with a generic deposit", async () => {
      beforeEach(async () => {
        await makeDeposit({depositAmount: usdcVal(FAZZ_DEAL_LIMIT_IN_DOLLARS).div(new BN(20))})
        originalPoolTokenId = (
          await poolTokens.tokenOfOwnerByIndex(
            defaultLenderAddress,
            (await poolTokens.balanceOf(defaultLenderAddress)).sub(new BN(1))
          )
        ).toString()
      })

      it("can withdraw before drawdown", async () => {
        const previousBalance = await usdc.balanceOf(defaultLenderAddress)

        await expect(callableLoanInstance.withdraw(originalPoolTokenId, usdcVal(1000), {from: defaultLenderAddress})).to
          .not.be.rejected

        expect(await usdc.balanceOf(defaultLenderAddress)).to.equal(previousBalance.add(usdcVal(1000)))
      })

      it("can (not) submit a call request", async () => {
        // TODO - When drawdowns are enabled:
        // 1. change `rejectedWith` to `not.be.rejected`
        // 2. remove the (not) in the title of this function
        // 3. Add expectation for changes related to submitting a call

        await expect(
          callableLoanInstance.submitCall(1000, originalPoolTokenId, {
            from: FAZZ_MAINNET_EOA,
          })
        ).to.be.rejectedWith(/RequiresUpgrade/)
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

    it("can initially not successfully drawdown and transfer funds to the borrower address, but it can after warbler gov unpauses drawdowns", async () => {
      // TODO - When drawdowns are unpaused:
      // 1. Remove unpausing drawdowns and drawdown failures
      await makeDeposit({depositAmount: usdcVal(FAZZ_DEAL_LIMIT_IN_DOLLARS).div(new BN(20))})

      const previousBorrowerBalance = await usdc.balanceOf(FAZZ_MAINNET_EOA)
      const previousLoanBalance = await usdc.balanceOf(callableLoanInstance.address)

      await expect(
        borrowerContract.drawdown(callableLoanInstance.address, usdcVal(100), FAZZ_MAINNET_EOA, {
          from: FAZZ_MAINNET_EOA,
        })
      ).to.be.rejectedWith(/CannotDrawdownWhenDrawdownsPaused/)

      expect(await usdc.balanceOf(FAZZ_MAINNET_EOA)).to.equal(previousBorrowerBalance) // .add(usdcVal(100)))
      expect(await usdc.balanceOf(callableLoanInstance.address)).to.equal(previousLoanBalance) // .sub(usdcVal(100)))

      await expect(callableLoanInstance.unpauseDrawdowns({from: FAZZ_MAINNET_EOA})).to.be.rejected
      await expect(callableLoanInstance.unpauseDrawdowns({from: MAINNET_GOVERNANCE_MULTISIG}))

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

    it("can (not) successfully pay on behalf of the borrower using the pay function", async () => {
      // TODO - When drawdowns are enabled:
      // 1. uncomment the expectations
      // 2. change `rejectedWith` to `not.be.rejected`
      // 3. remove the (not) in the title of this function
      await makeDeposit({depositAmount: usdcVal(FAZZ_DEAL_LIMIT_IN_DOLLARS).div(new BN(20))})
      await expect(
        borrowerContract.drawdown(callableLoanInstance.address, usdcVal(100_000), FAZZ_MAINNET_EOA, {
          from: FAZZ_MAINNET_EOA,
        })
      ).to.be.rejectedWith(/CannotDrawdownWhenDrawdownsPaused/)

      await advanceTime({days: 90})

      const previousBorrowerBalance = await usdc.balanceOf(FAZZ_MAINNET_EOA)
      const previousLoanBalance = await usdc.balanceOf(callableLoanInstance.address)

      await usdc.approve(borrowerContract.address, usdcVal(100), {from: FAZZ_MAINNET_EOA})

      // Assumes a 10% reserve fee and assumes a $100 interest payment.
      await expect(
        borrowerContract.methods["pay(address,uint256)"](callableLoanInstance.address, usdcVal(100), {
          from: FAZZ_MAINNET_EOA,
        })
      ).to.be.rejectedWith(/RequiresUpgrade/)

      expect(await usdc.balanceOf(FAZZ_MAINNET_EOA)).to.equal(previousBorrowerBalance) // .sub(usdcVal(100)))
      expect(await usdc.balanceOf(callableLoanInstance.address)).to.equal(previousLoanBalance) // .add(usdcVal(90)))
    })

    it("throws an error if anyone but the borrower attempts to call any of the functions", async () => {
      for (let i = 3; i < 10; i++) {
        const randoUser = (await allSigners[i]?.getAddress()) as string
        await impersonateAccount(hre, randoUser)
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
        await expect(callableLoanInstance.drawdown(usdcVal(100), {from: randoUser})).to.eventually.be.rejectedWith(
          `RequiresLockerRole("${randoUser}")`
        )
        await expect(callableLoanInstance.setAllowedUIDTypes([1], {from: randoUser})).to.eventually.be.rejectedWith(
          `RequiresLockerRole("${randoUser}")`
        )
        await expect(callableLoanInstance.setFundableAt(0, {from: randoUser})).to.eventually.be.rejectedWith(
          `RequiresLockerRole("${randoUser}")`
        )
      }
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

  async function createBorrowerContract(borrowerAddress: string) {
    const result = await gfFactory.createBorrower(borrowerAddress)
    assertNonNullable(result)
    const bwrConAddr = (result.logs[result.logs.length - 1] as unknown as BorrowerCreated).args.borrower
    const bwrCon = await Borrower.at(bwrConAddr)
    return bwrCon
  }
})
