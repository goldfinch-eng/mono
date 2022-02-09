import {mock, resetMocks} from "depay-web3-mock"
import {BackerRewards, BackerRewardsLoaded} from "../../ethereum/backerRewards"
import {PoolState, TranchedPool, TrancheInfo} from "../../ethereum/tranchedPool"
import {SeniorPool, SeniorPoolData, SeniorPoolLoaded} from "../../ethereum/pool"
import {GFI, GFILoaded, GFI_DECIMALS} from "../../ethereum/gfi"
import {GoldfinchProtocol} from "../../ethereum/GoldfinchProtocol"
import {
  blockchain,
  defaultCurrentBlock,
  getBackerRewardsAbi,
  getDeployments,
  network,
  recipient,
} from "../rewards/__utils__/constants"
import * as utils from "../../ethereum/utils"
import {assertWithLoadedInfo} from "../../types/loadable"
import BigNumber from "bignumber.js"
import {CreditLine} from "../../ethereum/creditLine"
import web3 from "../../web3"
import {assertAllMocksAreCalled} from "../rewards/__utils__/mocks"
import {assertNonNullable} from "../../utils"

mock({
  blockchain: "ethereum",
})

web3.readOnly.setProvider((global.window as any).ethereum)
web3.userWallet.setProvider((global.window as any).ethereum)

