import {fundWithWhales} from "@goldfinch-eng/protocol/blockchain_scripts/helpers/fundWithWhales"
import hre, {deployments, getNamedAccounts} from "hardhat"
import {
  getEthersContract,
  getProtocolOwner,
  getTruffleContract,
  getUSDCAddress,
  MAINNET_CHAIN_ID,
  OWNER_ROLE,
  TRANCHES,
} from "packages/protocol/blockchain_scripts/deployHelpers"
import {assertIsString, assertNonNullable} from "packages/utils/src/type"

import {impersonateAccount} from "@goldfinch-eng/protocol/blockchain_scripts/helpers/impersonateAccount"
import {MAINNET_GOVERNANCE_MULTISIG} from "@goldfinch-eng/protocol/blockchain_scripts/mainnetForkingHelpers"
import * as migrate270 from "@goldfinch-eng/protocol/blockchain_scripts/migrations/v2.7.0/migrate"
import {advanceTime, mochaEach} from "@goldfinch-eng/protocol/test/testHelpers"
import {
  BackerRewards,
  Borrower,
  CreditLine,
  PoolTokens,
  SeniorPool,
  StakingRewards,
  TranchedPool,
} from "@goldfinch-eng/protocol/typechain/ethers"
import {ERC20Instance} from "@goldfinch-eng/protocol/typechain/truffle"
import BN from "bn.js"
import {TEST_TIMEOUT} from "../../../MainnetForking.test"

const setupTest = deployments.createFixture(async () => {
  await deployments.fixture("baseDeploy", {keepExistingDeployments: true})

  const {gf_deployer} = await getNamedAccounts()
  assertIsString(gf_deployer)
  await fundWithWhales(["ETH"], [gf_deployer])
  await impersonateAccount(hre, await getProtocolOwner())
  await fundWithWhales(["ETH"], [await getProtocolOwner()])

  return {}
})

