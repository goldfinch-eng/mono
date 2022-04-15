import hre, {deployments, getNamedAccounts} from "hardhat"
import {asNonNullable, assertIsString, assertNonNullable} from "packages/utils/src/type"
import {
  getEthersContract,
  getProtocolOwner,
  getTruffleContract,
  getUSDCAddress,
  MAINNET_CHAIN_ID,
  MAINNET_FIDU_USDC_CURVE_LP_ADDRESS,
  OWNER_ROLE,
  TRANCHES,
} from "packages/protocol/blockchain_scripts/deployHelpers"
import {fundWithWhales} from "@goldfinch-eng/protocol/blockchain_scripts/helpers/fundWithWhales"

import * as migrate260 from "@goldfinch-eng/protocol/blockchain_scripts/migrations/v2.6.0/migrate"
import {TEST_TIMEOUT} from "../../../MainnetForking.test"
import {impersonateAccount} from "@goldfinch-eng/protocol/blockchain_scripts/helpers/impersonateAccount"
import {
  BackerRewardsInstance,
  CommunityRewardsInstance,
  ERC20Instance,
  FixedLeverageRatioStrategyInstance,
  GFIInstance,
  GoInstance,
  GoldfinchConfigInstance,
  GoldfinchFactoryInstance,
  PoolTokensInstance,
  SeniorPoolInstance,
  StakingRewardsInstance,
  TranchedPoolInstance,
  UniqueIdentityInstance,
  ZapperInstance,
} from "@goldfinch-eng/protocol/typechain/truffle"
import {CONFIG_KEYS} from "@goldfinch-eng/protocol/blockchain_scripts/configKeys"
import {
  advanceTime,
  BN,
  createPoolWithCreditLine,
  expectOwnerRole,
  expectProxyOwner,
  mochaEach,
} from "@goldfinch-eng/protocol/test/testHelpers"
import {StakedPositionType} from "@goldfinch-eng/protocol/blockchain_scripts/deployHelpers"
import {Contract} from "ethers/lib/ethers"
import {Migration260Params} from "@goldfinch-eng/protocol/blockchain_scripts/migrations/v2.6.0/migrate"
import {Borrower, CreditLine, SeniorPool, StakingRewards, TranchedPool} from "@goldfinch-eng/protocol/typechain/ethers"

const setupTest = deployments.createFixture(async () => {
  await deployments.fixture("base_deploy", {keepExistingDeployments: true})

  const go = await getTruffleContract<GoInstance>("Go")
  const gfi = await getTruffleContract<GFIInstance>("GFI")
  const communityRewards = await getTruffleContract<CommunityRewardsInstance>("CommunityRewards")
  const goldfinchConfig = await getTruffleContract<GoldfinchConfigInstance>("GoldfinchConfig")
  const backerRewards = await getTruffleContract<BackerRewardsInstance>("BackerRewards")
  const seniorPool = await getTruffleContract<SeniorPoolInstance>("SeniorPool")
  const stakingRewards = await getTruffleContract<StakingRewardsInstance>("StakingRewards")
  const uniqueIdentity = await getTruffleContract<UniqueIdentityInstance>("UniqueIdentity")
  const goldfinchFactory = await getTruffleContract<GoldfinchFactoryInstance>("GoldfinchFactory")
  const usdc = await getTruffleContract<ERC20Instance>("ERC20", {at: getUSDCAddress(MAINNET_CHAIN_ID)})
  const poolTokens = await getTruffleContract<PoolTokensInstance>("PoolTokens")
  const fixedLeverageRatioStrategy = await getTruffleContract<FixedLeverageRatioStrategyInstance>(
    "FixedLeverageRatioStrategy"
  )

  const {gf_deployer} = await getNamedAccounts()
  assertIsString(gf_deployer)
  await fundWithWhales(["ETH"], [gf_deployer])
  await impersonateAccount(hre, await getProtocolOwner())
  await fundWithWhales(["ETH"], [await getProtocolOwner()])

  return {
    gfi,
    goldfinchConfig,
    communityRewards,
    backerRewards,
    seniorPool,
    poolTokens,
    stakingRewards,
    go,
    usdc,
    uniqueIdentity,
    goldfinchFactory,
    fixedLeverageRatioStrategy,
  }
})

