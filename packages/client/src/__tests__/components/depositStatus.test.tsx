import "@testing-library/jest-dom"
import {mock} from "depay-web3-mock"
import {BigNumber} from "bignumber.js"
import {BrowserRouter as Router} from "react-router-dom"
import {render, screen} from "@testing-library/react"
import {AppContext} from "../../App"
import web3 from "../../web3"
import {CapitalProvider, fetchCapitalProviderData, SeniorPool} from "../../ethereum/pool"
import {User} from "../../ethereum/user"
import {blockInfo, DEPLOYMENTS, network, recipient} from "../rewards/__utils__/constants"
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
import DepositStatus from "../../components/depositStatus"

mock({
  blockchain: "ethereum",
})

web3.setProvider(global.ethereum)

function renderDepositStatus(poolData, capitalProvider?: Loaded<CapitalProvider> | undefined) {
  const store = {}
  return render(
    <AppContext.Provider value={store}>
      <Router>
        <DepositStatus poolData={poolData} capitalProvider={capitalProvider ? capitalProvider.value : undefined} />
      </Router>
    </AppContext.Provider>
  )
}

describe("Senior pool page deposit status ", () => {
  let seniorPool
  let goldfinchProtocol = new GoldfinchProtocol(network)
  let gfi, stakingRewards, communityRewards, merkleDistributor, user, capitalProvider

  beforeEach(async () => {
    jest.spyOn(utils, "getDeployments").mockImplementation(() => {
      return DEPLOYMENTS
    })
    setupMocksForAirdrop(undefined) // reset

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
    mockUserInitializationContractCalls(user, stakingRewards, gfi, communityRewards, {})
    await user.initialize(seniorPool, stakingRewards, gfi, communityRewards, merkleDistributor, blockInfo)

    assertWithLoadedInfo(user)
    assertWithLoadedInfo(seniorPool)

    mockCapitalProviderCalls()
    capitalProvider = await fetchCapitalProviderData(seniorPool, stakingRewards, gfi, user)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it("shows deposit status without capital provider", async () => {
    const poolData = {
      estimatedApy: "",
      estimatedApyFromGfi: "",
      loaded: true,
    }
    renderDepositStatus(poolData)
    expect(screen.getByTestId("portfolio-total-balance").textContent).toContain("$--.--")
    expect(screen.getByTestId("portfolio-est-growth").textContent).toContain("--.--% APY")
  })

  it("shows deposit status without rewards", async () => {
    const poolData = {
      estimatedApy: new BigNumber("0.00483856000534281158"),
      estimatedApyFromGfi: new BigNumber("0"),
      loaded: true,
    }
    renderDepositStatus(poolData, capitalProvider)

    expect(screen.getByTestId("portfolio-total-balance").textContent).toContain("$50.02")
    expect(screen.getByTestId("portfolio-est-growth").textContent).toContain("$0.24")
    expect(screen.getByTestId("portfolio-total-balance-perc").textContent).toContain("+$0.02 (0.05%)")
    expect(screen.getByTestId("portfolio-est-growth-perc").textContent).toContain("0.48% APY")

    // tooltip
    expect(
      await screen.getByText("Includes the senior pool yield from allocating to borrower pools, plus GFI rewards:")
    ).toBeInTheDocument()
    expect(screen.getByText("Senior Pool APY")).toBeInTheDocument()
    expect(screen.getByTestId("tooltip-estimated-apy").textContent).toEqual("0.48%")
    expect(screen.getByTestId("tooltip-gfi-apy").textContent).toEqual("--.--%")
    expect(screen.getByTestId("tooltip-total-apy").textContent).toEqual("0.48%")
  })

  it("shows deposit status with senior pool and claimable staking reward", async () => {
    const {gfi, stakingRewards, user} = await setupClaimableStakingReward(goldfinchProtocol, seniorPool)

    mockCapitalProviderCalls()
    const capitalProvider = await fetchCapitalProviderData(seniorPool, stakingRewards, gfi, user)

    const poolData = {
      estimatedApy: new BigNumber("0.00483856000534281158"),
      estimatedApyFromGfi: new BigNumber("0.47282410048716433449"),
      loaded: true,
    }
    renderDepositStatus(poolData, capitalProvider)

    expect(screen.getByTestId("portfolio-total-balance").textContent).toContain("$50,072.85")
    expect(screen.getByTestId("portfolio-est-growth").textContent).toContain("$23,894.28")
    expect(screen.getByTestId("portfolio-total-balance-perc").textContent).toContain("$22.85 (0.05%)")
    expect(screen.getByTestId("portfolio-est-growth-perc").textContent).toContain("47.72% APY (with GFI)")

    // tooltip
    expect(
      await screen.getByText("Includes the senior pool yield from allocating to borrower pools, plus GFI rewards:")
    ).toBeInTheDocument()
    expect(screen.getByText("Senior Pool APY")).toBeInTheDocument()
    expect(screen.getByTestId("tooltip-estimated-apy").textContent).toEqual("0.48%")
    expect(screen.getByTestId("tooltip-gfi-apy").textContent).toEqual("47.24%")
    expect(screen.getByTestId("tooltip-total-apy").textContent).toEqual("47.72%")
  })

  it("shows deposit status with senior pool and vesting staking reward", async () => {
    const {gfi, stakingRewards, user} = await setupNewStakingReward(goldfinchProtocol, seniorPool)

    mockCapitalProviderCalls()
    const capitalProvider = await fetchCapitalProviderData(seniorPool, stakingRewards, gfi, user)

    const poolData = {
      estimatedApy: new BigNumber("0.00483856000534281158"),
      estimatedApyFromGfi: new BigNumber("0.47282410048716433449"),
      loaded: true,
    }
    renderDepositStatus(poolData, capitalProvider)

    expect(screen.getByTestId("portfolio-total-balance").textContent).toContain("50,072.85")
    expect(screen.getByTestId("portfolio-est-growth").textContent).toContain("$23,894.28")
    expect(screen.getByTestId("portfolio-total-balance-perc").textContent).toContain("$22.85 (0.05%)")
    expect(screen.getByTestId("portfolio-est-growth-perc").textContent).toContain("47.72% APY (with GFI)")

    // tooltip
    expect(
      await screen.getByText("Includes the senior pool yield from allocating to borrower pools, plus GFI rewards:")
    ).toBeInTheDocument()
    expect(screen.getByText("Senior Pool APY")).toBeInTheDocument()
    expect(screen.getByTestId("tooltip-estimated-apy").textContent).toEqual("0.48%")
    expect(screen.getByTestId("tooltip-gfi-apy").textContent).toEqual("47.24%")
    expect(screen.getByTestId("tooltip-total-apy").textContent).toEqual("47.72%")
  })

  it("shows deposit status with senior pool and partially claimed staking reward", async () => {
    const {gfi, stakingRewards, user} = await setupPartiallyClaimedStakingReward(goldfinchProtocol, seniorPool)

    mockCapitalProviderCalls()
    const capitalProvider = await fetchCapitalProviderData(seniorPool, stakingRewards, gfi, user)

    const poolData = {
      estimatedApy: new BigNumber("0.00483856000534281158"),
      estimatedApyFromGfi: new BigNumber("0.47282410048716433449"),
      loaded: true,
    }
    renderDepositStatus(poolData, capitalProvider)

    expect(screen.getByTestId("portfolio-total-balance").textContent).toContain("50,072.85")
    expect(screen.getByTestId("portfolio-est-growth").textContent).toContain("$23,894.28")
    expect(screen.getByTestId("portfolio-total-balance-perc").textContent).toContain("$22.85 (0.05%)")
    expect(screen.getByTestId("portfolio-est-growth-perc").textContent).toContain("47.72% APY (with GFI)")

    // tooltip
    expect(
      await screen.getByText("Includes the senior pool yield from allocating to borrower pools, plus GFI rewards:")
    ).toBeInTheDocument()
    expect(screen.getByText("Senior Pool APY")).toBeInTheDocument()
    expect(screen.getByTestId("tooltip-estimated-apy").textContent).toEqual("0.48%")
    expect(screen.getByTestId("tooltip-gfi-apy").textContent).toEqual("47.24%")
    expect(screen.getByTestId("tooltip-total-apy").textContent).toEqual("47.72%")
  })
})