xdescribe("v2.7.0", async function () {
  this.timeout(TEST_TIMEOUT)

  beforeEach(async () => {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    await setupTest()
  })

  const setupAfterDeploy = deployments.createFixture(async () => {
    return await migrate270.main()
  })

  describe("after deploy", async () => {
    let poolTokens: PoolTokens
    let backerRewards: BackerRewards
    let usdc: ERC20Instance

    beforeEach(async () => {
      await setupAfterDeploy()
      poolTokens = await getEthersContract<PoolTokens>("PoolTokens")
      backerRewards = await getEthersContract<BackerRewards>("BackerRewards")
      usdc = await getTruffleContract<ERC20Instance>("ERC20", {at: getUSDCAddress(MAINNET_CHAIN_ID)})
    })

    mochaEach(migrate270.BACKER_REWARDS_PARAMS_POOL_ADDRS).describe("pool at '%s'", (address) => {
      let tranchedPool: TranchedPool
      let creditLine: CreditLine
      let borrowerContract: Borrower
      let borrowerEoa: string
      let backerTokenIds: string[]
      let ethersSeniorPool: SeniorPool
      let ethersStakingRewards: StakingRewards
      const getBackerTokenIds = async (tranchedPool: TranchedPool): Promise<string[]> => {
        const events = await tranchedPool.queryFilter(tranchedPool.filters.DepositMade(undefined, TRANCHES.Junior))
        return events.map((x) => x.args.tokenId.toString())
      }

      const setupPoolTest = deployments.createFixture(async (hre, options?: {address: string}) => {
        assertNonNullable(options)
        const {address} = options
        let tranchedPool = await getEthersContract<TranchedPool>("TranchedPool", {at: address})
        const creditLine = await getEthersContract<CreditLine>("CreditLine", {at: await tranchedPool.creditLine()})
        let borrowerContract = await getEthersContract<Borrower>("Borrower", {at: await creditLine.borrower()})
        const borrowerEoa = await borrowerContract.getRoleMember(OWNER_ROLE, 0)
        const ethersSeniorPool = await getEthersContract<SeniorPool>("SeniorPool")
        const ethersStakingRewards = await getEthersContract<StakingRewards>("StakingRewards")
        await impersonateAccount(hre, borrowerEoa)
        await fundWithWhales(["ETH", "USDC"], [borrowerEoa])
        const borrowerSigner = await hre.ethers.provider.getSigner(borrowerEoa)
        tranchedPool = tranchedPool.connect(borrowerSigner)
        borrowerContract = borrowerContract.connect(borrowerSigner)

        return {tranchedPool, creditLine, borrowerContract, ethersSeniorPool, ethersStakingRewards, borrowerEoa}
      })

      beforeEach(async () => {
        // eslint-disable-next-line @typescript-eslint/no-extra-semi
        ;({tranchedPool, creditLine, borrowerContract, ethersSeniorPool, ethersStakingRewards, borrowerEoa} =
          await setupPoolTest({address}))
        backerTokenIds = await getBackerTokenIds(tranchedPool)
      })

      describe("before first repayment", async () => {
        it("backers should accrue no staking rewards", async () => {
          const stakingRewardsEarned = await Promise.all(
            backerTokenIds.map(async (tokenId) => backerRewards.stakingRewardsEarnedSinceLastWithdraw(tokenId))
          )
          expect(stakingRewardsEarned.every((x) => x.toString() === "0"))
        })
      })

      describe("after first repayment", async () => {
        let repaymentBlockNumber: number

        const setupTest = deployments.createFixture(async () => {
          const dueTime = await creditLine.nextDueTime()
          await advanceTime({toSecond: dueTime.toString()})
          await tranchedPool.assess()
          const interestOwed = await creditLine.interestOwed()
          if (interestOwed.isZero()) {
            throw new Error("Expected interest owed > 0.")
          }
          await usdc.approve(borrowerContract.address, interestOwed.toString(), {from: borrowerEoa})
          await fundWithWhales(["USDC"], [borrowerEoa])
          const tx = await borrowerContract["pay(address,uint256)"](tranchedPool.address, interestOwed)
          const receipt = await tx.wait()
          return {repaymentBlockNumber: receipt.blockNumber}
        })

        beforeEach(async () => {
          // eslint-disable-next-line @typescript-eslint/no-extra-semi
          ;({repaymentBlockNumber} = await setupTest())
        })

        const getLatestDrawdownBlockNumber = async (tranchedPool: TranchedPool): Promise<number> => {
          const drawdownEvents = await tranchedPool.queryFilter(tranchedPool.filters.DrawdownMade())

          if (drawdownEvents.length === 0) {
            throw new Error("No DrawdownMade events found!")
          }

          const lastDrawdownBlockNumber = drawdownEvents.reduce((acc, x) => Math.max(acc, x.blockNumber), 0)
          expect(lastDrawdownBlockNumber).to.be.gt(0)
          return lastDrawdownBlockNumber
        }

        it("backers should earn equivalent staking rewards as LPs", async () => {
          const drawdownBlockNum = await getLatestDrawdownBlockNumber(tranchedPool)
          const sharePriceAtDrawdown = await ethersSeniorPool.sharePrice({blockTag: drawdownBlockNum})
          const rewardsAccAtDrawdown = await ethersStakingRewards.accumulatedRewardsPerToken({
            blockTag: drawdownBlockNum,
          })
          const rewardsAccAtRepayment = await ethersStakingRewards.accumulatedRewardsPerToken({
            blockTag: repaymentBlockNumber,
          })
          const rewardsPerTokenSinceDrawdown = rewardsAccAtRepayment.sub(rewardsAccAtDrawdown)

          const trancheInfo = await tranchedPool.getTranche(TRANCHES.Junior, {blockTag: drawdownBlockNum})
          const [, principalDeposited, principalSharePrice] = trancheInfo

          assertNonNullable(principalDeposited)
          assertNonNullable(principalSharePrice)

          // we need to know what proportion of the principal was drawdown
          // to accurately calculate rewards
          const principalDrawdownPercent = principalDeposited
            .sub(principalSharePrice.mul(principalDeposited).div(String(1e18)))
            .mul(String(1e6))
            .div(principalDeposited)

          const getExpectedRewards = (amount: BN) => {
            const fiduDecimals = new BN(String(1e18))
            const usdcDecimals = new BN(String(1e6))

            return amount
              .mul(fiduDecimals)
              .div(usdcDecimals)
              .mul(fiduDecimals)
              .div(new BN(sharePriceAtDrawdown.toString()))
              .mul(new BN(rewardsPerTokenSinceDrawdown.toString()))
              .div(fiduDecimals)
          }

          const tokenIdsWithPrincipal = await Promise.all(
            backerTokenIds.map(async (tokenId) => {
              const [tokenInfo, stakingRewardsSinceLastWithdraw] = await Promise.all([
                poolTokens.getTokenInfo(tokenId),
                backerRewards.stakingRewardsEarnedSinceLastWithdraw(tokenId),
              ])

              return {
                tokenId,
                principalAmount: tokenInfo.principalAmount.toString(),
                stakingRewardsSinceLastWithdraw: stakingRewardsSinceLastWithdraw.toString(),
              }
            })
          )

          for (const {principalAmount, stakingRewardsSinceLastWithdraw} of tokenIdsWithPrincipal) {
            // adjust principal to the amount that the borrower actually drew down
            const adjustedPrincipal = new BN(principalAmount)
              .mul(new BN(principalDrawdownPercent.toString()))
              .div(new BN(String(1e6)))
            const expectedRewards = getExpectedRewards(adjustedPrincipal)
            expect(stakingRewardsSinceLastWithdraw).to.bignumber.closeTo(expectedRewards, String(1e11))
          }
        })
      })
    })

    describe("PoolTokens", async () => {
      it("uses GCP baseURI for tokenURI(tokenId) calls", async () => {
        expect(await poolTokens.tokenURI(550)).to.eq(
          "https://us-central1-goldfinch-frontends-prod.cloudfunctions.net/poolTokenMetadata/550"
        )
      })

      describe("royalty standard", async () => {
        it("sets royalty percent to 50 bips", async () => {
          const FIFTY_BASIS_POINTS = String(5e15)

          const royaltyParams = await poolTokens.royaltyParams()
          expect(royaltyParams.royaltyPercent.toString()).to.eq(FIFTY_BASIS_POINTS)

          // Check that it results in the expected royalty share for a sample token
          const tokenId = "1"
          const salePrice = new BN(String(100e18))
          const royaltyInfo = await poolTokens.royaltyInfo(tokenId, salePrice.toString())

          const expectedRoyaltyAmount = salePrice.mul(new BN(FIFTY_BASIS_POINTS)).div(new BN(String(1e18)))
          expect(royaltyInfo[0]).to.eq(MAINNET_GOVERNANCE_MULTISIG)
          expect(royaltyInfo[1].toString()).to.eq(expectedRoyaltyAmount.toString())
          // Royalty amount should be 0.5e18 since sale price is 100e18
          expect(royaltyInfo[1].toString()).to.eq(String(5e17))
        })

        it("sets goldfinch multisig as royalty receiver", async () => {
          const royaltyParams = await poolTokens.royaltyParams()
          expect(royaltyParams.receiver).to.eq(MAINNET_GOVERNANCE_MULTISIG)
        })
      })
    })
  })
})
