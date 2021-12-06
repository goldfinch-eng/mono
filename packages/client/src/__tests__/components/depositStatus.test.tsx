import {CreditDesk} from "@goldfinch-eng/protocol/typechain/web3/CreditDesk"
import "@testing-library/jest-dom"
import {render, screen} from "@testing-library/react"
import {BigNumber} from "bignumber.js"
import {mock} from "depay-web3-mock"
import {BrowserRouter as Router} from "react-router-dom"
import {AppContext} from "../../App"
import DepositStatus from "../../components/depositStatus"
import {CommunityRewardsLoaded, MerkleDirectDistributorLoaded} from "../../ethereum/communityRewards"
import {GFILoaded} from "../../ethereum/gfi"
import {GoldfinchProtocol} from "../../ethereum/GoldfinchProtocol"
import {MerkleDistributorLoaded} from "../../ethereum/merkleDistributor"
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
import * as utils from "../../ethereum/utils"
import {assertWithLoadedInfo, Loaded} from "../../types/loadable"
import {BlockInfo} from "../../utils"
import web3 from "../../web3"
import {defaultCurrentBlock, getDeployments, network, recipient} from "../rewards/__utils__/constants"
import {toDisplayPercent} from "../rewards/__utils__/display"
import {
  mockCapitalProviderCalls,
  mockUserInitializationContractCalls,
  resetAirdropMocks,
} from "../rewards/__utils__/mocks"
import {
  getDefaultClasses,
  setupClaimableStakingReward,
  setupNewStakingReward,
  setupPartiallyClaimedStakingReward,
} from "../rewards/__utils__/scenarios"

mock({
  blockchain: "ethereum",
})

web3.setProvider((global.window as any).ethereum)

function renderDepositStatus(
  poolData: Partial<PoolData>,
  capitalProvider: Loaded<CapitalProvider> | undefined,
  currentBlock: BlockInfo
) {
  const store = {currentBlock}
  return render(
    <AppContext.Provider value={store}>
      <Router>
        <DepositStatus
          poolData={poolData as PoolData}
          capitalProvider={capitalProvider ? capitalProvider.value : undefined}
        />
      </Router>
    </AppContext.Provider>
  )
}

