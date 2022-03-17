import "@testing-library/jest-dom"
import {render, screen} from "@testing-library/react"
import {BigNumber} from "bignumber.js"
import {mock} from "depay-web3-mock"
import {BrowserRouter as Router} from "react-router-dom"
import sinon from "sinon"
import {AppContext} from "../../App"
import PortfolioOverview from "../../components/Earn/PortfolioOverview"
import {TranchedPoolsEstimatedApyFromGfi} from "../../components/Earn/types"
import {GoldfinchProtocol} from "../../ethereum/GoldfinchProtocol"
import {
  CapitalProvider,
  fetchCapitalProviderData,
  mockGetWeightedAverageSharePrice,
  SeniorPool,
  SeniorPoolData,
  SeniorPoolLoaded,
} from "../../ethereum/pool"
import {PoolState, TranchedPool, TranchedPoolBacker} from "../../ethereum/tranchedPool"
import * as utils from "../../ethereum/utils"
import {USDC_DECIMALS} from "../../ethereum/utils"
import {assertWithLoadedInfo, Loaded} from "../../types/loadable"
import {BlockInfo} from "../../utils"
import getWeb3 from "../../web3"
import {defaultCurrentBlock, getDeployments, network} from "../rewards/__utils__/constants"
import {toDisplayPercent} from "../rewards/__utils__/display"
import {mockCapitalProviderCalls, resetAirdropMocks} from "../rewards/__utils__/mocks"
import {setupClaimableStakingReward} from "../rewards/__utils__/scenarios"

mock({
  blockchain: "ethereum",
})

const web3 = getWeb3()
web3.readOnly.setProvider((global.window as any).ethereum)
web3.userWallet.setProvider((global.window as any).ethereum)

function renderPortfolioOverview(
  seniorPoolData: SeniorPoolData,
  capitalProvider: Loaded<CapitalProvider>,
  tranchedPoolBackers: Loaded<TranchedPoolBacker[]>,
  tranchedPoolsEstimatedApyFromGfi: Loaded<TranchedPoolsEstimatedApyFromGfi>,
  currentBlock: BlockInfo
) {
  const store = {currentBlock}
  return render(
    <AppContext.Provider value={store}>
      <Router>
        <PortfolioOverview
          seniorPoolData={seniorPoolData}
          capitalProvider={capitalProvider}
          tranchedPoolBackers={tranchedPoolBackers}
          tranchedPoolsEstimatedApyFromGfi={tranchedPoolsEstimatedApyFromGfi}
        />
      </Router>
    </AppContext.Provider>
  )
}

