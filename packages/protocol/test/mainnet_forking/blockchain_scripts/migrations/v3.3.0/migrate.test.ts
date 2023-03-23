import BN from "bn.js"
import {fundWithWhales} from "@goldfinch-eng/protocol/blockchain_scripts/helpers/fundWithWhales"
import {deployments} from "hardhat"
import {SIGNER_ROLE, getProtocolOwner, getTruffleContract} from "packages/protocol/blockchain_scripts/deployHelpers"
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
import {advanceTime, decodeAndGetFirstLog, usdcVal} from "@goldfinch-eng/protocol/test/testHelpers"
import {NON_US_UID_TYPES, assertNonNullable} from "@goldfinch-eng/utils"
import {BorrowerCreated} from "@goldfinch-eng/protocol/typechain/truffle/contracts/protocol/core/GoldfinchFactory"
import {getERC20Address, MAINNET_CHAIN_ID} from "@goldfinch-eng/protocol/blockchain_scripts/deployHelpers"
import {
  createFazzExampleLoan,
  FAZZ_DEAL_FUNDABLE_AT,
  FAZZ_DEAL_LIMIT_IN_DOLLARS,
  FAZZ_DEAL_UNCALLED_CAPITAL_TRANCHE,
  FAZZ_EOA,
} from "@goldfinch-eng/protocol/blockchain_scripts/helpers/createCallableLoanForBorrower"
import {Logger} from "@goldfinch-eng/protocol/blockchain_scripts/types"
import hre from "hardhat"
import {impersonateAccount} from "@goldfinch-eng/protocol/blockchain_scripts/helpers/impersonateAccount"
import {mintUidIfNotMinted} from "@goldfinch-eng/protocol/test/util/uniqueIdentity"
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers"

