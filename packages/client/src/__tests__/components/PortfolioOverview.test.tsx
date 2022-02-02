import "@testing-library/jest-dom"
import {render, screen} from "@testing-library/react"
import {BigNumber} from "bignumber.js"
import {mock} from "depay-web3-mock"
import {BrowserRouter as Router} from "react-router-dom"
import sinon from "sinon"
import {AppContext} from "../../App"
import PortfolioOverview from "../../components/Earn/PortfolioOverview"
import {GFILoaded} from "../../ethereum/gfi"
import {GoldfinchProtocol} from "../../ethereum/GoldfinchProtocol"
import {
  CapitalProvider,
  fetchCapitalProviderData,
  mockGetWeightedAverageSharePrice,
  PoolData,
  SeniorPool,
  SeniorPoolLoaded,
  StakingRewardsLoaded,
} from "../../ethereum/pool"
import {PoolBacker, TranchedPool} from "../../ethereum/tranchedPool"
import {UserLoaded} from "../../ethereum/user"
import * as utils from "../../ethereum/utils"
import {assertWithLoadedInfo, Loaded} from "../../types/loadable"
import {BlockInfo} from "../../utils"
import web3 from "../../web3"
import {defaultCurrentBlock, getDeployments, network} from "../rewards/__utils__/constants"
import {toDisplayPercent} from "../rewards/__utils__/display"
import {mockCapitalProviderCalls, resetAirdropMocks} from "../rewards/__utils__/mocks"
import {
  prepareBaseDeps,
  prepareUserRelatedDeps,
  setupClaimableStakingReward,
  setupNewStakingReward,
  setupPartiallyClaimedStakingReward,
} from "../rewards/__utils__/scenarios"

mock({
  blockchain: "ethereum",
})

web3.readOnly.setProvider((global.window as any).ethereum)
web3.userWallet.setProvider((global.window as any).ethereum)

function renderPortfolioOverview(
  poolData: Partial<PoolData>,
  capitalProvider: Loaded<CapitalProvider>,
  poolBackers: Loaded<PoolBacker[]> | undefined,
  currentBlock: BlockInfo
) {
  const store = {currentBlock}
  const defaultPoolBackers: Loaded<PoolBacker[]> = {
    loaded: true,
    value: [
      {
        balanceInDollars: new BigNumber(0),
        unrealizedGainsInDollars: new BigNumber(0),
        tranchedPool: {
          estimateJuniorAPY: (v) => {
            return new BigNumber("0.085")
          },
          estimatedLeverageRatio: new BigNumber(4),
        },
      } as PoolBacker,
    ],
  }
  return render(
    <AppContext.Provider value={store}>
      <Router>
        <PortfolioOverview
          poolData={poolData as PoolData}
          capitalProvider={capitalProvider}
          poolBackers={poolBackers ? poolBackers : defaultPoolBackers}
        />
      </Router>
    </AppContext.Provider>
  )
}