describe("Earn page portfolio overview", () => {
  let sandbox = sinon.createSandbox()
  let seniorPool: SeniorPoolLoaded
  let goldfinchProtocol = new GoldfinchProtocol(network)
  const currentBlock = defaultCurrentBlock

  beforeEach(async () => {
    jest.spyOn(utils, "getDeployments").mockImplementation(() => {
      return getDeployments()
    })
    resetAirdropMocks(goldfinchProtocol)

    await goldfinchProtocol.initialize()
    const _seniorPoolLoaded = new SeniorPool(goldfinchProtocol)
    _seniorPoolLoaded.info = {
      loaded: true,
      value: {
        currentBlock,
        poolData: {} as SeniorPoolData,
        isPaused: false,
      },
    }
    assertWithLoadedInfo(_seniorPoolLoaded)
    seniorPool = _seniorPoolLoaded
  })

  afterEach(() => {
    sandbox.restore()
  })

  afterEach(() => {
    mockGetWeightedAverageSharePrice(undefined)
    jest.clearAllMocks()
  })

  describe("for user who has supplied to the senior pool", () => {
    describe("and is staking in the senior pool", () => {
      describe("and is a tranched pool backer", () => {
        it("shows portfolio", async () => {
          const {gfi, stakingRewards, user} = await setupClaimableStakingReward(
            goldfinchProtocol,
            seniorPool,
            currentBlock
          )

          await mockCapitalProviderCalls()
          const capitalProvider = await fetchCapitalProviderData(seniorPool, stakingRewards, gfi, user)

          const stakedSeniorPoolBalanceInDollars = capitalProvider.value.stakedSeniorPoolBalanceInDollars
          const totalSeniorPoolBalanceInDollars = capitalProvider.value.totalSeniorPoolBalanceInDollars
          expect(stakedSeniorPoolBalanceInDollars.toString(10)).toEqual("50022.830849")
          expect(totalSeniorPoolBalanceInDollars.toString(10)).toEqual("50072.853679849")

          const estimatedSeniorPoolApy = new BigNumber("0.00483856000534281158")
          const globalEstimatedSeniorPoolApyFromGfi = new BigNumber("0.47282410048716433449")

          const poolData = {
            estimatedApy: estimatedSeniorPoolApy,
            estimatedApyFromGfi: globalEstimatedSeniorPoolApyFromGfi,
          } as SeniorPoolData

          const singleTranchedPoolPrincipalAmountInDollars = new BigNumber(10000)
          const singleTranchedPoolUnrealizedGainsInDollars = new BigNumber("13.86")
          const singleTranchedPoolBalanceInDollars = singleTranchedPoolPrincipalAmountInDollars.plus(
            singleTranchedPoolUnrealizedGainsInDollars
          )
          const singleTranchedPoolEstimatedApy = new BigNumber("0.085")
          const baseBacker = {
            principalAmount: singleTranchedPoolPrincipalAmountInDollars.multipliedBy(USDC_DECIMALS.toString()),
            principalRedeemed: new BigNumber(0).multipliedBy(USDC_DECIMALS.toString()),
            principalRedeemable: new BigNumber(0).multipliedBy(USDC_DECIMALS.toString()),
            principalAtRisk: singleTranchedPoolPrincipalAmountInDollars.multipliedBy(USDC_DECIMALS.toString()),
            balanceInDollars: singleTranchedPoolBalanceInDollars,
            unrealizedGainsInDollars: singleTranchedPoolUnrealizedGainsInDollars,
            tranchedPool: {
              estimateJuniorAPY: (v) => singleTranchedPoolEstimatedApy,
              estimatedLeverageRatio: new BigNumber(4),
            } as TranchedPool,
          }
          const singleTranchedPoolEstimatedBackersOnlyApyFromGfi = new BigNumber(1.25)

          const tranchedPool1Address = "0xasdf1"
          const tranchedPool2Address = "0xasdf2"
          const tranchedPool3Address = "0xasdf3"

          const poolBackers: Loaded<TranchedPoolBacker[]> = {
            loaded: true,
            value: [
              {
                ...baseBacker,
                tranchedPool: {
                  ...baseBacker.tranchedPool,
                  address: tranchedPool1Address,
                  poolState: PoolState.Open,
                },
              } as unknown as TranchedPoolBacker,
              {
                ...baseBacker,
                tranchedPool: {
                  ...baseBacker.tranchedPool,
                  address: tranchedPool2Address,
                  poolState: PoolState.SeniorLocked,
                },
              } as unknown as TranchedPoolBacker,
              {
                ...baseBacker,
                tranchedPool: {
                  ...baseBacker.tranchedPool,
                  address: tranchedPool3Address,
                  poolState: PoolState.SeniorLocked,
                },
              } as unknown as TranchedPoolBacker,
            ],
          }
          const tranchedPoolsEstimatedApyFromGfi: Loaded<TranchedPoolsEstimatedApyFromGfi> = {
            loaded: true,
            value: {
              currentBlock,
              estimatedApyFromGfi: {
                [tranchedPool1Address]: {
                  backersOnly: singleTranchedPoolEstimatedBackersOnlyApyFromGfi,
                  seniorPoolMatching: globalEstimatedSeniorPoolApyFromGfi,
                },
                [tranchedPool2Address]: {
                  backersOnly: singleTranchedPoolEstimatedBackersOnlyApyFromGfi,
                  seniorPoolMatching: globalEstimatedSeniorPoolApyFromGfi,
                },
                [tranchedPool3Address]: undefined,
              },
            },
          }

          renderPortfolioOverview(
            poolData,
            capitalProvider,
            poolBackers,
            tranchedPoolsEstimatedApyFromGfi,
            currentBlock
          )

          const estimatedTranchedPoolsApy = singleTranchedPoolEstimatedApy
          const totalTranchedPoolsBalanceInDollars = singleTranchedPoolBalanceInDollars.multipliedBy(3)

          const totalBalance = totalSeniorPoolBalanceInDollars.plus(totalTranchedPoolsBalanceInDollars)

          const expectedApyFromSupplying = estimatedSeniorPoolApy
            .multipliedBy(totalSeniorPoolBalanceInDollars)
            .dividedBy(totalBalance)
            .plus(estimatedTranchedPoolsApy.multipliedBy(totalTranchedPoolsBalanceInDollars).dividedBy(totalBalance))

          const expectedUserEstimatedApyFromGfiSeniorPool = globalEstimatedSeniorPoolApyFromGfi
            .multipliedBy(stakedSeniorPoolBalanceInDollars)
            .dividedBy(totalSeniorPoolBalanceInDollars)

          const singleTranchedPoolEstimatedApyFromGfi = singleTranchedPoolEstimatedBackersOnlyApyFromGfi.plus(
            globalEstimatedSeniorPoolApyFromGfi
          )
          const expectedUserEstimatedApyFromGfiTranchedPools = singleTranchedPoolEstimatedApyFromGfi
            .multipliedBy(singleTranchedPoolPrincipalAmountInDollars.multipliedBy(2))
            .dividedBy(singleTranchedPoolBalanceInDollars.multipliedBy(3))

          const expectedApyFromGfi = expectedUserEstimatedApyFromGfiSeniorPool
            .multipliedBy(totalSeniorPoolBalanceInDollars)
            .dividedBy(totalBalance)
            .plus(
              expectedUserEstimatedApyFromGfiTranchedPools
                .multipliedBy(totalTranchedPoolsBalanceInDollars)
                .dividedBy(totalBalance)
            )

          const expectedTotalApy = expectedApyFromSupplying.plus(expectedApyFromGfi)

          const expectedUnrealizedGainsSeniorPool = new BigNumber(22.85)
          const expectedUnrealizedGainsTranchedPools = singleTranchedPoolUnrealizedGainsInDollars.multipliedBy(3)
          const expectedTotalUnrealizedGains = expectedUnrealizedGainsSeniorPool.plus(
            expectedUnrealizedGainsTranchedPools
          )

          const expectedDisplayApyFromSupplying = toDisplayPercent(expectedApyFromSupplying)
          const expectedDisplayGfiApy = toDisplayPercent(expectedApyFromGfi)
          const expectedDisplayTotalApy = toDisplayPercent(expectedTotalApy)

          expect(totalBalance.toString(10)).toEqual("80114.433679849")
          expect(screen.getByTestId("portfolio-total-balance").textContent).toEqual("$80,114.43")

          expect(expectedTotalUnrealizedGains.toString(10)).toEqual("64.43")
          expect(expectedTotalUnrealizedGains.dividedBy(totalBalance).toString(10)).toEqual("0.00080422462021604392")
          expect(screen.getByTestId("portfolio-total-balance-perc").textContent).toEqual("$64.43 (0.08%)")

          expect(totalBalance.multipliedBy(expectedTotalApy).toString(10)).toEqual("60904.29681691198668899463")
          expect(screen.getByTestId("portfolio-est-growth").textContent).toEqual("$60,904.29")

          expect(expectedDisplayTotalApy).toEqual("76.02%")
          expect(screen.getByTestId("portfolio-est-growth-perc").textContent).toEqual(
            `${expectedDisplayTotalApy} APY (with GFI)`
          )

          // tooltip
          expect(
            await screen.getByText(
              "Includes the combined yield from supplying to the senior pool and borrower pools, plus GFI distributions:"
            )
          ).toBeInTheDocument()
          expect(screen.getAllByTestId("tooltip-row-label")[0]?.textContent).toEqual("Pools APY")
          expect(expectedDisplayApyFromSupplying).toEqual("3.49%")
          expect(screen.getAllByTestId("tooltip-row-value")[0]?.textContent).toEqual(expectedDisplayApyFromSupplying)

          expect(screen.getAllByTestId("tooltip-row-label")[1]?.textContent).toEqual("GFI Distribution APY")
          expect(expectedDisplayGfiApy).toEqual("72.53%")
          expect(screen.getAllByTestId("tooltip-row-value")[1]?.textContent).toEqual(expectedDisplayGfiApy)

          expect(screen.getByTestId("tooltip-total-apy").textContent).toEqual(expectedDisplayTotalApy)
        })

        describe("and if both senior pool's `estimatedApyFromGfi` and tranched pools' estimated APY-from-GFI are undefined", () => {
          it("shows portfolio, omitting growth due to APY-from-GFI", async () => {
            const {gfi, stakingRewards, user} = await setupClaimableStakingReward(
              goldfinchProtocol,
              seniorPool,
              currentBlock
            )

            await mockCapitalProviderCalls()
            const capitalProvider = await fetchCapitalProviderData(seniorPool, stakingRewards, gfi, user)

            const stakedSeniorPoolBalanceInDollars = capitalProvider.value.stakedSeniorPoolBalanceInDollars
            const totalSeniorPoolBalanceInDollars = capitalProvider.value.totalSeniorPoolBalanceInDollars
            expect(stakedSeniorPoolBalanceInDollars.toString(10)).toEqual("50022.830849")
            expect(totalSeniorPoolBalanceInDollars.toString(10)).toEqual("50072.853679849")

            const estimatedPoolApy = new BigNumber("0.00483856000534281158")

            const poolData = {
              estimatedApy: estimatedPoolApy,
              estimatedApyFromGfi: undefined,
            } as SeniorPoolData

            const singleTranchedPoolPrincipalAmountInDollars = new BigNumber(10000)
            const singleTranchedPoolUnrealizedGainsInDollars = new BigNumber("13.86")
            const singleTranchedPoolBalanceInDollars = singleTranchedPoolPrincipalAmountInDollars.plus(
              singleTranchedPoolUnrealizedGainsInDollars
            )
            const singleTranchedPoolEstimatedApy = new BigNumber("0.085")
            const baseBacker = {
              balanceInDollars: singleTranchedPoolBalanceInDollars,
              unrealizedGainsInDollars: singleTranchedPoolUnrealizedGainsInDollars,
              tranchedPool: {
                estimateJuniorAPY: (v) => singleTranchedPoolEstimatedApy,
                estimatedLeverageRatio: new BigNumber(4),
              } as TranchedPool,
            }

            const tranchedPoolAddress = "0xasdf"
            const poolBackers: Loaded<TranchedPoolBacker[]> = {
              loaded: true,
              value: [
                {
                  ...baseBacker,
                  tranchedPool: {
                    ...baseBacker.tranchedPool,
                    address: tranchedPoolAddress,
                  },
                } as TranchedPoolBacker,
              ],
            }
            const tranchedPoolsEstimatedApyFromGfi: Loaded<TranchedPoolsEstimatedApyFromGfi> = {
              loaded: true,
              value: {
                currentBlock,
                estimatedApyFromGfi: {
                  [tranchedPoolAddress]: {backersOnly: undefined, seniorPoolMatching: undefined},
                },
              },
            }

            renderPortfolioOverview(
              poolData,
              capitalProvider,
              poolBackers,
              tranchedPoolsEstimatedApyFromGfi,
              currentBlock
            )

            const estimatedTranchedPoolsApy = singleTranchedPoolEstimatedApy
            const totalTranchedPoolsBalanceInDollars = singleTranchedPoolBalanceInDollars

            const totalBalance = totalSeniorPoolBalanceInDollars.plus(totalTranchedPoolsBalanceInDollars)

            const expectedApyFromSupplying = estimatedPoolApy
              .multipliedBy(totalSeniorPoolBalanceInDollars)
              .dividedBy(totalBalance)
              .plus(estimatedTranchedPoolsApy.multipliedBy(totalTranchedPoolsBalanceInDollars).dividedBy(totalBalance))

            const expectedTotalApy = expectedApyFromSupplying

            const expectedUnrealizedGainsSeniorPool = new BigNumber(22.85)
            const expectedUnrealizedGainsTranchedPools = singleTranchedPoolUnrealizedGainsInDollars
            const expectedTotalUnrealizedGains = expectedUnrealizedGainsSeniorPool.plus(
              expectedUnrealizedGainsTranchedPools
            )

            const expectedDisplayApyFromSupplying = toDisplayPercent(expectedApyFromSupplying)
            const expectedDisplayTotalApy = toDisplayPercent(expectedTotalApy)

            expect(totalBalance.toString(10)).toEqual("60086.713679849")
            expect(screen.getByTestId("portfolio-total-balance").textContent).toEqual("$60,086.71")

            expect(expectedTotalUnrealizedGains.toString(10)).toEqual("36.71")
            expect(expectedTotalUnrealizedGains.dividedBy(totalBalance).toString(10)).toEqual("0.00061095037075244907")
            expect(screen.getByTestId("portfolio-total-balance-perc").textContent).toEqual("$36.71 (0.06%)")

            expect(totalBalance.multipliedBy(expectedTotalApy).toString(10)).toEqual("1093.45860716870000016195")
            expect(screen.getByTestId("portfolio-est-growth").textContent).toEqual("$1,093.45")

            expect(expectedDisplayTotalApy).toEqual("1.82%")
            expect(screen.getByTestId("portfolio-est-growth-perc").textContent).toEqual("1.82% APY")

            // tooltip
            expect(
              await screen.getByText(
                "Includes the combined yield from supplying to the senior pool and borrower pools, plus GFI distributions:"
              )
            ).toBeInTheDocument()
            expect(screen.getAllByTestId("tooltip-row-label")[0]?.textContent).toEqual("Pools APY")
            expect(expectedDisplayApyFromSupplying).toEqual("1.82%")
            expect(screen.getAllByTestId("tooltip-row-value")[0]?.textContent).toEqual(expectedDisplayApyFromSupplying)

            expect(screen.getAllByTestId("tooltip-row-label")[1]?.textContent).toEqual("GFI Distribution APY")
            expect(screen.getAllByTestId("tooltip-row-value")[1]?.textContent).toEqual("--.--%")

            expect(screen.getByTestId("tooltip-total-apy").textContent).toEqual(expectedDisplayTotalApy)
          })
        })

        describe("and if only senior pool's estimated APY-from-GFI is undefined", () => {
          it.skip("shows portfolio, omitting growth due to the senior pool's APY-from-GFI", async () => {
            // TODO
          })
        })

        describe("and if only tranched pools' estimated APY-from-GFI is undefined", () => {
          it.skip("shows portfolio, omitting growth due to the tranched pools' APY-from-GFI", async () => {
            // TODO
          })
        })

        describe("and if one of the backed tranched pools is open", () => {
          // TODO
        })
        describe("and if one of the backed tranched pools is not open", () => {
          // TODO
        })
      })
      describe("and is not a tranched pool backer", () => {
        it("shows portfolio", async () => {
          const {gfi, stakingRewards, user} = await setupClaimableStakingReward(
            goldfinchProtocol,
            seniorPool,
            currentBlock
          )

          await mockCapitalProviderCalls()
          const capitalProvider = await fetchCapitalProviderData(seniorPool, stakingRewards, gfi, user)

          const stakedSeniorPoolBalanceInDollars = capitalProvider.value.stakedSeniorPoolBalanceInDollars
          const totalSeniorPoolBalanceInDollars = capitalProvider.value.totalSeniorPoolBalanceInDollars
          expect(stakedSeniorPoolBalanceInDollars.toString(10)).toEqual("50022.830849")
          expect(totalSeniorPoolBalanceInDollars.toString(10)).toEqual("50072.853679849")

          const estimatedSeniorPoolApy = new BigNumber("0.00483856000534281158")
          const globalEstimatedSeniorPoolApyFromGfi = new BigNumber("0.47282410048716433449")

          const poolData = {
            estimatedApy: estimatedSeniorPoolApy,
            estimatedApyFromGfi: globalEstimatedSeniorPoolApyFromGfi,
          } as SeniorPoolData

          const tranchedPoolAddress = "0xasdf"
          const tranchedPoolBackers: Loaded<TranchedPoolBacker[]> = {
            loaded: true,
            value: [
              {
                balanceInDollars: new BigNumber(0),
                unrealizedGainsInDollars: new BigNumber(0),
                tranchedPool: {
                  address: tranchedPoolAddress,
                  estimateJuniorAPY: (v) => {
                    return new BigNumber("0.085")
                  },
                  estimatedLeverageRatio: new BigNumber(4),
                },
              } as TranchedPoolBacker,
            ],
          }
          const tranchedPoolsEstimatedApyFromGfi: Loaded<TranchedPoolsEstimatedApyFromGfi> = {
            loaded: true,
            value: {
              currentBlock,
              estimatedApyFromGfi: {
                [tranchedPoolAddress]: {
                  backersOnly: new BigNumber(1.25),
                  seniorPoolMatching: globalEstimatedSeniorPoolApyFromGfi,
                },
              },
            },
          }

          renderPortfolioOverview(
            poolData,
            capitalProvider,
            tranchedPoolBackers,
            tranchedPoolsEstimatedApyFromGfi,
            currentBlock
          )

          const expectedUserEstimatedApyFromGfi = globalEstimatedSeniorPoolApyFromGfi
            .multipliedBy(stakedSeniorPoolBalanceInDollars)
            .dividedBy(totalSeniorPoolBalanceInDollars)
          const expectedApyFromGfi = expectedUserEstimatedApyFromGfi
          const expectedTotalApy = estimatedSeniorPoolApy.plus(expectedApyFromGfi)

          const expectedDisplayPoolApy = toDisplayPercent(estimatedSeniorPoolApy)
          const expectedDisplayGfiApy = toDisplayPercent(expectedApyFromGfi)
          const expectedDisplayTotalApy = toDisplayPercent(expectedTotalApy)

          expect(screen.getByTestId("portfolio-total-balance").textContent).toEqual("$50,072.85")
          expect(screen.getByTestId("portfolio-total-balance-perc").textContent).toEqual("$22.85 (0.05%)")

          expect(totalSeniorPoolBalanceInDollars.multipliedBy(expectedTotalApy).toString(10)).toEqual(
            "23894.28050716869999971224"
          )
          expect(screen.getByTestId("portfolio-est-growth").textContent).toEqual("$23,894.28")
          expect(expectedDisplayTotalApy).toEqual("47.72%")
          expect(screen.getByTestId("portfolio-est-growth-perc").textContent).toEqual(
            `${expectedDisplayTotalApy} APY (with GFI)`
          )

          // tooltip
          expect(
            await screen.getByText(
              "Includes the combined yield from supplying to the senior pool and borrower pools, plus GFI distributions:"
            )
          ).toBeInTheDocument()
          expect(screen.getAllByTestId("tooltip-row-label")[0]?.textContent).toEqual("Pools APY")
          expect(screen.getAllByTestId("tooltip-row-value")[0]?.textContent).toEqual(expectedDisplayPoolApy)

          expect(screen.getAllByTestId("tooltip-row-label")[1]?.textContent).toEqual("GFI Distribution APY")
          expect(screen.getAllByTestId("tooltip-row-value")[1]?.textContent).toEqual(expectedDisplayGfiApy)

          expect(screen.getByTestId("tooltip-total-apy").textContent).toEqual(expectedDisplayTotalApy)
        })
      })
    })
    describe("and is not staking in the senior pool", () => {
      describe("and is a tranched pool backer", () => {
        it.skip("shows portfolio", async () => {
          // TODO
        })
      })
      describe("and is not a tranched pool backer", () => {
        it.skip("shows portfolio", async () => {
          // TODO
        })
      })
    })
  })

  describe("for user who has not supplied to the senior pool", () => {
    describe("and is a tranched pool backer", () => {
      it.skip("shows portfolio", async () => {
        // TODO
      })
    })
    describe("and is not a tranched pool backer", () => {
      it.skip("shows portfolio", async () => {
        // TODO
      })
    })
  })
})
