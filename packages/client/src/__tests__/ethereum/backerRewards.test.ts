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
    describe("if only one tranched pool is eligible for backer rewards", () => {
      describe("and that pool is open for the first time", () => {
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

        it("should return the correct backers-only and senior-pool-matching APY-from-GFI values", async () => {
          // NOTE: The purpose of this test is specifically to establish that the frontend calculates estimated
          // APY-from-GFI correctly for the Alma pool #6, which is the first (and only, as of its launch time)
          // tranched pool eligible for rewards via the BackerRewards contract. The expected values can be
          // understood using this spreadsheet: https://docs.google.com/spreadsheets/d/1PgnD1RpwnxqiNDoiShX7_Gjl2TdgBN36oPM8HysRzH8/edit#gid=0

          const result = await backerRewards.estimateApyFromGfiByTranchedPool([tranchedPool], seniorPool, gfi)
          expect(Object.keys(result)).toEqual([tranchedPoolAddress])
          const tranchedPoolResult = result[tranchedPoolAddress]
          expect(tranchedPoolResult).toBeTruthy()
          assertNonNullable(tranchedPoolResult)
          expect(Object.keys(tranchedPoolResult)).toEqual(["backersOnly", "seniorPoolMatching"])
          expect(tranchedPoolResult.backersOnly?.toString()).toEqual("0.2143")
          expect(tranchedPoolResult.seniorPoolMatching?.toString()).toEqual("0.37")

          assertAllMocksAreCalled({callBackerRewardsPoolsMock})
        })
      })
    })
  })
})