import {CallRequestSubmitted} from "@goldfinch-eng/protocol/typechain/truffle/contracts/protocol/core/callable/CallableLoan"

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
  let logger: Logger
  let gfFactory: GoldfinchFactoryInstance
  let membershipOrchestrator: MembershipOrchestratorInstance
  let poolTokens: PoolTokensInstance
  let gfi: GFIInstance
  let uniqueIdentity: UniqueIdentityInstance
  let lenderAddress
  let borrowerContract: BorrowerInstance
  let callableLoanInstance: CallableLoanInstance
  let allSigners: SignerWithAddress[]

  beforeEach(async () => {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;({usdc, gfFactory, uniqueIdentity, membershipOrchestrator, poolTokens, gfi} = await setupTest())
    const {
      deployments: {log},
    } = hre
    logger = log
    allSigners = await hre.ethers.getSigners()
    const signer = (await allSigners[0]?.getAddress()) as string
    lenderAddress = (await allSigners[1]?.getAddress()) as string
    await fundWithWhales(["GFI", "USDC", "ETH"], [lenderAddress, MAINNET_WARBLER_LABS_MULTISIG])
    await gfFactory.grantRole(await gfFactory.BORROWER_ROLE(), FAZZ_EOA)
    borrowerContract = await createBorrowerContract(FAZZ_EOA)
    await impersonateAccount(hre, MAINNET_WARBLER_LABS_MULTISIG)
    await uniqueIdentity.grantRole(SIGNER_ROLE, signer, {from: MAINNET_WARBLER_LABS_MULTISIG})
    await mintUidIfNotMinted(hre, new BN(NON_US_UID_TYPES[0] as number), uniqueIdentity, lenderAddress, signer)

    callableLoanInstance = await createFazzExampleLoan({
      hre,
      logger,
      goldfinchFactory: gfFactory,
      callableLoanProxyOwner: MAINNET_WARBLER_LABS_MULTISIG,
      fazzBorrowerContract: borrowerContract.address,
      erc20: usdc,
      txSender: MAINNET_GOVERNANCE_MULTISIG,
    })

    // Add Fazz signer for rest of tests
    await impersonateAccount(hre, FAZZ_EOA)
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
      await makeDeposit()
      originalPoolTokenId = (
        await poolTokens.tokenOfOwnerByIndex(lenderAddress, (await poolTokens.balanceOf(lenderAddress)).sub(new BN(1)))
      ).toString()
    })

    it("allows uncalled tokens in membership", async () => {
      const gfiDepositAmount = 10000
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

      const scores = await membershipOrchestrator.memberScoreOf(lenderAddress)
      expect(scores[1]).to.equal(new BN(31622776601683))

      const capital = await membershipOrchestrator.totalCapitalHeldBy(lenderAddress)
      const depositAmount = (await callableLoanInstance.limit()).div(new BN(20))
      expect(capital[1]).to.equal(depositAmount)
    })

    it("does not allow called tokens in membership", async () => {
      // TODO - When drawdowns are enabled, uncomment the remainder of this method

      const gfiDepositAmount = 10000
      const callAmount = 10000000

      await gfi.approve(membershipOrchestrator.address, String(gfiDepositAmount), {from: lenderAddress})
      await poolTokens.approve(membershipOrchestrator.address, originalPoolTokenId, {from: lenderAddress})

      await expect(
        borrowerContract.drawdown(callableLoanInstance.address, usdcVal(100_000), FAZZ_EOA, {
          from: FAZZ_EOA,
        })
      ).to.be.rejectedWith(/CannotDrawdownWhenDrawdownsPaused/)
      await advanceTime({days: 30})
      /*const callResult = */
      await expect(
        callableLoanInstance.submitCall(new BN(callAmount), originalPoolTokenId, {
          from: lenderAddress,
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
      //     {from: lenderAddress}
      //   )
      // ).to.be.rejectedWith(/nonexistent token/)

      // // can't submit called pool token
      // await poolTokens.approve(membershipOrchestrator.address, callEvent.args.callRequestedTokenId, {
      //   from: lenderAddress,
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
      //     {from: lenderAddress}
      //   )
      // ).to.be.rejectedWith(/InvalidAssetWithId/)

      // // can submit new uncalled pool token
      // await poolTokens.approve(membershipOrchestrator.address, callEvent.args.remainingTokenId, {
      //   from: lenderAddress,
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
      //     {from: lenderAddress}
      //   )
      // ).to.not.be.rejected

      // const capital = await membershipOrchestrator.totalCapitalHeldBy(lenderAddress)
      // const depositAmount = (await callableLoanInstance.limit()).div(new BN(20))
      // expect(capital[1]).to.equal(depositAmount.sub(new BN(callAmount)))
    })
  })

  describe("Lender", async () => {
    let originalPoolTokenId: string

    beforeEach(async () => {
      await makeDeposit()
      originalPoolTokenId = (
        await poolTokens.tokenOfOwnerByIndex(lenderAddress, (await poolTokens.balanceOf(lenderAddress)).sub(new BN(1)))
      ).toString()
    })

    it("can withdraw before drawdown", async () => {
      const previousBalance = await usdc.balanceOf(lenderAddress)

      await expect(callableLoanInstance.withdraw(originalPoolTokenId, usdcVal(1000), {from: lenderAddress})).to.not.be
        .rejected

      expect(await usdc.balanceOf(lenderAddress)).to.equal(previousBalance.add(usdcVal(1000)))
    })

    it("can (not) submit a call request", async () => {
      // TODO - When drawdowns are enabled:
      // 1. change `rejectedWith` to `not.be.rejected`
      // 2. remove the (not) in the title of this function
      // 3. Add expectation for changes related to submitting a call

      await expect(
        callableLoanInstance.submitCall(1000, originalPoolTokenId, {
          from: FAZZ_EOA,
        })
      ).to.be.rejectedWith(/RequiresUpgrade/)
    })
  })

  describe("Borrower", async () => {
    it("throws an error when attempting to lockJuniorCapital", async () => {
      await expect(
        borrowerContract.lockJuniorCapital(callableLoanInstance.address, {from: FAZZ_EOA})
      ).to.eventually.be.rejectedWith()
    })

    it("throws an error when attempting to lockPool", async () => {
      await expect(
        borrowerContract.lockPool(callableLoanInstance.address, {from: FAZZ_EOA})
      ).to.eventually.be.rejectedWith()
    })

    it("can (not) successfully drawdown and transfer funds to the borrower address", async () => {
      // TODO - When drawdowns are enabled:
      // 1. uncomment the expectations
      // 2. change `rejectedWith` to `not.be.rejected`
      // 3. remove the (not) in the title of this function
      await makeDeposit()

      const previousBorrowerBalance = await usdc.balanceOf(FAZZ_EOA)
      const previousLoanBalance = await usdc.balanceOf(callableLoanInstance.address)

      await expect(
        borrowerContract.drawdown(callableLoanInstance.address, usdcVal(100), FAZZ_EOA, {
          from: FAZZ_EOA,
        })
      ).to.be.rejectedWith(/CannotDrawdownWhenDrawdownsPaused/)

      expect(await usdc.balanceOf(FAZZ_EOA)).to.equal(previousBorrowerBalance) // .add(usdcVal(100)))
      expect(await usdc.balanceOf(callableLoanInstance.address)).to.equal(previousLoanBalance) // .sub(usdcVal(100)))
    })

    it("can (not) successfully pay on behalf of the borrower using the pay function", async () => {
      // TODO - When drawdowns are enabled:
      // 1. uncomment the expectations
      // 2. change `rejectedWith` to `not.be.rejected`
      // 3. remove the (not) in the title of this function
      await makeDeposit()
      await expect(
        borrowerContract.drawdown(callableLoanInstance.address, usdcVal(100_000), FAZZ_EOA, {
          from: FAZZ_EOA,
        })
      ).to.be.rejectedWith(/CannotDrawdownWhenDrawdownsPaused/)

      await advanceTime({days: 90})

      const previousBorrowerBalance = await usdc.balanceOf(FAZZ_EOA)
      const previousLoanBalance = await usdc.balanceOf(callableLoanInstance.address)

      await usdc.approve(borrowerContract.address, usdcVal(100), {from: FAZZ_EOA})

      // Assumes a 10% reserve fee and assumes a $100 interest payment.
      await expect(
        borrowerContract.methods["pay(address,uint256)"](callableLoanInstance.address, usdcVal(100), {
          from: FAZZ_EOA,
        })
      ).to.be.rejectedWith(/RequiresUpgrade/)

      expect(await usdc.balanceOf(FAZZ_EOA)).to.equal(previousBorrowerBalance) // .sub(usdcVal(100)))
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
      }
    })
  })

  async function makeDeposit() {
    await advanceTime({toSecond: new BN(FAZZ_DEAL_FUNDABLE_AT).add(new BN(1))})
    const depositAmount = String(usdcVal(FAZZ_DEAL_LIMIT_IN_DOLLARS).div(new BN(20)))
    await impersonateAccount(hre, lenderAddress)
    await usdc.approve(callableLoanInstance.address, String(depositAmount), {from: lenderAddress})
    await callableLoanInstance.deposit(FAZZ_DEAL_UNCALLED_CAPITAL_TRANCHE, depositAmount, {
      from: lenderAddress,
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
