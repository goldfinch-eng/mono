import "@testing-library/jest-dom"
import {mock} from "depay-web3-mock"
import {BigNumber} from "bignumber.js"
import {BrowserRouter as Router} from "react-router-dom"
import {render, screen} from "@testing-library/react"
import {AppContext} from "../../App"
import web3 from "../../web3"
import {
  CapitalProvider,
  fetchCapitalProviderData,
  mockGetWeightedAverageSharePrice,
  PoolData,
  SeniorPool,
  SeniorPoolLoaded,
  StakingRewardsLoaded,
} from "../../ethereum/pool"
import {User, UserLoaded} from "../../ethereum/user"
import {blockInfo, getDeployments, network, recipient} from "../rewards/__utils__/constants"
import {GoldfinchProtocol} from "../../ethereum/GoldfinchProtocol"
import {
  getDefaultClasses,
  setupClaimableStakingReward,
  setupNewStakingReward,
  setupPartiallyClaimedStakingReward,
} from "../rewards/__utils__/scenarios"
import {assertWithLoadedInfo, Loaded} from "../../types/loadable"
import {
  mockCapitalProviderCalls,
  mockUserInitializationContractCalls,
  setupMocksForAirdrop,
} from "../rewards/__utils__/mocks"
import * as utils from "../../ethereum/utils"
import {PortfolioOverview} from "../../components/earn"
import {CommunityRewardsLoaded, MerkleDistributorLoaded} from "../../ethereum/communityRewards"
import {GFILoaded} from "../../ethereum/gfi"
import {CreditDesk} from "@goldfinch-eng/protocol/typechain/web3/CreditDesk"
import {PoolBacker, TranchedPool} from "../../ethereum/tranchedPool"
import {toDisplayPercent} from "../rewards/__utils__/display"

mock({
  blockchain: "ethereum",
})

web3.setProvider((global.window as any).ethereum)

