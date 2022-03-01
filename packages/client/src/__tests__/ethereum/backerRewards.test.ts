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
  getCreditLineAbi,
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

      const _backerRewardsLoaded = new BackerRewards(goldfinchProtocol)
      _backerRewardsLoaded.startBlock = currentBlock
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
    })

    describe("if only one tranched pool is eligible for backer rewards", () => {
      const openTranchedPoolExpectedRepaymentSchedule = [
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
      ]
      const tranchedPoolExpectedEstimatedRewards = "395897326454569024246362"
      const tranchedPoolExpectedBackersOnlyApy = "0.21431241938740669846"
      const tranchedPoolExpectedSeniorPoolMatchingApy = "0.37"

      const tranchedPoolAddress = "0x0000000000000000000000000000000000000099"
      let tranchedPool: TranchedPool

      const tranchedPoolMaxLimit = new BigNumber(1e7).multipliedBy(utils.USDC_DECIMALS.toString(10))
      const tranchedPoolTermInDays = new BigNumber(365 * 3)

      const creditLineAddress = "0x0000000000000000000000000000000000000098"

      let callBackerRewardsPoolsMock: () => void
      let callCreditLineMock: () => void

      beforeEach(async () => {
        tranchedPool = new TranchedPool(tranchedPoolAddress, goldfinchProtocol)

        tranchedPool.creditLine = new CreditLine(creditLineAddress, goldfinchProtocol)
        tranchedPool.creditLine.isLate = false
        tranchedPool.creditLine.termEndTime = new BigNumber(0)
        tranchedPool.creditLine.termStartTime = new BigNumber(0)
        tranchedPool.creditLine.maxLimit = tranchedPoolMaxLimit
        tranchedPool.creditLine.termInDays = tranchedPoolTermInDays
        tranchedPool.creditLine.paymentPeriodInDays = new BigNumber(30)
        tranchedPool.creditLine.interestApr = new BigNumber(0.1).multipliedBy(utils.INTEREST_DECIMALS.toString(10))

        tranchedPool.fundableAt = new BigNumber(currentBlock.timestamp)
        tranchedPool.estimatedLeverageRatio = new BigNumber(3)
      })

      describe("and that pool is open for the first time", () => {
        beforeEach(async () => {
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
          ).toEqual(openTranchedPoolExpectedRepaymentSchedule)

          const estimatedRewards = await backerRewards._estimateRewardsFromScheduledRepayments(
            tranchedPools,
            gfi.info.value.supply,
            currentBlock
          )
          expect(estimatedRewards[tranchedPool.address]?.value.toString(10)).toEqual(
            tranchedPoolExpectedEstimatedRewards
          )

          const result = await backerRewards.estimateApyFromGfiByTranchedPool(tranchedPools, seniorPool, gfi)
          expect(Object.keys(result)).toEqual([tranchedPoolAddress])
          const tranchedPoolResult = result[tranchedPoolAddress]
          expect(tranchedPoolResult).toBeTruthy()
          assertNonNullable(tranchedPoolResult)
          expect(Object.keys(tranchedPoolResult)).toEqual(["backersOnly", "seniorPoolMatching"])
          expect(tranchedPoolResult.backersOnly?.toString()).toEqual(tranchedPoolExpectedBackersOnlyApy)
          expect(tranchedPoolResult.seniorPoolMatching?.toString()).toEqual(tranchedPoolExpectedSeniorPoolMatchingApy)

          assertAllMocksAreCalled({callBackerRewardsPoolsMock})
        })
      })

      describe("and that pool filled up and was drawndown", () => {
        beforeEach(async () => {
          const drawdownTime = new BigNumber(currentBlock.timestamp)

          tranchedPool.creditLine.termStartTime = drawdownTime
          tranchedPool.creditLine.termEndTime = drawdownTime.plus(
            tranchedPool.creditLine.termInDays.multipliedBy(utils.SECONDS_PER_DAY)
          )
          tranchedPool.creditLine.lastFullPaymentTime = drawdownTime
          tranchedPool.creditLine.nextDueTime = drawdownTime.plus(
            tranchedPool.creditLine.paymentPeriodInDays.multipliedBy(utils.SECONDS_PER_DAY)
          )
          tranchedPool.creditLine.balance = tranchedPoolMaxLimit
          tranchedPool.creditLine.interestOwed = new BigNumber(0)

          tranchedPool.poolState = PoolState.SeniorLocked
          tranchedPool.totalDeployed = tranchedPoolMaxLimit
          const juniorPrincipalDeposited = tranchedPoolMaxLimit.dividedBy(tranchedPool.estimatedLeverageRatio.plus(1))
          tranchedPool.juniorTranche = {
            principalDeposited: juniorPrincipalDeposited,
          } as TrancheInfo
          const seniorPrincipalDeposited = tranchedPoolMaxLimit
            .multipliedBy(tranchedPool.estimatedLeverageRatio)
            .dividedBy(tranchedPool.estimatedLeverageRatio.plus(1))
          tranchedPool.seniorTranche = {
            principalDeposited: seniorPrincipalDeposited,
          } as TrancheInfo
          tranchedPool.totalDeposited = juniorPrincipalDeposited.plus(seniorPrincipalDeposited)

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

          callCreditLineMock = mock({
            blockchain,
            call: {
              to: tranchedPool.creditLine.address,
              api: await getCreditLineAbi(),
              method: "interestAccruedAsOf",
              params: [],
              return: drawdownTime.toString(10),
            },
          })
        })

        it("should return the correct backers-only and senior-pool-matching APY-from-GFI values", async () => {
          const tranchedPools = [tranchedPool]

          const tranchedPoolScheduledRepayments = await tranchedPool.getOptimisticRepaymentSchedule(currentBlock)
          expect(
            tranchedPoolScheduledRepayments.map((scheduled) => ({
              timestamp: scheduled.timestamp,
              usdcAmount: scheduled.usdcAmount.toString(),
            }))
          ).toEqual(
            openTranchedPoolExpectedRepaymentSchedule.map((repayment) => ({
              // Here we shift-forward the repayment schedule timestamps expected for the case where the pool is
              // open (i.e. where the borrowing is assumed to start one week from the `currentBlock` time). The
              // pool isn't open; we expect the borrowing to start at the `currentBlock` time.
              timestamp: repayment.timestamp - 7 * utils.SECONDS_PER_DAY,
              usdcAmount: repayment.usdcAmount,
            }))
          )

          const estimatedRewards = await backerRewards._estimateRewardsFromScheduledRepayments(
            tranchedPools,
            gfi.info.value.supply,
            currentBlock
          )
          expect(estimatedRewards[tranchedPool.address]?.value.toString(10)).toEqual(
            tranchedPoolExpectedEstimatedRewards
          )

          const result = await backerRewards.estimateApyFromGfiByTranchedPool(tranchedPools, seniorPool, gfi)
          expect(Object.keys(result)).toEqual([tranchedPoolAddress])
          const tranchedPoolResult = result[tranchedPoolAddress]
          expect(tranchedPoolResult).toBeTruthy()
          assertNonNullable(tranchedPoolResult)
          expect(Object.keys(tranchedPoolResult)).toEqual(["backersOnly", "seniorPoolMatching"])
          expect(tranchedPoolResult.backersOnly?.toString()).toEqual(tranchedPoolExpectedBackersOnlyApy)
          expect(tranchedPoolResult.seniorPoolMatching?.toString()).toEqual(tranchedPoolExpectedSeniorPoolMatchingApy)

          assertAllMocksAreCalled({callBackerRewardsPoolsMock, callCreditLineMock})
        })
      })
    })

    describe("if three tranched pools are eligible for backer rewards", () => {
      describe("and all of those pools are open for the first time", () => {
        const tranchedPool1Address = "0x0000000000000000000000000000000000000099"
        let tranchedPool1: TranchedPool

        const tranchedPool2Address = "0x0000000000000000000000000000000000000097"
        let tranchedPool2: TranchedPool

        const tranchedPool3Address = "0x0000000000000000000000000000000000000095"
        let tranchedPool3: TranchedPool

        let callBackerRewardsPoolsMock1: () => void
        let callBackerRewardsPoolsMock2: () => void
        let callBackerRewardsPoolsMock3: () => void

        beforeEach(async () => {
          tranchedPool1 = new TranchedPool(tranchedPool1Address, goldfinchProtocol)

          tranchedPool1.creditLine = new CreditLine("0x0000000000000000000000000000000000000098", goldfinchProtocol)
          tranchedPool1.creditLine.isLate = false
          tranchedPool1.creditLine.termEndTime = new BigNumber(0)
          tranchedPool1.creditLine.termStartTime = new BigNumber(0)
          tranchedPool1.creditLine.maxLimit = new BigNumber(1e7).multipliedBy(utils.USDC_DECIMALS.toString(10))
          tranchedPool1.creditLine.termInDays = new BigNumber(3 * 365)
          tranchedPool1.creditLine.paymentPeriodInDays = new BigNumber(30)
          tranchedPool1.creditLine.interestApr = new BigNumber(0.1).multipliedBy(utils.INTEREST_DECIMALS.toString(10))

          tranchedPool1.poolState = PoolState.Open
          tranchedPool1.totalDeployed = new BigNumber(0)
          const juniorPrincipalDeposited1 = new BigNumber(0)
          tranchedPool1.juniorTranche = {
            principalDeposited: juniorPrincipalDeposited1,
          } as TrancheInfo
          const seniorPrincipalDeposited1 = new BigNumber(0)
          tranchedPool1.seniorTranche = {
            principalDeposited: seniorPrincipalDeposited1,
          } as TrancheInfo
          tranchedPool1.totalDeposited = juniorPrincipalDeposited1.plus(seniorPrincipalDeposited1)
          tranchedPool1.fundableAt = new BigNumber(currentBlock.timestamp)
          tranchedPool1.estimatedLeverageRatio = new BigNumber(3)
          tranchedPool1.metadata = {
            name: "Almavest Basket #6",
            category: "asdf",
            icon: "foo.png",
            description: "asdf",
            launchTime: currentBlock.timestamp,
            allowedUIDTypes: [0],
          }

          callBackerRewardsPoolsMock1 = mock({
            blockchain,
            call: {
              to: backerRewards.address,
              api: await getBackerRewardsAbi(),
              method: "pools",
              params: [tranchedPool1Address],
              return: "0",
            },
          })

          tranchedPool2 = new TranchedPool(tranchedPool2Address, goldfinchProtocol)

          tranchedPool2.creditLine = new CreditLine("0x0000000000000000000000000000000000000096", goldfinchProtocol)
          tranchedPool2.creditLine.isLate = false
          tranchedPool2.creditLine.termEndTime = new BigNumber(0)
          tranchedPool2.creditLine.termStartTime = new BigNumber(0)
          tranchedPool2.creditLine.maxLimit = new BigNumber(2e7).multipliedBy(utils.USDC_DECIMALS.toString(10))
          tranchedPool2.creditLine.termInDays = new BigNumber(4 * 365)
          tranchedPool2.creditLine.paymentPeriodInDays = new BigNumber(30)
          tranchedPool2.creditLine.interestApr = new BigNumber(0.11).multipliedBy(utils.INTEREST_DECIMALS.toString(10))

          tranchedPool2.poolState = PoolState.Open
          tranchedPool2.totalDeployed = new BigNumber(0)
          const juniorPrincipalDeposited2 = new BigNumber(0)
          tranchedPool2.juniorTranche = {
            principalDeposited: juniorPrincipalDeposited2,
          } as TrancheInfo
          const seniorPrincipalDeposited2 = new BigNumber(0)
          tranchedPool2.seniorTranche = {
            principalDeposited: seniorPrincipalDeposited2,
          } as TrancheInfo
          tranchedPool2.totalDeposited = juniorPrincipalDeposited2.plus(seniorPrincipalDeposited2)
          tranchedPool2.fundableAt = new BigNumber(currentBlock.timestamp)
          tranchedPool2.estimatedLeverageRatio = new BigNumber(3)
          tranchedPool2.metadata = {
            name: "Stratos #1",
            category: "asdf",
            icon: "foo.png",
            description: "asdf",
            launchTime: currentBlock.timestamp + 1,
            allowedUIDTypes: [0],
          }

          callBackerRewardsPoolsMock2 = mock({
            blockchain,
            call: {
              to: backerRewards.address,
              api: await getBackerRewardsAbi(),
              method: "pools",
              params: [tranchedPool2Address],
              return: "0",
            },
          })

          tranchedPool3 = new TranchedPool(tranchedPool3Address, goldfinchProtocol)

          tranchedPool3.creditLine = new CreditLine("0x0000000000000000000000000000000000000094", goldfinchProtocol)
          tranchedPool3.creditLine.isLate = false
          tranchedPool3.creditLine.termEndTime = new BigNumber(0)
          tranchedPool3.creditLine.termStartTime = new BigNumber(0)
          tranchedPool3.creditLine.maxLimit = new BigNumber(2e7).multipliedBy(utils.USDC_DECIMALS.toString(10))
          tranchedPool3.creditLine.termInDays = new BigNumber(3 * 365)
          tranchedPool3.creditLine.paymentPeriodInDays = new BigNumber(30)
          tranchedPool3.creditLine.interestApr = new BigNumber(0.1).multipliedBy(utils.INTEREST_DECIMALS.toString(10))

          tranchedPool3.poolState = PoolState.Open
          tranchedPool3.totalDeployed = new BigNumber(0)
          const juniorPrincipalDeposited3 = new BigNumber(0)
          tranchedPool3.juniorTranche = {
            principalDeposited: juniorPrincipalDeposited3,
          } as TrancheInfo
          const seniorPrincipalDeposited3 = new BigNumber(0)
          tranchedPool3.seniorTranche = {
            principalDeposited: seniorPrincipalDeposited3,
          } as TrancheInfo
          tranchedPool3.totalDeposited = juniorPrincipalDeposited3.plus(seniorPrincipalDeposited3)
          tranchedPool3.fundableAt = new BigNumber(currentBlock.timestamp)
          tranchedPool3.estimatedLeverageRatio = new BigNumber(3)
          tranchedPool3.metadata = {
            name: "Cauris #2",
            category: "asdf",
            icon: "foo.png",
            description: "asdf",
            launchTime: currentBlock.timestamp + 2,
            allowedUIDTypes: [0],
          }

          callBackerRewardsPoolsMock3 = mock({
            blockchain,
            call: {
              to: backerRewards.address,
              api: await getBackerRewardsAbi(),
              method: "pools",
              params: [tranchedPool3Address],
              return: "0",
            },
          })
        })

        it("should return the correct backers-only and senior-pool-matching APY-from-GFI values", async () => {
          // NOTE: The purpose of this test is specifically to establish that the frontend calculates estimated
          // APY-from-GFI correctly for Alma pool #6, Stratos pool #1, and Cauris pool #2, which are the first three
          // tranched pools eligible for rewards via the BackerRewards contract. The expected values can be
          // understood using this spreadsheet: https://docs.google.com/spreadsheets/d/1SkPDqmMXywdOjiclHHtVd-GlNUl_rvRYv8zIqdNcxak/edit#gid=0

          const tranchedPools = [tranchedPool1, tranchedPool2, tranchedPool3]

          const tranchedPool1ScheduledRepayments = await tranchedPool1.getOptimisticRepaymentSchedule(currentBlock)
          expect(
            tranchedPool1ScheduledRepayments.map((scheduled) => ({
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

          const tranchedPool2ScheduledRepayments = await tranchedPool2.getOptimisticRepaymentSchedule(currentBlock)
          expect(
            tranchedPool2ScheduledRepayments.map((scheduled) => ({
              timestamp: scheduled.timestamp,
              usdcAmount: scheduled.usdcAmount.toString(),
            }))
          ).toEqual([
            {
              timestamp: 1643980291,
              usdcAmount: "180821917808.21917808219178082192",
            },
            {
              timestamp: 1646572291,
              usdcAmount: "180821917808.21917808219178082192",
            },
            {
              timestamp: 1649164291,
              usdcAmount: "180821917808.21917808219178082192",
            },
            {
              timestamp: 1651756291,
              usdcAmount: "180821917808.21917808219178082192",
            },
            {
              timestamp: 1654348291,
              usdcAmount: "180821917808.21917808219178082192",
            },
            {
              timestamp: 1656940291,
              usdcAmount: "180821917808.21917808219178082192",
            },
            {
              timestamp: 1659532291,
              usdcAmount: "180821917808.21917808219178082192",
            },
            {
              timestamp: 1662124291,
              usdcAmount: "180821917808.21917808219178082192",
            },
            {
              timestamp: 1664716291,
              usdcAmount: "180821917808.21917808219178082192",
            },
            {
              timestamp: 1667308291,
              usdcAmount: "180821917808.21917808219178082192",
            },
            {
              timestamp: 1669900291,
              usdcAmount: "180821917808.21917808219178082192",
            },
            {
              timestamp: 1672492291,
              usdcAmount: "180821917808.21917808219178082192",
            },
            {
              timestamp: 1675084291,
              usdcAmount: "180821917808.21917808219178082192",
            },
            {
              timestamp: 1677676291,
              usdcAmount: "180821917808.21917808219178082192",
            },
            {
              timestamp: 1680268291,
              usdcAmount: "180821917808.21917808219178082192",
            },
            {
              timestamp: 1682860291,
              usdcAmount: "180821917808.21917808219178082192",
            },
            {
              timestamp: 1685452291,
              usdcAmount: "180821917808.21917808219178082192",
            },
            {
              timestamp: 1688044291,
              usdcAmount: "180821917808.21917808219178082192",
            },
            {
              timestamp: 1690636291,
              usdcAmount: "180821917808.21917808219178082192",
            },
            {
              timestamp: 1693228291,
              usdcAmount: "180821917808.21917808219178082192",
            },
            {
              timestamp: 1695820291,
              usdcAmount: "180821917808.21917808219178082192",
            },
            {
              timestamp: 1698412291,
              usdcAmount: "180821917808.21917808219178082192",
            },
            {
              timestamp: 1701004291,
              usdcAmount: "180821917808.21917808219178082192",
            },
            {
              timestamp: 1703596291,
              usdcAmount: "180821917808.21917808219178082192",
            },
            {
              timestamp: 1706188291,
              usdcAmount: "180821917808.21917808219178082192",
            },
            {
              timestamp: 1708780291,
              usdcAmount: "180821917808.21917808219178082192",
            },
            {
              timestamp: 1711372291,
              usdcAmount: "180821917808.21917808219178082192",
            },
            {
              timestamp: 1713964291,
              usdcAmount: "180821917808.21917808219178082192",
            },
            {
              timestamp: 1716556291,
              usdcAmount: "180821917808.21917808219178082192",
            },
            {
              timestamp: 1719148291,
              usdcAmount: "180821917808.21917808219178082192",
            },
            {
              timestamp: 1721740291,
              usdcAmount: "180821917808.21917808219178082192",
            },
            {
              timestamp: 1724332291,
              usdcAmount: "180821917808.21917808219178082192",
            },
            {
              timestamp: 1726924291,
              usdcAmount: "180821917808.21917808219178082192",
            },
            {
              timestamp: 1729516291,
              usdcAmount: "180821917808.21917808219178082192",
            },
            {
              timestamp: 1732108291,
              usdcAmount: "180821917808.21917808219178082192",
            },
            {
              timestamp: 1734700291,
              usdcAmount: "180821917808.21917808219178082192",
            },
            {
              timestamp: 1737292291,
              usdcAmount: "180821917808.21917808219178082192",
            },
            {
              timestamp: 1739884291,
              usdcAmount: "180821917808.21917808219178082192",
            },
            {
              timestamp: 1742476291,
              usdcAmount: "180821917808.21917808219178082192",
            },
            {
              timestamp: 1745068291,
              usdcAmount: "180821917808.21917808219178082192",
            },
            {
              timestamp: 1747660291,
              usdcAmount: "180821917808.21917808219178082192",
            },
            {
              timestamp: 1750252291,
              usdcAmount: "180821917808.21917808219178082192",
            },
            {
              timestamp: 1752844291,
              usdcAmount: "180821917808.21917808219178082192",
            },
            {
              timestamp: 1755436291,
              usdcAmount: "180821917808.21917808219178082192",
            },
            {
              timestamp: 1758028291,
              usdcAmount: "180821917808.21917808219178082192",
            },
            {
              timestamp: 1760620291,
              usdcAmount: "180821917808.21917808219178082192",
            },
            {
              timestamp: 1763212291,
              usdcAmount: "180821917808.21917808219178082192",
            },
            {
              timestamp: 1765804291,
              usdcAmount: "180821917808.21917808219178082192",
            },
            {
              timestamp: 1767532291,
              usdcAmount: "120547945205.47945205479452054795",
            },
          ])

          const tranchedPool3ScheduledRepayments = await tranchedPool3.getOptimisticRepaymentSchedule(currentBlock)
          expect(
            tranchedPool3ScheduledRepayments.map((scheduled) => ({
              timestamp: scheduled.timestamp,
              usdcAmount: scheduled.usdcAmount.toString(),
            }))
          ).toEqual([
            {
              timestamp: 1643980291,
              usdcAmount: "164383561643.83561643835616438356",
            },
            {
              timestamp: 1646572291,
              usdcAmount: "164383561643.83561643835616438356",
            },
            {
              timestamp: 1649164291,
              usdcAmount: "164383561643.83561643835616438356",
            },
            {
              timestamp: 1651756291,
              usdcAmount: "164383561643.83561643835616438356",
            },
            {
              timestamp: 1654348291,
              usdcAmount: "164383561643.83561643835616438356",
            },
            {
              timestamp: 1656940291,
              usdcAmount: "164383561643.83561643835616438356",
            },
            {
              timestamp: 1659532291,
              usdcAmount: "164383561643.83561643835616438356",
            },
            {
              timestamp: 1662124291,
              usdcAmount: "164383561643.83561643835616438356",
            },
            {
              timestamp: 1664716291,
              usdcAmount: "164383561643.83561643835616438356",
            },
            {
              timestamp: 1667308291,
              usdcAmount: "164383561643.83561643835616438356",
            },
            {
              timestamp: 1669900291,
              usdcAmount: "164383561643.83561643835616438356",
            },
            {
              timestamp: 1672492291,
              usdcAmount: "164383561643.83561643835616438356",
            },
            {
              timestamp: 1675084291,
              usdcAmount: "164383561643.83561643835616438356",
            },
            {
              timestamp: 1677676291,
              usdcAmount: "164383561643.83561643835616438356",
            },
            {
              timestamp: 1680268291,
              usdcAmount: "164383561643.83561643835616438356",
            },
            {
              timestamp: 1682860291,
              usdcAmount: "164383561643.83561643835616438356",
            },
            {
              timestamp: 1685452291,
              usdcAmount: "164383561643.83561643835616438356",
            },
            {
              timestamp: 1688044291,
              usdcAmount: "164383561643.83561643835616438356",
            },
            {
              timestamp: 1690636291,
              usdcAmount: "164383561643.83561643835616438356",
            },
            {
              timestamp: 1693228291,
              usdcAmount: "164383561643.83561643835616438356",
            },
            {
              timestamp: 1695820291,
              usdcAmount: "164383561643.83561643835616438356",
            },
            {
              timestamp: 1698412291,
              usdcAmount: "164383561643.83561643835616438356",
            },
            {
              timestamp: 1701004291,
              usdcAmount: "164383561643.83561643835616438356",
            },
            {
              timestamp: 1703596291,
              usdcAmount: "164383561643.83561643835616438356",
            },
            {
              timestamp: 1706188291,
              usdcAmount: "164383561643.83561643835616438356",
            },
            {
              timestamp: 1708780291,
              usdcAmount: "164383561643.83561643835616438356",
            },
            {
              timestamp: 1711372291,
              usdcAmount: "164383561643.83561643835616438356",
            },
            {
              timestamp: 1713964291,
              usdcAmount: "164383561643.83561643835616438356",
            },
            {
              timestamp: 1716556291,
              usdcAmount: "164383561643.83561643835616438356",
            },
            {
              timestamp: 1719148291,
              usdcAmount: "164383561643.83561643835616438356",
            },
            {
              timestamp: 1721740291,
              usdcAmount: "164383561643.83561643835616438356",
            },
            {
              timestamp: 1724332291,
              usdcAmount: "164383561643.83561643835616438356",
            },
            {
              timestamp: 1726924291,
              usdcAmount: "164383561643.83561643835616438356",
            },
            {
              timestamp: 1729516291,
              usdcAmount: "164383561643.83561643835616438356",
            },
            {
              timestamp: 1732108291,
              usdcAmount: "164383561643.83561643835616438356",
            },
            {
              timestamp: 1734700291,
              usdcAmount: "164383561643.83561643835616438356",
            },
            {
              timestamp: 1735996291,
              usdcAmount: "82191780821.91780821917808219178",
            },
          ])

          const estimatedRewards = await backerRewards._estimateRewardsFromScheduledRepayments(
            tranchedPools,
            gfi.info.value.supply,
            currentBlock
          )
          expect(estimatedRewards[tranchedPool1.address]?.value.toString(10)).toEqual("215470472976237987641286")
          expect(estimatedRewards[tranchedPool2.address]?.value.toString(10)).toEqual("434013349470995195038500")
          expect(estimatedRewards[tranchedPool3.address]?.value.toString(10)).toEqual("314860088729510347636920")

          const result = await backerRewards.estimateApyFromGfiByTranchedPool(tranchedPools, seniorPool, gfi)
          expect(Object.keys(result)).toEqual([tranchedPool1Address, tranchedPool2Address, tranchedPool3Address])

          const tranchedPool1Result = result[tranchedPool1Address]
          expect(tranchedPool1Result).toBeTruthy()
          assertNonNullable(tranchedPool1Result)
          expect(Object.keys(tranchedPool1Result)).toEqual(["backersOnly", "seniorPoolMatching"])
          expect(tranchedPool1Result.backersOnly?.toString()).toEqual("0.11664134937113683064")
          expect(tranchedPool1Result.seniorPoolMatching?.toString()).toEqual("0.37")

          const tranchedPool2Result = result[tranchedPool2Address]
          expect(tranchedPool2Result).toBeTruthy()
          assertNonNullable(tranchedPool2Result)
          expect(Object.keys(tranchedPool2Result)).toEqual(["backersOnly", "seniorPoolMatching"])
          expect(tranchedPool2Result.backersOnly?.toString()).toEqual("0.08810470994261202459")
          expect(tranchedPool2Result.seniorPoolMatching?.toString()).toEqual("0.37")

          const tranchedPool3Result = result[tranchedPool3Address]
          expect(tranchedPool3Result).toBeTruthy()
          assertNonNullable(tranchedPool3Result)
          expect(Object.keys(tranchedPool3Result)).toEqual(["backersOnly", "seniorPoolMatching"])
          expect(tranchedPool3Result.backersOnly?.toString()).toEqual("0.08522213068278746743")
          expect(tranchedPool3Result.seniorPoolMatching?.toString()).toEqual("0.37")

          assertAllMocksAreCalled({
            callBackerRewardsPoolsMock1,
            callBackerRewardsPoolsMock2,
            callBackerRewardsPoolsMock3,
          })
        })
      })

      describe("and all of those pools filled up and were drawndown", () => {
        // TODO
      })
    })
  })
})