describe("Earn page portfolio overview", () => {
  let sandbox = sinon.createSandbox()
  let seniorPool: SeniorPoolLoaded
  let goldfinchProtocol = new GoldfinchProtocol(network)
  let gfi: GFILoaded, stakingRewards: StakingRewardsLoaded, user: UserLoaded, capitalProvider: Loaded<CapitalProvider>
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
        poolData: {} as PoolData,
        isPaused: false,
      },
    }
    assertWithLoadedInfo(_seniorPoolLoaded)
    seniorPool = _seniorPoolLoaded
  })

  beforeEach(async () => {
    const currentBlock = defaultCurrentBlock
    const baseDeps = await prepareBaseDeps(goldfinchProtocol, currentBlock)
    gfi = baseDeps.gfi
    stakingRewards = baseDeps.stakingRewards
    const userRelatedDeps = await prepareUserRelatedDeps({goldfinchProtocol, seniorPool, ...baseDeps}, {currentBlock})
    user = userRelatedDeps.user

    await mockCapitalProviderCalls()
    capitalProvider = await fetchCapitalProviderData(seniorPool, stakingRewards, gfi, user)
  })

  afterEach(() => {
    sandbox.restore()
  })

  afterEach(() => {
    mockGetWeightedAverageSharePrice(undefined)
    jest.clearAllMocks()
  })

  it("shows partial portfolio, if capital provider data are defined but senior pool data and backers data are undefined", async () => {
    renderPortfolioOverview({}, capitalProvider, undefined, currentBlock)

    expect(screen.getByTestId("portfolio-total-balance").textContent).toEqual("$50.02")
    expect(screen.getByTestId("portfolio-est-growth").textContent).toEqual("$--.--")
    expect(screen.getByTestId("portfolio-total-balance-perc").textContent).toEqual("$0.02 (0.04%)")
    expect(screen.getByTestId("portfolio-est-growth-perc").textContent).toEqual("--.--% APY")

    // tooltip
    expect(
      await screen.getByText(
        "Includes the combined yield from supplying to the senior pool and borrower pools, plus GFI distributions:"
      )
    ).toBeInTheDocument()
    expect(screen.getByText("Pool APY")).toBeInTheDocument()
    expect(screen.getByTestId("tooltip-estimated-apy").textContent).toEqual("--.--%")
    expect(screen.getByTestId("tooltip-gfi-apy").textContent).toEqual("--.--%")
    expect(screen.getByTestId("tooltip-total-apy").textContent).toEqual("--.--%")
  })

  it("shows partial portfolio, if capital provider data and senior pool APY are defined but `estimatedApyFromGfi` and backers data are undefined", async () => {
    const poolData = {
      estimatedApy: new BigNumber("0.00483856000534281158"),
      estimatedApyFromGfi: undefined,
    }
    renderPortfolioOverview(poolData, capitalProvider, undefined, currentBlock)

    expect(screen.getByTestId("portfolio-total-balance").textContent).toEqual("$50.02")
    expect(screen.getByTestId("portfolio-est-growth").textContent).toEqual("$0.24")
    expect(screen.getByTestId("portfolio-total-balance-perc").textContent).toEqual("$0.02 (0.04%)")
    expect(screen.getByTestId("portfolio-est-growth-perc").textContent).toEqual("0.48% APY")

    // tooltip
    expect(
      await screen.getByText(
        "Includes the combined yield from supplying to the senior pool and borrower pools, plus GFI distributions:"
      )
    ).toBeInTheDocument()
    expect(screen.getByText("Pool APY")).toBeInTheDocument()
    expect(screen.getByTestId("tooltip-estimated-apy").textContent).toEqual("0.48%")
    expect(screen.getByTestId("tooltip-gfi-apy").textContent).toEqual("--.--%")
    expect(screen.getByTestId("tooltip-total-apy").textContent).toEqual("0.48%")
  })

  it("shows partial portfolio with senior pool and claimable staking reward", async () => {
    const {gfi, stakingRewards, user} = await setupClaimableStakingReward(goldfinchProtocol, seniorPool, currentBlock)

    await mockCapitalProviderCalls()
    const capitalProvider = await fetchCapitalProviderData(seniorPool, stakingRewards, gfi, user)

    const stakedSeniorPoolBalanceInDollars = capitalProvider.value.stakedSeniorPoolBalanceInDollars
    const totalSeniorPoolBalanceInDollars = capitalProvider.value.totalSeniorPoolBalanceInDollars
    expect(stakedSeniorPoolBalanceInDollars.toString(10)).toEqual("50022.830849")
    expect(totalSeniorPoolBalanceInDollars.toString(10)).toEqual("50072.853679849")

    const estimatedPoolApy = new BigNumber("0.00483856000534281158")
    const globalEstimatedApyFromGfi = new BigNumber("0.47282410048716433449")

    const poolData: Pick<PoolData, "estimatedApy" | "estimatedApyFromGfi"> = {
      estimatedApy: estimatedPoolApy,
      estimatedApyFromGfi: globalEstimatedApyFromGfi,
    }

    renderPortfolioOverview(poolData, capitalProvider, undefined, currentBlock)

    const expectedUserEstimatedApyFromGfi = globalEstimatedApyFromGfi
      .multipliedBy(stakedSeniorPoolBalanceInDollars)
      .dividedBy(totalSeniorPoolBalanceInDollars)
    const expectedApyFromGfi = expectedUserEstimatedApyFromGfi
    const expectedTotalApy = estimatedPoolApy.plus(expectedApyFromGfi)

    const expectedDisplayPoolApy = toDisplayPercent(estimatedPoolApy)
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
    expect(screen.getByText("Pool APY")).toBeInTheDocument()
    expect(screen.getByTestId("tooltip-estimated-apy").textContent).toEqual(expectedDisplayPoolApy)
    expect(screen.getByTestId("tooltip-gfi-apy").textContent).toEqual(expectedDisplayGfiApy)
    expect(screen.getByTestId("tooltip-total-apy").textContent).toEqual(expectedDisplayTotalApy)
  })

  it("shows partial portfolio with senior pool and vesting staking reward", async () => {
    const {gfi, stakingRewards, user} = await setupNewStakingReward(goldfinchProtocol, seniorPool, currentBlock)

    await mockCapitalProviderCalls()
    const capitalProvider = await fetchCapitalProviderData(seniorPool, stakingRewards, gfi, user)

    const stakedSeniorPoolBalanceInDollars = capitalProvider.value.stakedSeniorPoolBalanceInDollars
    const totalSeniorPoolBalanceInDollars = capitalProvider.value.totalSeniorPoolBalanceInDollars
    expect(stakedSeniorPoolBalanceInDollars.toString(10)).toEqual("50022.830849")
    expect(totalSeniorPoolBalanceInDollars.toString(10)).toEqual("50072.853679849")

    const estimatedPoolApy = new BigNumber("0.00483856000534281158")
    const globalEstimatedApyFromGfi = new BigNumber("0.47282410048716433449")

    const poolData: Pick<PoolData, "estimatedApy" | "estimatedApyFromGfi"> = {
      estimatedApy: estimatedPoolApy,
      estimatedApyFromGfi: globalEstimatedApyFromGfi,
    }

    renderPortfolioOverview(poolData, capitalProvider, undefined, currentBlock)

    const expectedUserEstimatedApyFromGfi = globalEstimatedApyFromGfi
      .multipliedBy(stakedSeniorPoolBalanceInDollars)
      .dividedBy(totalSeniorPoolBalanceInDollars)
    const expectedApyFromGfi = expectedUserEstimatedApyFromGfi
    const expectedTotalApy = estimatedPoolApy.plus(expectedApyFromGfi)

    const expectedDisplayPoolApy = toDisplayPercent(estimatedPoolApy)
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
    expect(screen.getByText("Pool APY")).toBeInTheDocument()
    expect(screen.getByTestId("tooltip-estimated-apy").textContent).toEqual(expectedDisplayPoolApy)
    expect(screen.getByTestId("tooltip-gfi-apy").textContent).toEqual(expectedDisplayGfiApy)
    expect(screen.getByTestId("tooltip-total-apy").textContent).toEqual(expectedDisplayTotalApy)
  })

  it("shows partial portfolio with senior pool and partially claimed staking reward", async () => {
    const {gfi, stakingRewards, user} = await setupPartiallyClaimedStakingReward(
      goldfinchProtocol,
      seniorPool,
      undefined,
      currentBlock
    )

    await mockCapitalProviderCalls()
    const capitalProvider = await fetchCapitalProviderData(seniorPool, stakingRewards, gfi, user)

    const stakedSeniorPoolBalanceInDollars = capitalProvider.value.stakedSeniorPoolBalanceInDollars
    const totalSeniorPoolBalanceInDollars = capitalProvider.value.totalSeniorPoolBalanceInDollars
    expect(stakedSeniorPoolBalanceInDollars.toString(10)).toEqual("50022.830849")
    expect(totalSeniorPoolBalanceInDollars.toString(10)).toEqual("50072.853679849")

    const estimatedPoolApy = new BigNumber("0.00483856000534281158")
    const globalEstimatedApyFromGfi = new BigNumber("0.47282410048716433449")

    const poolData: Pick<PoolData, "estimatedApy" | "estimatedApyFromGfi"> = {
      estimatedApy: estimatedPoolApy,
      estimatedApyFromGfi: globalEstimatedApyFromGfi,
    }

    renderPortfolioOverview(poolData, capitalProvider, undefined, currentBlock)

    const expectedUserEstimatedApyFromGfi = globalEstimatedApyFromGfi
      .multipliedBy(stakedSeniorPoolBalanceInDollars)
      .dividedBy(totalSeniorPoolBalanceInDollars)
    const expectedApyFromGfi = expectedUserEstimatedApyFromGfi
    const expectedTotalApy = estimatedPoolApy.plus(expectedApyFromGfi)

    const expectedDisplayPoolApy = toDisplayPercent(estimatedPoolApy)
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
    expect(screen.getByText("Pool APY")).toBeInTheDocument()
    expect(screen.getByTestId("tooltip-estimated-apy").textContent).toEqual(expectedDisplayPoolApy)
    expect(screen.getByTestId("tooltip-gfi-apy").textContent).toEqual(expectedDisplayGfiApy)
    expect(screen.getByTestId("tooltip-total-apy").textContent).toEqual(expectedDisplayTotalApy)
  })

  it("shows full portfolio with senior pool, claimable staking reward, and backers", async () => {
    const {gfi, stakingRewards, user} = await setupClaimableStakingReward(goldfinchProtocol, seniorPool, currentBlock)

    await mockCapitalProviderCalls()
    const capitalProvider = await fetchCapitalProviderData(seniorPool, stakingRewards, gfi, user)

    const stakedSeniorPoolBalanceInDollars = capitalProvider.value.stakedSeniorPoolBalanceInDollars
    const totalSeniorPoolBalanceInDollars = capitalProvider.value.totalSeniorPoolBalanceInDollars
    expect(stakedSeniorPoolBalanceInDollars.toString(10)).toEqual("50022.830849")
    expect(totalSeniorPoolBalanceInDollars.toString(10)).toEqual("50072.853679849")

    const estimatedPoolApy = new BigNumber("0.00483856000534281158")
    const globalEstimatedApyFromGfi = new BigNumber("0.47282410048716433449")

    const poolData: Pick<PoolData, "estimatedApy" | "estimatedApyFromGfi"> = {
      estimatedApy: estimatedPoolApy,
      estimatedApyFromGfi: globalEstimatedApyFromGfi,
    }

    const tranchedPoolBalanceInDollars = new BigNumber("10013.86")
    const estimatedTranchedPoolApy = new BigNumber("0.085")
    const poolBackers: Loaded<PoolBacker[]> = {
      loaded: true,
      value: [
        {
          balanceInDollars: tranchedPoolBalanceInDollars,
          unrealizedGainsInDollars: new BigNumber("13.86"),
          tranchedPool: {
            estimateJuniorAPY: (v) => {
              return estimatedTranchedPoolApy
            },
            estimatedLeverageRatio: new BigNumber(4),
          } as TranchedPool,
        } as PoolBacker,
      ],
    }

    renderPortfolioOverview(poolData, capitalProvider, poolBackers, currentBlock)

    const totalBalance = totalSeniorPoolBalanceInDollars.plus(tranchedPoolBalanceInDollars)

    const expectedApyFromSupplying = estimatedPoolApy
      .multipliedBy(totalSeniorPoolBalanceInDollars)
      .dividedBy(totalBalance)
      .plus(estimatedTranchedPoolApy.multipliedBy(tranchedPoolBalanceInDollars).dividedBy(totalBalance))

    const expectedUserEstimatedApyFromGfi = globalEstimatedApyFromGfi
      .multipliedBy(stakedSeniorPoolBalanceInDollars)
      .dividedBy(totalBalance)
    const expectedApyFromGfi = expectedUserEstimatedApyFromGfi

    const expectedTotalApy = expectedApyFromSupplying.plus(expectedApyFromGfi)

    const expectedDisplayGfiApy = toDisplayPercent(expectedApyFromGfi)
    const expectedDisplayTotalApy = toDisplayPercent(expectedTotalApy)

    expect(screen.getByTestId("portfolio-total-balance").textContent).toEqual("$60,086.71")
    expect(screen.getByTestId("portfolio-total-balance-perc").textContent).toEqual("$36.71 (0.06%)")

    expect(totalBalance.multipliedBy(expectedTotalApy).toString(10)).toEqual("24745.45860716869999977067")
    expect(screen.getByTestId("portfolio-est-growth").textContent).toEqual("$24,745.45")
    expect(expectedDisplayTotalApy).toEqual("41.18%")
    expect(screen.getByTestId("portfolio-est-growth-perc").textContent).toEqual(
      `${expectedDisplayTotalApy} APY (with GFI)`
    )

    // tooltip
    expect(
      await screen.getByText(
        "Includes the combined yield from supplying to the senior pool and borrower pools, plus GFI distributions:"
      )
    ).toBeInTheDocument()
    expect(screen.getByText("Pool APY")).toBeInTheDocument()
    expect(screen.getByTestId("tooltip-estimated-apy").textContent).toEqual("1.82%")
    expect(screen.getByTestId("tooltip-gfi-apy").textContent).toEqual(expectedDisplayGfiApy)
    expect(screen.getByTestId("tooltip-total-apy").textContent).toEqual("41.18%")
  })
})