describe("Senior pool page deposit status", () => {
  let seniorPool: SeniorPoolLoaded
  let goldfinchProtocol = new GoldfinchProtocol(network)
  let gfi: GFILoaded,
    stakingRewards: StakingRewardsLoaded,
    communityRewards: CommunityRewardsLoaded,
    merkleDistributor: MerkleDistributorLoaded,
    merkleDirectDistributor: MerkleDirectDistributorLoaded,
    user: User | UserLoaded,
    capitalProvider: Loaded<CapitalProvider>

  const currentBlock = defaultCurrentBlock

  beforeEach(async () => {
    jest.spyOn(utils, "getDeployments").mockImplementation(() => {
      return getDeployments()
    })
    resetAirdropMocks()

    await goldfinchProtocol.initialize()
    const _seniorPoolLoaded = new SeniorPool(goldfinchProtocol)
    _seniorPoolLoaded.info = {
      loaded: true,
      value: {
        currentBlock,
        poolData: {
          estimatedApy: new BigNumber("0.00483856000534281158"),
        } as PoolData,
        isPaused: false,
      },
    }
    assertWithLoadedInfo(_seniorPoolLoaded)
    seniorPool = _seniorPoolLoaded
  })
  beforeEach(async () => {
    const result = await getDefaultClasses(goldfinchProtocol, currentBlock)
    gfi = result.gfi
    stakingRewards = result.stakingRewards
    communityRewards = result.communityRewards
    merkleDistributor = result.merkleDistributor
    merkleDirectDistributor = result.merkleDirectDistributor

    user = new User(recipient, network.name, undefined as unknown as CreditDesk, goldfinchProtocol, undefined)
    await mockUserInitializationContractCalls(user, stakingRewards, gfi, communityRewards, merkleDistributor, {
      currentBlock,
    })
    await user.initialize(
      seniorPool,
      stakingRewards,
      gfi,
      communityRewards,
      merkleDistributor,
      merkleDirectDistributor,
      currentBlock
    )

    assertWithLoadedInfo(user)
    assertWithLoadedInfo(seniorPool)

    await mockCapitalProviderCalls()
    capitalProvider = await fetchCapitalProviderData(seniorPool, stakingRewards, gfi, user)
  })

  afterEach(() => {
    mockGetWeightedAverageSharePrice(undefined)
    jest.clearAllMocks()
  })

  it("shows deposit status without capital provider", async () => {
    const poolData = {}
    renderDepositStatus(poolData, undefined, currentBlock)
    expect(screen.getByTestId("portfolio-total-balance").textContent).toContain("$--.--")
    expect(screen.getByTestId("portfolio-est-growth").textContent).toContain("$--.--")
  })

  it("shows deposit status without GFI rewards", async () => {
    const poolData = {
      estimatedApy: new BigNumber("0.00483856000534281158"),
      estimatedApyFromGfi: new BigNumber("0"),
    }
    renderDepositStatus(poolData, capitalProvider, currentBlock)

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
    expect(screen.getByTestId("tooltip-gfi-apy").textContent).toEqual("0.00%")
    expect(screen.getByTestId("tooltip-total-apy").textContent).toEqual("0.48%")
  })

  it("shows deposit status with senior pool and claimable staking reward", async () => {
    const {gfi, stakingRewards, user} = await setupClaimableStakingReward(goldfinchProtocol, seniorPool, currentBlock)

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
    renderDepositStatus(poolData, capitalProvider, currentBlock)

    const expectedDisplayPoolApy = toDisplayPercent(estimatedPoolApy)
    const expectedDisplayGfiApy = toDisplayPercent(expectedUserEstimatedApyFromGfi)
    const expectedDisplayTotalApy = toDisplayPercent(estimatedPoolApy.plus(expectedUserEstimatedApyFromGfi))

    expect(screen.getByTestId("portfolio-total-balance").textContent).toContain("$50,072.85")
    expect(screen.getByTestId("portfolio-est-growth").textContent).toContain("$23,894.28")
    expect(screen.getByTestId("portfolio-total-balance-perc").textContent).toContain("$22.85 (0.05%)")
    expect(screen.getByTestId("portfolio-est-growth-perc").textContent).toEqual(
      `${expectedDisplayTotalApy} APY (with GFI)`
    )
    // tooltip
    expect(
      await screen.getByText("Includes the senior pool yield from allocating to borrower pools, plus GFI rewards:")
    ).toBeInTheDocument()
    expect(screen.getByText("Senior Pool APY")).toBeInTheDocument()
    expect(screen.getByTestId("tooltip-estimated-apy").textContent).toEqual(expectedDisplayPoolApy)
    expect(screen.getByTestId("tooltip-gfi-apy").textContent).toEqual(expectedDisplayGfiApy)
    expect(screen.getByTestId("tooltip-total-apy").textContent).toEqual(expectedDisplayTotalApy)
  })

  it("shows deposit status with senior pool and vesting staking reward", async () => {
    const {gfi, stakingRewards, user} = await setupNewStakingReward(goldfinchProtocol, seniorPool, currentBlock)

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
    renderDepositStatus(poolData, capitalProvider, currentBlock)

    const expectedDisplayPoolApy = toDisplayPercent(estimatedPoolApy)
    const expectedDisplayGfiApy = toDisplayPercent(expectedUserEstimatedApyFromGfi)
    const expectedDisplayTotalApy = toDisplayPercent(estimatedPoolApy.plus(expectedUserEstimatedApyFromGfi))

    expect(screen.getByTestId("portfolio-total-balance").textContent).toContain("$50,072.85")
    expect(screen.getByTestId("portfolio-est-growth").textContent).toContain("$23,894.28")
    expect(screen.getByTestId("portfolio-total-balance-perc").textContent).toContain("$22.85 (0.05%)")
    expect(screen.getByTestId("portfolio-est-growth-perc").textContent).toEqual(
      `${expectedDisplayTotalApy} APY (with GFI)`
    )
    // tooltip
    expect(
      await screen.getByText("Includes the senior pool yield from allocating to borrower pools, plus GFI rewards:")
    ).toBeInTheDocument()
    expect(screen.getByText("Senior Pool APY")).toBeInTheDocument()
    expect(screen.getByTestId("tooltip-estimated-apy").textContent).toEqual(expectedDisplayPoolApy)
    expect(screen.getByTestId("tooltip-gfi-apy").textContent).toEqual(expectedDisplayGfiApy)
    expect(screen.getByTestId("tooltip-total-apy").textContent).toEqual(expectedDisplayTotalApy)
  })

  it("shows deposit status with senior pool and partially claimed staking reward", async () => {
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
    renderDepositStatus(poolData, capitalProvider, currentBlock)

    const expectedDisplayPoolApy = toDisplayPercent(estimatedPoolApy)
    const expectedDisplayGfiApy = toDisplayPercent(expectedUserEstimatedApyFromGfi)
    const expectedDisplayTotalApy = toDisplayPercent(estimatedPoolApy.plus(expectedUserEstimatedApyFromGfi))

    expect(screen.getByTestId("portfolio-total-balance").textContent).toContain("$50,072.85")
    expect(screen.getByTestId("portfolio-est-growth").textContent).toContain("$23,894.28")
    expect(screen.getByTestId("portfolio-total-balance-perc").textContent).toContain("$22.85 (0.05%)")
    expect(screen.getByTestId("portfolio-est-growth-perc").textContent).toEqual(
      `${expectedDisplayTotalApy} APY (with GFI)`
    )
    // tooltip
    expect(
      await screen.getByText("Includes the senior pool yield from allocating to borrower pools, plus GFI rewards:")
    ).toBeInTheDocument()
    expect(screen.getByText("Senior Pool APY")).toBeInTheDocument()
    expect(screen.getByTestId("tooltip-estimated-apy").textContent).toEqual(expectedDisplayPoolApy)
    expect(screen.getByTestId("tooltip-gfi-apy").textContent).toEqual(expectedDisplayGfiApy)
    expect(screen.getByTestId("tooltip-total-apy").textContent).toEqual(expectedDisplayTotalApy)
  })
})
