import BN from "bn.js"
import {fundWithWhales} from "@goldfinch-eng/protocol/blockchain_scripts/helpers/fundWithWhales"
import {deployments} from "hardhat"
import {
  SIGNER_ROLE,
  getProtocolOwner,
  getTruffleContract,
  USDCDecimals,
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
import {MAINNET_WARBLER_LABS_MULTISIG} from "@goldfinch-eng/protocol/blockchain_scripts/mainnetForkingHelpers"
import {advanceTime, decodeAndGetFirstLog, usdcVal} from "@goldfinch-eng/protocol/test/testHelpers"
import {NON_US_UID_TYPES, US_UID_TYPES_SANS_NON_ACCREDITED, assertNonNullable} from "@goldfinch-eng/utils"
import {BorrowerCreated} from "@goldfinch-eng/protocol/typechain/truffle/contracts/protocol/core/GoldfinchFactory"
import {getERC20Address, MAINNET_CHAIN_ID} from "@goldfinch-eng/protocol/blockchain_scripts/deployHelpers"
import {createCallableLoanForBorrower} from "@goldfinch-eng/protocol/blockchain_scripts/helpers/createCallableLoanForBorrower"
import {Logger} from "@goldfinch-eng/protocol/blockchain_scripts/types"
import hre from "hardhat"
import {impersonateAccount} from "@goldfinch-eng/protocol/blockchain_scripts/helpers/impersonateAccount"
import {mintUidIfNotMinted} from "@goldfinch-eng/protocol/test/util/uniqueIdentity"
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers"
import {CallRequestSubmitted} from "@goldfinch-eng/protocol/typechain/truffle/CallableLoan"

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

const LIMIT_IN_DOLLARS = 2_000_000

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
  let borrowerAddress
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
    borrowerAddress = (await allSigners[2]?.getAddress()) as string
    await fundWithWhales(["GFI", "USDC", "ETH"], [lenderAddress, borrowerAddress, MAINNET_WARBLER_LABS_MULTISIG])
    await impersonateAccount(hre, borrowerAddress)
    await gfFactory.grantRole(await gfFactory.BORROWER_ROLE(), borrowerAddress)
    borrowerContract = await createBorrowerContract(borrowerAddress)
    await impersonateAccount(hre, MAINNET_WARBLER_LABS_MULTISIG)
    await uniqueIdentity.grantRole(SIGNER_ROLE, signer, {from: MAINNET_WARBLER_LABS_MULTISIG})
    await mintUidIfNotMinted(hre, new BN(NON_US_UID_TYPES[0] as number), uniqueIdentity, lenderAddress, signer)

    callableLoanInstance = await createCallableLoanForBorrower({
      hre,
      logger,
      goldfinchFactory: gfFactory,
      borrower: borrowerContract.address,
      depositor: lenderAddress,
      erc20: usdc,
      allowedUIDTypes: [...NON_US_UID_TYPES, ...US_UID_TYPES_SANS_NON_ACCREDITED],
      limitInDollars: LIMIT_IN_DOLLARS,
      numPeriods: 24,
      gracePrincipalPeriods: 0,
      numPeriodsPerInterestPeriod: 1,
      numPeriodsPerPrincipalPeriod: 3,
    })
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
      const gfiDepositAmount = 10000
      const callAmount = 10000000

      await gfi.approve(membershipOrchestrator.address, String(gfiDepositAmount), {from: lenderAddress})
      await poolTokens.approve(membershipOrchestrator.address, originalPoolTokenId, {from: lenderAddress})

      await borrowerContract.drawdown(callableLoanInstance.address, usdcVal(100_000), borrowerAddress, {
        from: borrowerAddress,
      })
      await advanceTime({days: 30})
      const callResult = await callableLoanInstance.submitCall(new BN(callAmount), originalPoolTokenId, {
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
      ).to.be.rejected

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
      ).to.be.rejected

      // can submit new uncalled pool token
      await poolTokens.approve(membershipOrchestrator.address, callEvent.args.remainingTokenId, {
        from: lenderAddress,
      })
      await expect(
        membershipOrchestrator.deposit(
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
      ).to.not.be.rejected

      const capital = await membershipOrchestrator.totalCapitalHeldBy(lenderAddress)
      const depositAmount = (await callableLoanInstance.limit()).div(new BN(20))
      expect(capital[1]).to.equal(depositAmount.sub(new BN(callAmount)))
    })
  })

  describe("Borrower", async () => {
    it("throws an error when attempting to lockJuniorCapital", async () => {
      await expect(
        borrowerContract.lockJuniorCapital(callableLoanInstance.address, {from: borrowerAddress})
      ).to.eventually.be.rejectedWith()
    })

    it("throws an error when attempting to lockPool", async () => {
      await expect(
        borrowerContract.lockPool(callableLoanInstance.address, {from: borrowerAddress})
      ).to.eventually.be.rejectedWith()
    })

    it("can successfully drawdown and transfer funds to the borrower address", async () => {
      const previousBorrowerBalance = await usdc.balanceOf(borrowerAddress)
      const previousLoanBalance = await usdc.balanceOf(callableLoanInstance.address)

      await borrowerContract.drawdown(callableLoanInstance.address, usdcVal(100), borrowerAddress, {
        from: borrowerAddress,
      })

      expect(await usdc.balanceOf(borrowerAddress)).to.equal(previousBorrowerBalance.add(usdcVal(100)))
      expect(await usdc.balanceOf(callableLoanInstance.address)).to.equal(previousLoanBalance.sub(usdcVal(100)))
    })

    it("can successfully pay on behalf of the borrower using the pay function", async () => {
      await borrowerContract.drawdown(callableLoanInstance.address, usdcVal(100_000), borrowerAddress, {
        from: borrowerAddress,
      })
      await advanceTime({days: 90})

      const previousBorrowerBalance = await usdc.balanceOf(borrowerAddress)
      const previousLoanBalance = await usdc.balanceOf(callableLoanInstance.address)

      await usdc.approve(borrowerContract.address, usdcVal(100), {from: borrowerAddress})

      // Assumes a 10% reserve fee and assumes a $100 interest payment.
      await borrowerContract.methods["pay(address,uint256)"](callableLoanInstance.address, usdcVal(100), {
        from: borrowerAddress,
      })

      expect(await usdc.balanceOf(borrowerAddress)).to.equal(previousBorrowerBalance.sub(usdcVal(100)))
      expect(await usdc.balanceOf(callableLoanInstance.address)).to.equal(previousLoanBalance.add(usdcVal(90)))
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
          borrowerContract.drawdown(callableLoanInstance.address, usdcVal(LIMIT_IN_DOLLARS), randoUser, {
            from: randoUser,
          })
        ).to.eventually.be.rejectedWith("Must have admin role to perform this action")
        await expect(
          borrowerContract.drawdownWithSwapOnOneInch(
            callableLoanInstance.address,
            usdcVal(LIMIT_IN_DOLLARS),
            randoUser,
            usdc.address,
            usdcVal(LIMIT_IN_DOLLARS),
            [usdc.address],
            {
              from: randoUser,
            }
          )
        ).to.eventually.be.rejectedWith("Must have admin role to perform this action")
        await expect(
          borrowerContract.transferERC20(usdc.address, randoUser, LIMIT_IN_DOLLARS, {from: randoUser})
        ).to.eventually.be.rejectedWith("Must have admin role to perform this action")
        await expect(
          borrowerContract.methods["pay(address,uint256)"](randoUser, LIMIT_IN_DOLLARS, {from: randoUser})
        ).to.eventually.be.rejectedWith("Must have admin role to perform this action")
        await expect(
          borrowerContract.methods["pay(address,uint256,uint256)"](randoUser, LIMIT_IN_DOLLARS, LIMIT_IN_DOLLARS, {
            from: randoUser,
          })
        ).to.eventually.be.rejectedWith("Must have admin role to perform this action")
        await expect(
          borrowerContract.payInFull(randoUser, LIMIT_IN_DOLLARS, {from: randoUser})
        ).to.eventually.be.rejectedWith("Must have admin role to perform this action")
        await expect(
          borrowerContract.payWithSwapOnOneInch(
            callableLoanInstance.address,
            LIMIT_IN_DOLLARS,
            usdc.address,
            LIMIT_IN_DOLLARS,
            [1],
            {
              from: randoUser,
            }
          )
        ).to.eventually.be.rejectedWith("Must have admin role to perform this action")
        await expect(
          borrowerContract.payMultipleWithSwapOnOneInch([], [0], LIMIT_IN_DOLLARS, usdc.address, [1], {from: randoUser})
        ).to.eventually.be.rejectedWith("Must have admin role to perform this action")
      }
    })
  })

  async function createBorrowerContract(borrowerAddress: string) {
    const result = await gfFactory.createBorrower(borrowerAddress)
    assertNonNullable(result)
    const bwrConAddr = (result.logs[result.logs.length - 1] as unknown as BorrowerCreated).args.borrower
    const bwrCon = await Borrower.at(bwrConAddr)
    return bwrCon
  }
})