describe("v2.6.0", async function () {
  this.timeout(TEST_TIMEOUT)

  let gfi: GFIInstance
  let goldfinchConfig: GoldfinchConfigInstance
  let backerRewards: BackerRewardsInstance
  let seniorPool: SeniorPoolInstance
  let go: GoInstance
  let stakingRewards: StakingRewardsInstance
  let usdc: ERC20Instance
  let poolTokens: PoolTokensInstance

  let tranchedPoolImplAddressBeforeDeploy: string
  let leverageRatioStrategyAddressBeforeDeploy: string
  let goldfinchFactory: GoldfinchFactoryInstance

  beforeEach(async () => {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;({gfi, goldfinchConfig, poolTokens, usdc, backerRewards, seniorPool, go, stakingRewards, goldfinchFactory} =
      await setupTest())

    tranchedPoolImplAddressBeforeDeploy = await goldfinchConfig.getAddress(CONFIG_KEYS.TranchedPoolImplementation)
    leverageRatioStrategyAddressBeforeDeploy = await goldfinchConfig.getAddress(CONFIG_KEYS.LeverageRatio)
  })

  const setupAfterDeploy = deployments.createFixture(async () => {
    const {params, deployedContracts} = await migrate260.main()
    const zapper = await getTruffleContract<ZapperInstance>("Zapper", {at: deployedContracts.zapper.address})
    const fixedLeverageRatioStrategy = await getTruffleContract<FixedLeverageRatioStrategyInstance>(
      "FixedLeverageRatioStrategy"
    )
    return {zapper, fixedLeverageRatioStrategy, params, deployedContracts}
  })

  describe("after deploy", async () => {
    let params: Migration260Params
    let zapper: ZapperInstance
    let fixedLeverageRatioStrategy: FixedLeverageRatioStrategyInstance
    let tranchedPoolDeployment: Contract

    beforeEach(async () => {
      // eslint-disable-next-line @typescript-eslint/no-extra-semi
      ;({
        params,
        zapper,
        fixedLeverageRatioStrategy,
        deployedContracts: {tranchedPool: tranchedPoolDeployment},
      } = await setupAfterDeploy())
    })

    describe("GoldfinchConfig", async () => {
      describe("getAddress", async () => {
        describe("TranchedPool", async () => {
          it("is upgraded address", async () => {
            const configAddress = await goldfinchConfig.getAddress(CONFIG_KEYS.TranchedPoolImplementation)
            expect(configAddress).to.not.eq(tranchedPoolImplAddressBeforeDeploy)
            expect(configAddress).to.eq(tranchedPoolDeployment.address)
          })
        })

        describe("SeniorPoolStrategy", async () => {
          it("is correct", async () => {
            const addressInConfig = await goldfinchConfig.getAddress(CONFIG_KEYS.SeniorPoolStrategy)
            expect(addressInConfig).to.not.eq(leverageRatioStrategyAddressBeforeDeploy)
            expect(addressInConfig).to.eq(fixedLeverageRatioStrategy.address)
          })
        })

        describe("FiduUSDCCurveLP", async () => {
          it("is correct", async () => {
            const configAddress = await goldfinchConfig.getAddress(CONFIG_KEYS.FiduUSDCCurveLP)
            expect(configAddress).to.be.eq(MAINNET_FIDU_USDC_CURVE_LP_ADDRESS)
          })
        })
      })
    })

    describe("Go", async () => {
      describe("hasRole", async () => {
        describe("ZAPPER_ROLE", async () => {
          it("is true for Zapper contract", async () => {
            expect(await go.hasRole(await go.ZAPPER_ROLE(), zapper.address)).to.be.true
          })
        })
      })
    })

    describe("Zapper", async () => {
      expectProxyOwner({
        toBe: getProtocolOwner,
        forContracts: ["Zapper"],
      })

      expectOwnerRole({toBe: getProtocolOwner, forContracts: ["Zapper"]})
    })

    describe("GFI", async () => {
      describe("balanceOf", async () => {
        describe("BackerRewards", async () => {
          it("is correct", async () => {
            expect((await gfi.balanceOf(backerRewards.address)).toString()).to.bignumber.eq(
              params.BackerRewards.totalRewards
            )
          })
        })
      })
    })

    describe("FixedLeverageRatioStrategy", async () => {
      expectOwnerRole({
        toBe: getProtocolOwner,
        forContracts: ["FixedLeverageRatioStrategy"],
      })
    })

    describe("BackerRewards", async () => {
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

      mochaEach(migrate260.BACKER_REWARDS_PARAMS_POOL_ADDRS).describe("pool at '%s'", (address) => {
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
            await usdc.approve(borrowerContract.address, interestOwed.toString(), {from: borrowerEoa})
            await fundWithWhales(["USDC"], [borrowerEoa])
            const tx = await borrowerContract.pay(tranchedPool.address, interestOwed)
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

            const getExpectedRewards = (amount: BN) => {
              const fiduDecimals = new BN("1000000000000000000")
              const usdcDecimals = new BN("1000000")

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
              const expectedRewards = getExpectedRewards(new BN(principalAmount))
              expect(stakingRewardsSinceLastWithdraw).to.bignumber.eq(expectedRewards)
            }
          })
        })
      })
    })

    context("Go", () => {
      expectProxyOwner({
        toBe: getProtocolOwner,
        forContracts: ["Go"],
      })

      describe("hasRole", async () => {
        describe("ZAPPER_ROLE", async () => {
          it("Zapper to be true", async () => {
            expect(await go.hasRole(await go.ZAPPER_ROLE(), zapper.address)).to.be.true
          })
        })
      })

      context("getSeniorPoolIdTypes", () => {
        it("getSeniorPoolIdTypes", async () => {
          const received = await go.getSeniorPoolIdTypes()
          expect(received).deep.equal([
            await go.ID_TYPE_0(),
            await go.ID_TYPE_1(),
            await go.ID_TYPE_3(),
            await go.ID_TYPE_4(),
          ])
        })
      })
    })

    describe("TranchedPool", async () => {
      let tranchedPool: TranchedPoolInstance
      const allowedUIDTypes = [0, 1, 2, 3, 4]

      const testSetup = deployments.createFixture(async () => {
        const [, , , , , maybeBorrower] = await hre.getUnnamedAccounts()
        const borrower = asNonNullable(maybeBorrower)
        const usdc = await getTruffleContract<ERC20Instance>("ERC20", {at: getUSDCAddress(MAINNET_CHAIN_ID)})
        const {tranchedPool} = await createPoolWithCreditLine({
          people: {borrower, owner: await getProtocolOwner()},
          usdc,
          goldfinchFactory,
          allowedUIDTypes,
        })

        return {tranchedPool}
      })

      beforeEach(async () => {
        // eslint-disable-next-line @typescript-eslint/no-extra-semi
        ;({tranchedPool} = await testSetup())
      })

      describe("getAllowedUIDTypes", async () => {
        it("is correct", async () => {
          const sampledUidTypes = (await tranchedPool.getAllowedUIDTypes()).map((x) => x.toNumber())
          expect(sampledUidTypes).to.deep.eq(allowedUIDTypes)
        })
      })
    })

    describe("SeniorPool", async () => {
      describe("hasRole", async () => {
        describe("ZAPPER_ROLE", async () => {
          it("is true for Zapper contract", async () => {
            expect(await seniorPool.hasRole(await seniorPool.ZAPPER_ROLE(), zapper.address)).to.be.true
          })
        })
      })
    })

    describe("StakingRewards", async () => {
      describe("hasRole", async () => {
        describe("ZAPPER_ROLE", async () => {
          it("is true for Zapper contract", async () => {
            expect(await stakingRewards.hasRole(await stakingRewards.ZAPPER_ROLE(), zapper.address)).to.be.true
          })
        })
      })

      describe("effectiveMultiplier", async () => {
        describe("CurveLp", async () => {
          it("is correct", async () => {
            expect(params.StakingRewards.effectiveMultiplier).to.eq("750000000000000000")
            expect((await stakingRewards.getEffectiveMultiplier(StakedPositionType.CurveLP)).toString()).to.eq(
              params.StakingRewards.effectiveMultiplier
            )
          })
        })
      })
    })
  })
})
