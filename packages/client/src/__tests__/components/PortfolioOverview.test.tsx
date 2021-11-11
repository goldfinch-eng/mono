import "@testing-library/jest-dom"
import {mock} from "depay-web3-mock"
import {BigNumber} from "bignumber.js"
import {BrowserRouter as Router} from "react-router-dom"
import {render, screen} from "@testing-library/react"
import {AppContext} from "../../App"
import web3 from "../../web3"
import {fetchCapitalProviderData, SeniorPool} from "../../ethereum/pool"
import {User} from "../../ethereum/user"
import {blockchain, blockInfo, DEPLOYMENTS, erc20ABI, fiduABI, network, recipient} from "../rewards/__utils__/constants"
import {GoldfinchProtocol} from "../../ethereum/GoldfinchProtocol"
import {
  getDefaultClasses,
  setupClaimableStakingReward,
  setupNewStakingReward,
  setupPartiallyClaimedStakingReward,
} from "../rewards/__utils__/scenarios"
import {assertWithLoadedInfo, Loaded} from "../../types/loadable"
import {mockUserInitializationContractCalls, setupMocksForAcceptedAirdrop} from "../rewards/__utils__/mocks"
import * as utils from "../../ethereum/utils"
import * as poolModule from "../../ethereum/pool"
import {PortfolioOverview} from "../../components/earn"

mock({
  blockchain: "ethereum",
})

web3.setProvider(global.ethereum)

function mockCapitalProviderCalls(
  sharePrice: string,
  numSharesNotStaked: string,
  allowance: string,
  weightedAverageSharePrice: string
) {
  jest.spyOn(utils, "fetchDataFromAttributes").mockImplementation(() => {
    return Promise.resolve({sharePrice: new BigNumber(sharePrice)})
  })
  jest.spyOn(poolModule, "getWeightedAverageSharePrice").mockImplementation(() => {
    return Promise.resolve(new BigNumber(weightedAverageSharePrice))
  })
  mock({
    blockchain,
    call: {
      to: "0x0000000000000000000000000000000000000004",
      api: fiduABI,
      method: "balanceOf",
      params: [recipient],
      return: numSharesNotStaked,
    },
  })
  mock({
    blockchain,
    call: {
      to: "0x0000000000000000000000000000000000000002",
      api: erc20ABI,
      method: "allowance",
      params: [recipient, "0x0000000000000000000000000000000000000005"],
      return: allowance,
    },
  })
}

function renderPortfolioOverview(poolData, capitalProvider, poolBackers?: Loaded<unknown[]> | undefined) {
  const store = {}
  const defaultPoolBackers = {
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
      },
    ],
  }
  return render(
    <AppContext.Provider value={store}>
      <Router>
        <PortfolioOverview
          poolData={poolData}
          capitalProvider={capitalProvider}
          // @ts-ignore
          poolBackers={poolBackers ? poolBackers : defaultPoolBackers}
        />
      </Router>
    </AppContext.Provider>
  )
}