describe("BackerRewards", () => {
  describe("estimateApyFromGfiByTranchedPool", () => {
    const estimatedApyFromGfiSeniorPool = new BigNumber(0.37)
    const gfiPrice = new BigNumber(4.06).multipliedBy(GFI_DECIMALS)
    const gfiSupply = new BigNumber(114_285_714).multipliedBy(GFI_DECIMALS)

    const goldfinchProtocol = new GoldfinchProtocol(network)
    let seniorPool: SeniorPoolLoaded
    let gfi: GFILoaded
    let backerRewards: BackerRewardsLoaded

    const tranchedPoolAddress = "0x0000000000000000000000000000000000000099"
    let tranchedPool: TranchedPool

    let callBackerRewardsPoolsMock: () => void

    const currentBlock = defaultCurrentBlock

    beforeEach(resetMocks)
    beforeEach(() => mock({blockchain, accounts: {return: [recipient]}}))
    beforeEach(async () => {
      jest.spyOn(utils, "getDeployments").mockImplementation(() => {
        return getDeployments()
      })

      await goldfinchProtocol.initialize()

      const _seniorPoolLoaded = new SeniorPool(goldfinchProtocol)
      _seniorPoolLoaded.info = {
        loaded: true,
        value: {
          currentBlock,
          poolData: {
            estimatedApyFromGfi: estimatedApyFromGfiSeniorPool,
          } as SeniorPoolData,
          isPaused: false,
        },
      }
      assertWithLoadedInfo(_seniorPoolLoaded)
      seniorPool = _seniorPoolLoaded

      const _gfiLoaded = new GFI(goldfinchProtocol)
      _gfiLoaded.info = {
        loaded: true,
        value: {
          currentBlock,
          price: gfiPrice,
          supply: gfiSupply,
        },
      }
      assertWithLoadedInfo(_gfiLoaded)
      gfi = _gfiLoaded

      tranchedPool = new TranchedPool(tranchedPoolAddress, goldfinchProtocol)

      tranchedPool.creditLine = new CreditLine("0x0000000000000000000000000000000000000098", goldfinchProtocol)
      tranchedPool.creditLine.isLate = false
      tranchedPool.creditLine.termEndTime = new BigNumber(0)
      tranchedPool.creditLine.termStartTime = new BigNumber(0)
      tranchedPool.creditLine.maxLimit = new BigNumber(1e7).multipliedBy(utils.USDC_DECIMALS.toString(10))
      tranchedPool.creditLine.termInDays = new BigNumber(3 * 365)
      tranchedPool.creditLine.paymentPeriodInDays = new BigNumber(30)
      tranchedPool.creditLine.interestApr = new BigNumber(0.1).multipliedBy(utils.INTEREST_DECIMALS.toString(10))

      tranchedPool.poolState = PoolState.Open
      tranchedPool.totalDeployed = new BigNumber(0)
      const juniorPrincipalDeposited = new BigNumber(0)
      tranchedPool.juniorTranche = {
        principalDeposited: juniorPrincipalDeposited,
      } as TrancheInfo
      const seniorPrincipalDeposited = new BigNumber(0)
      tranchedPool.seniorTranche = {
        principalDeposited: seniorPrincipalDeposited,
      } as TrancheInfo
      tranchedPool.totalDeposited = juniorPrincipalDeposited.plus(seniorPrincipalDeposited)
      tranchedPool.fundableAt = new BigNumber(currentBlock.timestamp)
      tranchedPool.estimatedLeverageRatio = new BigNumber(3)

      const _backerRewardsLoaded = new BackerRewards(goldfinchProtocol)
      _backerRewardsLoaded.info = {
        loaded: true,
        value: {
          currentBlock,
          maxInterestDollarsEligible: new BigNumber(1e8).multipliedBy(new BigNumber(1e18)),
          totalRewardPercentOfTotalGFI: new BigNumber(2).multipliedBy(new BigNumber(1e18)),
          isPaused: false,
        },
      }
      assertWithLoadedInfo(_backerRewardsLoaded)
      backerRewards = _backerRewardsLoaded

      callBackerRewardsPoolsMock = mock({
        blockchain,
        call: {
          to: backerRewards.address,
          api: await getBackerRewardsAbi(),
          method: "pools",
          params: [tranchedPoolAddress],
          return: "0",
        },
      })
    })

    describe("if only one tranched pool is eligible for backer rewards", () => {
      describe("and that pool is open for the first time", () => {
        const tranchedPoolAddress = "0x0000000000000000000000000000000000000099"
        let tranchedPool: TranchedPool

        let callBackerRewardsPoolsMock: () => void

        beforeEach(async () => {
          tranchedPool = new TranchedPool(tranchedPoolAddress, goldfinchProtocol)

          tranchedPool.creditLine = new CreditLine("0x0000000000000000000000000000000000000098", goldfinchProtocol)
          tranchedPool.creditLine.isLate = false
          tranchedPool.creditLine.termEndTime = new BigNumber(0)
          tranchedPool.creditLine.termStartTime = new BigNumber(0)
          tranchedPool.creditLine.maxLimit = new BigNumber(1e7).multipliedBy(utils.USDC_DECIMALS.toString(10))
          tranchedPool.creditLine.termInDays = new BigNumber(3 * 365)
          tranchedPool.creditLine.paymentPeriodInDays = new BigNumber(30)
          tranchedPool.creditLine.interestApr = new BigNumber(0.1).multipliedBy(utils.INTEREST_DECIMALS.toString(10))

          tranchedPool.poolState = PoolState.Open
          tranchedPool.totalDeployed = new BigNumber(0)
          const juniorPrincipalDeposited = new BigNumber(0)
          tranchedPool.juniorTranche = {
            principalDeposited: juniorPrincipalDeposited,
          } as TrancheInfo
          const seniorPrincipalDeposited = new BigNumber(0)
          tranchedPool.seniorTranche = {
            principalDeposited: seniorPrincipalDeposited,
          } as TrancheInfo
          tranchedPool.totalDeposited = juniorPrincipalDeposited.plus(seniorPrincipalDeposited)
          tranchedPool.fundableAt = new BigNumber(currentBlock.timestamp)
          tranchedPool.estimatedLeverageRatio = new BigNumber(3)

          callBackerRewardsPoolsMock = mock({
            blockchain,
            call: {
              to: backerRewards.address,
              api: await getBackerRewardsAbi(),
              method: "pools",
              params: [tranchedPoolAddress],
              return: "0",
            },
          })
        })

        it("should return the correct backers-only and senior-pool-matching APY-from-GFI values", async () => {
          // NOTE: The purpose of this test is specifically to establish that the frontend calculates estimated
          // APY-from-GFI correctly for the Alma pool #6, which is the first (and only, as of its launch time)
          // tranched pool eligible for rewards via the BackerRewards contract. The expected values can be
          // understood using this spreadsheet: https://docs.google.com/spreadsheets/d/1PgnD1RpwnxqiNDoiShX7_Gjl2TdgBN36oPM8HysRzH8/edit#gid=0

          const tranchedPools = [tranchedPool]

          const tranchedPoolScheduledRepayments = await tranchedPool.getOptimisticRepaymentSchedule(currentBlock)
          expect(
            tranchedPoolScheduledRepayments.map((scheduled) => ({
              timestamp: scheduled.timestamp,
              usdcAmount: scheduled.usdcAmount.toString(),
            }))
          ).toEqual([
            {
              timestamp: 1643980291,
              usdcAmount: "82191780821.91780821917808219178",
            },
            {
              timestamp: 1646572291,
              usdcAmount: "82191780821.91780821917808219178",
            },
            {
              timestamp: 1649164291,
              usdcAmount: "82191780821.91780821917808219178",
            },
            {
              timestamp: 1651756291,
              usdcAmount: "82191780821.91780821917808219178",
            },
            {
              timestamp: 1654348291,
              usdcAmount: "82191780821.91780821917808219178",
            },
            {
              timestamp: 1656940291,
              usdcAmount: "82191780821.91780821917808219178",
            },
            {
              timestamp: 1659532291,
              usdcAmount: "82191780821.91780821917808219178",
            },
            {
              timestamp: 1662124291,
              usdcAmount: "82191780821.91780821917808219178",
            },
            {
              timestamp: 1664716291,
              usdcAmount: "82191780821.91780821917808219178",
            },
            {
              timestamp: 1667308291,
              usdcAmount: "82191780821.91780821917808219178",
            },
            {
              timestamp: 1669900291,
              usdcAmount: "82191780821.91780821917808219178",
            },
            {
              timestamp: 1672492291,
              usdcAmount: "82191780821.91780821917808219178",
            },
            {
              timestamp: 1675084291,
              usdcAmount: "82191780821.91780821917808219178",
            },
            {
              timestamp: 1677676291,
              usdcAmount: "82191780821.91780821917808219178",
            },
            {
              timestamp: 1680268291,
              usdcAmount: "82191780821.91780821917808219178",
            },
            {
              timestamp: 1682860291,
              usdcAmount: "82191780821.91780821917808219178",
            },
            {
              timestamp: 1685452291,
              usdcAmount: "82191780821.91780821917808219178",
            },
            {
              timestamp: 1688044291,
              usdcAmount: "82191780821.91780821917808219178",
            },
            {
              timestamp: 1690636291,
              usdcAmount: "82191780821.91780821917808219178",
            },
            {
              timestamp: 1693228291,
              usdcAmount: "82191780821.91780821917808219178",
            },
            {
              timestamp: 1695820291,
              usdcAmount: "82191780821.91780821917808219178",
            },
            {
              timestamp: 1698412291,
              usdcAmount: "82191780821.91780821917808219178",
            },
            {
              timestamp: 1701004291,
              usdcAmount: "82191780821.91780821917808219178",
            },
            {
              timestamp: 1703596291,
              usdcAmount: "82191780821.91780821917808219178",
            },
            {
              timestamp: 1706188291,
              usdcAmount: "82191780821.91780821917808219178",
            },
            {
              timestamp: 1708780291,
              usdcAmount: "82191780821.91780821917808219178",
            },
            {
              timestamp: 1711372291,
              usdcAmount: "82191780821.91780821917808219178",
            },
            {
              timestamp: 1713964291,
              usdcAmount: "82191780821.91780821917808219178",
            },
            {
              timestamp: 1716556291,
              usdcAmount: "82191780821.91780821917808219178",
            },
            {
              timestamp: 1719148291,
              usdcAmount: "82191780821.91780821917808219178",
            },
            {
              timestamp: 1721740291,
              usdcAmount: "82191780821.91780821917808219178",
            },
            {
              timestamp: 1724332291,
              usdcAmount: "82191780821.91780821917808219178",
            },
            {
              timestamp: 1726924291,
              usdcAmount: "82191780821.91780821917808219178",
            },
            {
              timestamp: 1729516291,
              usdcAmount: "82191780821.91780821917808219178",
            },
            {
              timestamp: 1732108291,
              usdcAmount: "82191780821.91780821917808219178",
            },
            {
              timestamp: 1734700291,
              usdcAmount: "82191780821.91780821917808219178",
            },
            {
              timestamp: 1735996291,
              usdcAmount: "41095890410.95890410958904109589",
            },
          ])

          const estimatedRewards = await backerRewards._estimateRewardsFromScheduledRepayments(
            tranchedPools,
            gfi.info.value.supply,
            currentBlock
          )
          expect(estimatedRewards[tranchedPool.address]?.value.toString(10)).toEqual("395897326454569024246362")

          const result = await backerRewards.estimateApyFromGfiByTranchedPool(tranchedPools, seniorPool, gfi)
          expect(Object.keys(result)).toEqual([tranchedPoolAddress])
          const tranchedPoolResult = result[tranchedPoolAddress]
          expect(tranchedPoolResult).toBeTruthy()
          assertNonNullable(tranchedPoolResult)
          expect(Object.keys(tranchedPoolResult)).toEqual(["backersOnly", "seniorPoolMatching"])
          expect(tranchedPoolResult.backersOnly?.toString()).toEqual("0.21431241938740669846")
          expect(tranchedPoolResult.seniorPoolMatching?.toString()).toEqual("0.37")

          assertAllMocksAreCalled({callBackerRewardsPoolsMock})
        })
      })
    })
  })
})