function renderPortfolioOverview(
  poolData: Partial<PoolData>,
  capitalProvider: Loaded<CapitalProvider>,
  poolBackers?: Loaded<PoolBacker[]>
) {
  const store = {}
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
  let seniorPool: SeniorPoolLoaded
  let goldfinchProtocol = new GoldfinchProtocol(network)
  let gfi: GFILoaded,
    stakingRewards: StakingRewardsLoaded,
    communityRewards: CommunityRewardsLoaded,
    merkleDistributor: MerkleDistributorLoaded,
    user: User | UserLoaded,
    capitalProvider: Loaded<CapitalProvider>

  beforeEach(async () => {
    jest.spyOn(utils, "getDeployments").mockImplementation(() => {
      return getDeployments()
    })
    setupMocksForAirdrop(undefined) // reset

    await goldfinchProtocol.initialize()
    const _seniorPoolLoaded = new SeniorPool(goldfinchProtocol)
    _seniorPoolLoaded.info = {
      loaded: true,
      value: {
        currentBlock: blockInfo,
        poolData: {} as PoolData,
        isPaused: false,
      },
    }
    assertWithLoadedInfo(_seniorPoolLoaded)
    seniorPool = _seniorPoolLoaded
  })

  beforeEach(async () => {
    const result = await getDefaultClasses(goldfinchProtocol)
    gfi = result.gfi
    stakingRewards = result.stakingRewards
    communityRewards = result.communityRewards
    merkleDistributor = result.merkleDistributor

    user = new User(recipient, network.name, undefined as unknown as CreditDesk, goldfinchProtocol, undefined)
    await mockUserInitializationContractCalls(user, stakingRewards, gfi, communityRewards, merkleDistributor, {})
    await user.initialize(seniorPool, stakingRewards, gfi, communityRewards, merkleDistributor, blockInfo)

    assertWithLoadedInfo(user)
    assertWithLoadedInfo(seniorPool)

    await mockCapitalProviderCalls()
    capitalProvider = await fetchCapitalProviderData(seniorPool, stakingRewards, gfi, user)
  })

  afterEach(() => {
    mockGetWeightedAverageSharePrice(undefined)
    jest.clearAllMocks()
  })

  it("shows portfolio with empty info", async () => {
    renderPortfolioOverview({}, capitalProvider)

    expect(screen.getByTestId("portfolio-total-balance").textContent).toEqual("$50.02")
    expect(screen.getByTestId("portfolio-est-growth").textContent).toEqual("$--.--")
    expect(screen.getByTestId("portfolio-total-balance-perc").textContent).toEqual("$0.02 (0.04%)")
    expect(screen.getByTestId("portfolio-est-growth-perc").textContent).toEqual("--.--% APY")

    // tooltip
    expect(
      await screen.getByText(
        "Includes the combined yield from supplying to the senior pool and borrower pools, plus GFI rewards:"
      )
    ).toBeInTheDocument()
    expect(screen.getByText("Pool APY")).toBeInTheDocument()
    expect(screen.getByTestId("tooltip-estimated-apy").textContent).toEqual("--.--%")
    expect(screen.getByTestId("tooltip-gfi-apy").textContent).toEqual("--.--%")
    expect(screen.getByTestId("tooltip-total-apy").textContent).toEqual("--.--%")
  })

  it("shows portfolio only with senior pool info", async () => {
    const poolData = {
      estimatedApy: new BigNumber("0.00483856000534281158"),
      estimatedApyFromGfi: new BigNumber("0"),
    }
    renderPortfolioOverview(poolData, capitalProvider)

    expect(screen.getByTestId("portfolio-total-balance").textContent).toEqual("$50.02")
    expect(screen.getByTestId("portfolio-est-growth").textContent).toEqual("$0.24")
    expect(screen.getByTestId("portfolio-total-balance-perc").textContent).toEqual("$0.02 (0.04%)")
    expect(screen.getByTestId("portfolio-est-growth-perc").textContent).toEqual("0.48% APY")

    // tooltip
    expect(
      await screen.getByText(
        "Includes the combined yield from supplying to the senior pool and borrower pools, plus GFI rewards:"
      )
    ).toBeInTheDocument()
    expect(screen.getByText("Pool APY")).toBeInTheDocument()
    expect(screen.getByTestId("tooltip-estimated-apy").textContent).toEqual("0.48%")
    expect(screen.getByTestId("tooltip-gfi-apy").textContent).toEqual("0.00%")
    expect(screen.getByTestId("tooltip-total-apy").textContent).toEqual("0.48%")
  })

  it("shows portfolio with senior pool and claimable staking reward", async () => {
    const {gfi, stakingRewards, user} = await setupClaimableStakingReward(goldfinchProtocol, seniorPool)

    await mockCapitalProviderCalls()
    const capitalProvider = await fetchCapitalProviderData(seniorPool, stakingRewards, gfi, user)

    const stakedSeniorPoolBalanceInDollars = capitalProvider.value.stakedSeniorPoolBalanceInDollars
    const totalSeniorPoolBalanceInDollars = capitalProvider.value.totalSeniorPoolBalanceInDollars
    expect(stakedSeniorPoolBalanceInDollars.lt(totalSeniorPoolBalanceInDollars)).toEqual(true)

    const globalEstimatedApyFromGfi = new BigNumber("0.47282410048716433449")
    const expectedUserEstimatedApyFromGfi = globalEstimatedApyFromGfi
      .multipliedBy(stakedSeniorPoolBalanceInDollars)
      .dividedBy(totalSeniorPoolBalanceInDollars)

    const estimatedPoolApy = new BigNumber("0.00483856000534281158")

    const poolData = {
      estimatedApy: estimatedPoolApy,
      estimatedApyFromGfi: globalEstimatedApyFromGfi,
    }
    renderPortfolioOverview(poolData, capitalProvider)

    const expectedDisplayPoolApy = toDisplayPercent(estimatedPoolApy)
    const expectedDisplayGfiApy = toDisplayPercent(expectedUserEstimatedApyFromGfi)
    const expectedDisplayTotalApy = toDisplayPercent(estimatedPoolApy.plus(expectedUserEstimatedApyFromGfi))

    expect(screen.getByTestId("portfolio-total-balance").textContent).toEqual("$50,072.85")
    expect(screen.getByTestId("portfolio-est-growth").textContent).toEqual("$242.28")
    expect(screen.getByTestId("portfolio-total-balance-perc").textContent).toEqual("$22.85 (0.05%)")
    expect(screen.getByTestId("portfolio-est-growth-perc").textContent).toEqual(
      `${expectedDisplayTotalApy} APY (with GFI)`
    )

    // tooltip
    expect(
      await screen.getByText(
        "Includes the combined yield from supplying to the senior pool and borrower pools, plus GFI rewards:"
      )
    ).toBeInTheDocument()
    expect(screen.getByText("Pool APY")).toBeInTheDocument()
    expect(screen.getByTestId("tooltip-estimated-apy").textContent).toEqual(expectedDisplayPoolApy)
    expect(screen.getByTestId("tooltip-gfi-apy").textContent).toEqual(expectedDisplayGfiApy)
    expect(screen.getByTestId("tooltip-total-apy").textContent).toEqual(expectedDisplayTotalApy)
  })

  it("shows portfolio with senior pool and vesting staking reward", async () => {
    const {gfi, stakingRewards, user} = await setupNewStakingReward(goldfinchProtocol, seniorPool)

    await mockCapitalProviderCalls()
    const capitalProvider = await fetchCapitalProviderData(seniorPool, stakingRewards, gfi, user)

    const stakedSeniorPoolBalanceInDollars = capitalProvider.value.stakedSeniorPoolBalanceInDollars
    const totalSeniorPoolBalanceInDollars = capitalProvider.value.totalSeniorPoolBalanceInDollars
    expect(stakedSeniorPoolBalanceInDollars.lt(totalSeniorPoolBalanceInDollars)).toEqual(true)

    const globalEstimatedApyFromGfi = new BigNumber("0.47282410048716433449")
    const expectedUserEstimatedApyFromGfi = globalEstimatedApyFromGfi
      .multipliedBy(stakedSeniorPoolBalanceInDollars)
      .dividedBy(totalSeniorPoolBalanceInDollars)

    const estimatedPoolApy = new BigNumber("0.00483856000534281158")

    const poolData = {
      estimatedApy: estimatedPoolApy,
      estimatedApyFromGfi: globalEstimatedApyFromGfi,
    }
    renderPortfolioOverview(poolData, capitalProvider)

    const expectedDisplayPoolApy = toDisplayPercent(estimatedPoolApy)
    const expectedDisplayGfiApy = toDisplayPercent(expectedUserEstimatedApyFromGfi)
    const expectedDisplayTotalApy = toDisplayPercent(estimatedPoolApy.plus(expectedUserEstimatedApyFromGfi))

    expect(screen.getByTestId("portfolio-total-balance").textContent).toEqual("$50,072.85")
    expect(screen.getByTestId("portfolio-est-growth").textContent).toEqual("$242.28")
    expect(screen.getByTestId("portfolio-total-balance-perc").textContent).toEqual("$22.85 (0.05%)")
    expect(screen.getByTestId("portfolio-est-growth-perc").textContent).toEqual(
      `${expectedDisplayTotalApy} APY (with GFI)`
    )
    // tooltip
    expect(
      await screen.getByText(
        "Includes the combined yield from supplying to the senior pool and borrower pools, plus GFI rewards:"
      )
    ).toBeInTheDocument()
    expect(screen.getByText("Pool APY")).toBeInTheDocument()
    expect(screen.getByTestId("tooltip-estimated-apy").textContent).toEqual(expectedDisplayPoolApy)
    expect(screen.getByTestId("tooltip-gfi-apy").textContent).toEqual(expectedDisplayGfiApy)
    expect(screen.getByTestId("tooltip-total-apy").textContent).toEqual(expectedDisplayTotalApy)
  })

  it("shows portfolio with senior pool and partially claimed staking reward", async () => {
    const {gfi, stakingRewards, user} = await setupPartiallyClaimedStakingReward(goldfinchProtocol, seniorPool)

    await mockCapitalProviderCalls()
    const capitalProvider = await fetchCapitalProviderData(seniorPool, stakingRewards, gfi, user)

    const stakedSeniorPoolBalanceInDollars = capitalProvider.value.stakedSeniorPoolBalanceInDollars
    const totalSeniorPoolBalanceInDollars = capitalProvider.value.totalSeniorPoolBalanceInDollars
    expect(stakedSeniorPoolBalanceInDollars.lt(totalSeniorPoolBalanceInDollars)).toEqual(true)

    const globalEstimatedApyFromGfi = new BigNumber("0.47282410048716433449")
    const expectedUserEstimatedApyFromGfi = globalEstimatedApyFromGfi
      .multipliedBy(stakedSeniorPoolBalanceInDollars)
      .dividedBy(totalSeniorPoolBalanceInDollars)

    const estimatedPoolApy = new BigNumber("0.00483856000534281158")

    const poolData = {
      estimatedApy: estimatedPoolApy,
      estimatedApyFromGfi: globalEstimatedApyFromGfi,
    }
    renderPortfolioOverview(poolData, capitalProvider)

    const expectedDisplayPoolApy = toDisplayPercent(estimatedPoolApy)
    const expectedDisplayGfiApy = toDisplayPercent(expectedUserEstimatedApyFromGfi)
    const expectedDisplayTotalApy = toDisplayPercent(estimatedPoolApy.plus(expectedUserEstimatedApyFromGfi))

    expect(screen.getByTestId("portfolio-total-balance").textContent).toEqual("$50,072.85")
    expect(screen.getByTestId("portfolio-est-growth").textContent).toEqual("$242.28")
    expect(screen.getByTestId("portfolio-total-balance-perc").textContent).toEqual("$22.85 (0.05%)")
    expect(screen.getByTestId("portfolio-est-growth-perc").textContent).toEqual(
      `${expectedDisplayTotalApy} APY (with GFI)`
    )

    // tooltip
    expect(
      await screen.getByText(
        "Includes the combined yield from supplying to the senior pool and borrower pools, plus GFI rewards:"
      )
    ).toBeInTheDocument()
    expect(screen.getByText("Pool APY")).toBeInTheDocument()
    expect(screen.getByTestId("tooltip-estimated-apy").textContent).toEqual(expectedDisplayPoolApy)
    expect(screen.getByTestId("tooltip-gfi-apy").textContent).toEqual(expectedDisplayGfiApy)
    expect(screen.getByTestId("tooltip-total-apy").textContent).toEqual(expectedDisplayTotalApy)
  })

  it("shows portfolio with senior pool, claimable staking reward, and backers", async () => {
    const {gfi, stakingRewards, user} = await setupClaimableStakingReward(goldfinchProtocol, seniorPool)

    await mockCapitalProviderCalls()
    const capitalProvider = await fetchCapitalProviderData(seniorPool, stakingRewards, gfi, user)

    const stakedSeniorPoolBalanceInDollars = capitalProvider.value.stakedSeniorPoolBalanceInDollars
    const totalSeniorPoolBalanceInDollars = capitalProvider.value.totalSeniorPoolBalanceInDollars
    expect(stakedSeniorPoolBalanceInDollars.lt(totalSeniorPoolBalanceInDollars)).toEqual(true)

    const globalEstimatedApyFromGfi = new BigNumber("0.47282410048716433449")

    const estimatedPoolApy = new BigNumber("0.00483856000534281158")

    const poolData = {
      estimatedApy: estimatedPoolApy,
      estimatedApyFromGfi: globalEstimatedApyFromGfi,
    }
    const tranchedPoolBalanceInDollars = new BigNumber("10013.86")
    const poolBackers: Loaded<PoolBacker[]> = {
      loaded: true,
      value: [
        {
          balanceInDollars: tranchedPoolBalanceInDollars,
          unrealizedGainsInDollars: new BigNumber("13.86"),
          tranchedPool: {
            estimateJuniorAPY: (v) => {
              return new BigNumber("0.085")
            },
            estimatedLeverageRatio: new BigNumber(4),
          } as TranchedPool,
        } as PoolBacker,
      ],
    }
    renderPortfolioOverview(poolData, capitalProvider, poolBackers)

    const expectedUserEstimatedApyFromGfi = globalEstimatedApyFromGfi
      .multipliedBy(stakedSeniorPoolBalanceInDollars)
      .dividedBy(totalSeniorPoolBalanceInDollars.plus(tranchedPoolBalanceInDollars))
    const expectedDisplayGfiApy = toDisplayPercent(expectedUserEstimatedApyFromGfi)

    expect(screen.getByTestId("portfolio-total-balance").textContent).toEqual("$60,086.71")
    expect(screen.getByTestId("portfolio-est-growth").textContent).toEqual("$1,093.45")
    expect(screen.getByTestId("portfolio-total-balance-perc").textContent).toEqual("$36.71 (0.06%)")
    expect(screen.getByTestId("portfolio-est-growth-perc").textContent).toEqual("41.18% APY (with GFI)")

    // tooltip
    expect(
      await screen.getByText(
        "Includes the combined yield from supplying to the senior pool and borrower pools, plus GFI rewards:"
      )
    ).toBeInTheDocument()
    expect(screen.getByText("Pool APY")).toBeInTheDocument()
    expect(screen.getByTestId("tooltip-estimated-apy").textContent).toEqual("1.82%")
    expect(screen.getByTestId("tooltip-gfi-apy").textContent).toEqual(expectedDisplayGfiApy)
    expect(screen.getByTestId("tooltip-total-apy").textContent).toEqual("41.18%")
  })
})