describe("Earn page portfolio overview", () => {
  let seniorPool
  let goldfinchProtocol = new GoldfinchProtocol(network)
  let gfi, stakingRewards, communityRewards, merkleDistributor, user, capitalProvider

  beforeEach(async () => {
    jest.spyOn(utils, "getDeployments").mockImplementation(() => {
      return DEPLOYMENTS
    })
    setupMocksForAcceptedAirdrop(undefined) // reset

    await goldfinchProtocol.initialize()
    seniorPool = new SeniorPool(goldfinchProtocol)
    seniorPool.info = {
      loaded: true,
      value: {
        currentBlock: blockInfo,
        poolData: {
          estimatedApy: new BigNumber("0.00483856000534281158"),
        },
        isPaused: false,
      },
    }
  })
  beforeEach(async () => {
    const result = await getDefaultClasses(goldfinchProtocol)
    gfi = result.gfi
    stakingRewards = result.stakingRewards
    communityRewards = result.communityRewards
    merkleDistributor = result.merkleDistributor

    user = new User(recipient, network.name, undefined, goldfinchProtocol, undefined)
    mockUserInitializationContractCalls(user, stakingRewards, gfi, communityRewards, {
      hasStakingRewards: false,
      hasCommunityRewards: false,
    })
    await user.initialize(seniorPool, stakingRewards, gfi, communityRewards, merkleDistributor, blockInfo)

    assertWithLoadedInfo(user)
    assertWithLoadedInfo(seniorPool)

    mockCapitalProviderCalls("1000456616980000000", "50000000000000000000", "0", "1")
    capitalProvider = await fetchCapitalProviderData(seniorPool, stakingRewards, gfi, user)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it("shows portfolio with empty info", async () => {
    const poolData = {
      estimatedApy: "",
      estimatedApyFromGfi: "",
      loaded: true,
    }
    const {container} = renderPortfolioOverview(poolData, capitalProvider)

    const value = await container.getElementsByClassName("value")
    expect(value[0]?.textContent).toContain("$50.02") // Portfolio balance
    expect(value[1]?.textContent).toContain("$--.--") // Est. Annual Growth

    const subValue = await container.getElementsByClassName("sub-value")
    expect(subValue[0]?.textContent).toContain("$0.02 (0.04%)") // Portfolio balance
    expect(subValue[1]?.textContent).toContain("--.--% APY") // Est. Annual Growth

    // tooltip
    expect(
      await screen.getByText(
        "Includes the combined yield from supplying to the senior pool and borrower pools, plus GFI rewards:"
      )
    ).toBeInTheDocument()
    const tooltipRow = await container.getElementsByClassName("tooltip-row")
    expect(tooltipRow[0]?.textContent).toContain("Pool APY--.--%")
    expect(tooltipRow[1]?.textContent).toContain("GFI Rewards APY--.--%")
    expect(tooltipRow[2]?.textContent).toContain("Total Est. APY--.--%")
  })

  it("shows portfolio only with senior pool info", async () => {
    const poolData = {
      estimatedApy: new BigNumber("0.00483856000534281158"),
      estimatedApyFromGfi: new BigNumber("0"),
      loaded: true,
    }
    const {container} = renderPortfolioOverview(poolData, capitalProvider)

    const value = await container.getElementsByClassName("value")
    expect(value[0]?.textContent).toContain("$50.02") // Portfolio balance
    expect(value[1]?.textContent).toContain("$0.24") // Est. Annual Growth

    const subValue = await container.getElementsByClassName("sub-value")
    expect(subValue[0]?.textContent).toContain("$0.02 (0.04%)") // Portfolio balance
    expect(subValue[1]?.textContent).toContain("0.48% APY") // Est. Annual Growth

    // tooltip
    expect(
      await screen.getByText(
        "Includes the combined yield from supplying to the senior pool and borrower pools, plus GFI rewards:"
      )
    ).toBeInTheDocument()
    const tooltipRow = await container.getElementsByClassName("tooltip-row")
    expect(tooltipRow[0]?.textContent).toContain("Pool APY0.48%")
    expect(tooltipRow[1]?.textContent).toContain("GFI Rewards APY--.--%")
    expect(tooltipRow[2]?.textContent).toContain("Total Est. APY0.48%")
  })

  it("shows portfolio with senior pool and claimable staking reward", async () => {
    const {gfi, stakingRewards, user} = await setupClaimableStakingReward(goldfinchProtocol, seniorPool)

    mockCapitalProviderCalls("1000456616980000000", "50000000000000000000", "0", "1")
    const capitalProvider = await fetchCapitalProviderData(seniorPool, stakingRewards, gfi, user)

    const poolData = {
      estimatedApy: new BigNumber("0.00483856000534281158"),
      estimatedApyFromGfi: new BigNumber("0.47282410048716433449"),
      loaded: true,
    }
    const {container} = renderPortfolioOverview(poolData, capitalProvider)

    const value = await container.getElementsByClassName("value")
    expect(value[0]?.textContent).toContain("50,072.85") // Portfolio balance
    expect(value[1]?.textContent).toContain("$242.28") // Est. Annual Growth

    const subValue = await container.getElementsByClassName("sub-value")
    expect(subValue[0]?.textContent).toContain("$22.85 (0.05%)") // Portfolio balance
    expect(subValue[1]?.textContent).toContain("47.72% APY (with GFI)") // Est. Annual Growth

    // tooltip
    expect(
      await screen.getByText(
        "Includes the combined yield from supplying to the senior pool and borrower pools, plus GFI rewards:"
      )
    ).toBeInTheDocument()
    const tooltipRow = await container.getElementsByClassName("tooltip-row")
    expect(tooltipRow[0]?.textContent).toContain("Pool APY0.48%")
    expect(tooltipRow[1]?.textContent).toContain("GFI Rewards APY47.24%")
    expect(tooltipRow[2]?.textContent).toContain("Total Est. APY47.72%")
  })

  it("shows portfolio with senior pool and vesting staking reward", async () => {
    const {gfi, stakingRewards, user} = await setupNewStakingReward(goldfinchProtocol, seniorPool)

    mockCapitalProviderCalls("1000456616980000000", "50000000000000000000", "0", "1")
    const capitalProvider = await fetchCapitalProviderData(seniorPool, stakingRewards, gfi, user)

    const poolData = {
      estimatedApy: new BigNumber("0.00483856000534281158"),
      estimatedApyFromGfi: new BigNumber("0.47282410048716433449"),
      loaded: true,
    }
    const {container} = renderPortfolioOverview(poolData, capitalProvider)

    const value = await container.getElementsByClassName("value")
    expect(value[0]?.textContent).toContain("50,072.85") // Portfolio balance
    expect(value[1]?.textContent).toContain("$242.28") // Est. Annual Growth

    const subValue = await container.getElementsByClassName("sub-value")
    expect(subValue[0]?.textContent).toContain("$22.85 (0.05%)") // Portfolio balance
    expect(subValue[1]?.textContent).toContain("47.72% APY (with GFI)") // Est. Annual Growth

    // tooltip
    expect(
      await screen.getByText(
        "Includes the combined yield from supplying to the senior pool and borrower pools, plus GFI rewards:"
      )
    ).toBeInTheDocument()
    const tooltipRow = await container.getElementsByClassName("tooltip-row")
    expect(tooltipRow[0]?.textContent).toContain("Pool APY0.48%")
    expect(tooltipRow[1]?.textContent).toContain("GFI Rewards APY47.24%")
    expect(tooltipRow[2]?.textContent).toContain("Total Est. APY47.72%")
  })

  it("shows portfolio with senior pool and partially claimed staking reward", async () => {
    const {gfi, stakingRewards, user} = await setupPartiallyClaimedStakingReward(goldfinchProtocol, seniorPool)

    mockCapitalProviderCalls("1000456616980000000", "50000000000000000000", "0", "1")
    const capitalProvider = await fetchCapitalProviderData(seniorPool, stakingRewards, gfi, user)

    const poolData = {
      estimatedApy: new BigNumber("0.00483856000534281158"),
      estimatedApyFromGfi: new BigNumber("0.47282410048716433449"),
      loaded: true,
    }
    const {container} = renderPortfolioOverview(poolData, capitalProvider)

    const value = await container.getElementsByClassName("value")
    expect(value[0]?.textContent).toContain("50,072.85") // Portfolio balance
    expect(value[1]?.textContent).toContain("$242.28") // Est. Annual Growth

    const subValue = await container.getElementsByClassName("sub-value")
    expect(subValue[0]?.textContent).toContain("$22.85 (0.05%)") // Portfolio balance
    expect(subValue[1]?.textContent).toContain("47.72% APY (with GFI)") // Est. Annual Growth

    // tooltip
    expect(
      await screen.getByText(
        "Includes the combined yield from supplying to the senior pool and borrower pools, plus GFI rewards:"
      )
    ).toBeInTheDocument()
    const tooltipRow = await container.getElementsByClassName("tooltip-row")
    expect(tooltipRow[0]?.textContent).toContain("Pool APY0.48%")
    expect(tooltipRow[1]?.textContent).toContain("GFI Rewards APY47.24%")
    expect(tooltipRow[2]?.textContent).toContain("Total Est. APY47.72%")
  })

  it("shows portfolio with senior pool, claimable staking reward, and backers", async () => {
    const {gfi, stakingRewards, user} = await setupClaimableStakingReward(goldfinchProtocol, seniorPool)

    mockCapitalProviderCalls("1000456616980000000", "50000000000000000000", "0", "1")
    const capitalProvider = await fetchCapitalProviderData(seniorPool, stakingRewards, gfi, user)

    const poolData = {
      estimatedApy: new BigNumber("0.00483856000534281158"),
      estimatedApyFromGfi: new BigNumber("0.47282410048716433449"),
      loaded: true,
    }
    const poolBackers = {
      loaded: true,
      value: [
        {
          balanceInDollars: new BigNumber("10013.86"),
          unrealizedGainsInDollars: new BigNumber("13.86"),
          tranchedPool: {
            estimateJuniorAPY: (v) => {
              return new BigNumber("0.085")
            },
            estimatedLeverageRatio: new BigNumber(4),
          },
        },
      ],
    }
    // @ts-ignore
    const {container} = renderPortfolioOverview(poolData, capitalProvider, poolBackers)

    const value = await container.getElementsByClassName("value")
    expect(value[0]?.textContent).toContain("$60,086.71") // Portfolio balance
    expect(value[1]?.textContent).toContain("$1,093.45") // Est. Annual Growth

    const subValue = await container.getElementsByClassName("sub-value")
    expect(subValue[0]?.textContent).toContain("$36.71 (0.06%)") // Portfolio balance
    expect(subValue[1]?.textContent).toContain("41.18% APY (with GFI)") // Est. Annual Growth

    // tooltip
    expect(
      await screen.getByText(
        "Includes the combined yield from supplying to the senior pool and borrower pools, plus GFI rewards:"
      )
    ).toBeInTheDocument()
    const tooltipRow = await container.getElementsByClassName("tooltip-row")
    expect(tooltipRow[0]?.textContent).toContain("Pool APY1.82%")
    expect(tooltipRow[1]?.textContent).toContain("GFI Rewards APY39.36%")
    expect(tooltipRow[2]?.textContent).toContain("Total Est. APY41.18%")
  })
})
