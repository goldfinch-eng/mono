import "@testing-library/jest-dom"
import {mock, resetMocks} from "depay-web3-mock"
import {render, screen} from "@testing-library/react"
import {BrowserRouter as Router} from "react-router-dom"
import {AppContext} from "../../App"
import web3 from "../../web3"
import Rewards from "../../pages/rewards"
import {MerkleDistributorLoaded, CommunityRewardsLoaded} from "../../ethereum/communityRewards"
import {GFILoaded} from "../../ethereum/gfi"
import {User} from "../../ethereum/user"
import {SeniorPool, SeniorPoolLoaded, StakingRewardsLoaded} from "../../ethereum/pool"
import {UserLoaded} from "../../ethereum/user"
import {blockchain, blockInfo, DEPLOYMENTS, network, recipient} from "./__utils__/constants"
import {assertWithLoadedInfo} from "../../types/loadable"
import {GoldfinchProtocol} from "../../ethereum/GoldfinchProtocol"
import * as utils from "../../ethereum/utils"
import {mockUserInitializationContractCalls, setupMocksForAirdrop, assertAllMocksAreCalled} from "./__utils__/mocks"
import {
  getDefaultClasses,
  setupNewStakingReward,
  setupClaimableStakingReward,
  setupClaimableCommunityReward,
  setupAirdrop,
  setupCommunityRewardAndStakingReward,
  setupVestingCommunityReward,
  setupPartiallyClaimedStakingReward,
} from "./__utils__/scenarios"

mock({
  blockchain: "ethereum",
})

web3.setProvider(global.ethereum)

function renderRewards(
  stakingRewards: StakingRewardsLoaded | undefined,
  gfi: GFILoaded | undefined,
  user: UserLoaded | undefined,
  merkleDistributor: MerkleDistributorLoaded | undefined,
  communityRewards: CommunityRewardsLoaded | undefined
) {
  const store = {
    currentBlock: blockInfo,
    network,
    stakingRewards,
    gfi,
    user,
    merkleDistributor,
    communityRewards,
  }

  return render(
    <AppContext.Provider value={store}>
      <Router>
        <Rewards />
      </Router>
    </AppContext.Provider>
  )
}

async function getUserLoaded(
  goldfinchProtocol: GoldfinchProtocol,
  seniorPoolLoaded: SeniorPoolLoaded,
  stakingRewards: StakingRewardsLoaded,
  gfi: GFILoaded,
  communityRewards: CommunityRewardsLoaded,
  merkleDistributor: MerkleDistributorLoaded
): Promise<UserLoaded> {
  const user = new User(recipient, network.name, undefined, goldfinchProtocol, undefined)
  const mocks = mockUserInitializationContractCalls(user, stakingRewards, gfi, communityRewards, {})

  await user.initialize(seniorPoolLoaded, stakingRewards, gfi, communityRewards, merkleDistributor, blockInfo)
  assertAllMocksAreCalled(mocks)
  assertWithLoadedInfo(user)
  return user
}

describe("Rewards portfolio overview", () => {
  let seniorPoolLoaded: any
  let goldfinchProtocol = new GoldfinchProtocol(network)

  beforeEach(resetMocks)
  beforeEach(() => mock({blockchain, accounts: {return: [recipient]}}))
  beforeEach(async () => {
    jest.spyOn(utils, "getDeployments").mockImplementation(() => {
      return DEPLOYMENTS
    })
    setupMocksForAirdrop(undefined) // reset

    await goldfinchProtocol.initialize()
    seniorPoolLoaded = new SeniorPool(goldfinchProtocol)
    seniorPoolLoaded.info = {
      loaded: true,
      value: {
        currentBlock: blockInfo,
        // @ts-ignore
        poolData: {},
        isPaused: false,
      },
    }
  })

  it("shows loading message when all requirements are empty", async () => {
    renderRewards(undefined, undefined, undefined, undefined, undefined)
    expect(await screen.findByText("Loading...")).toBeVisible()
  })

  it("shows loading message when some requirements are empty", async () => {
    const {stakingRewards} = await getDefaultClasses(goldfinchProtocol)
    renderRewards(stakingRewards, undefined, undefined, undefined, undefined)
    expect(await screen.findByText("Loading...")).toBeVisible()
  })

  it("don't show loading message when all requirements loaded", async () => {
    const {gfi, stakingRewards, communityRewards, merkleDistributor} = await getDefaultClasses(goldfinchProtocol)
    const user = await getUserLoaded(
      goldfinchProtocol,
      seniorPoolLoaded,
      stakingRewards,
      gfi,
      communityRewards,
      merkleDistributor
    )
    renderRewards(stakingRewards, gfi, user, merkleDistributor, communityRewards)

    expect(await screen.queryByText("Loading...")).not.toBeInTheDocument()
  })

  it("shows empty portfolio", async () => {
    const {gfi, stakingRewards, communityRewards, merkleDistributor} = await getDefaultClasses(goldfinchProtocol)
    const user = await getUserLoaded(
      goldfinchProtocol,
      seniorPoolLoaded,
      stakingRewards,
      gfi,
      communityRewards,
      merkleDistributor
    )
    renderRewards(stakingRewards, gfi, user, merkleDistributor, communityRewards)

    expect(await screen.findByText("Total GFI balance")).toBeVisible()
    expect(await screen.findByText("Wallet balance")).toBeVisible()
    expect(await screen.findByText("Claimable")).toBeVisible()
    expect(await screen.findByText("Still vesting")).toBeVisible()

    expect(await screen.getByTestId("summary-wallet-balance").textContent).toEqual("0.00")
    expect(await screen.getByTestId("summary-claimable").textContent).toEqual("0.00")
    expect(await screen.getByTestId("summary-still-vesting").textContent).toEqual("0.00")
    expect(await screen.getByTestId("summary-total-balance").textContent).toEqual("0.00")
  })

  it("unvested staking reward don't appear on portfolio", async () => {
    const {gfi, stakingRewards, communityRewards, merkleDistributor, user} = await setupNewStakingReward(
      goldfinchProtocol,
      seniorPoolLoaded
    )

    renderRewards(stakingRewards, gfi, user, merkleDistributor, communityRewards)

    expect(await screen.findByText("Total GFI balance")).toBeVisible()
    expect(await screen.findByText("Wallet balance")).toBeVisible()
    expect(await screen.findByText("Claimable")).toBeVisible()
    expect(await screen.findByText("Still vesting")).toBeVisible()

    expect(await screen.getByTestId("summary-wallet-balance").textContent).toEqual("0.00")
    expect(await screen.getByTestId("summary-claimable").textContent).toEqual("0.00")
    expect(await screen.getByTestId("summary-still-vesting").textContent).toEqual("0.00")
    expect(await screen.getByTestId("summary-total-balance").textContent).toEqual("0.00")

    expect(await screen.getByTestId("summary-wallet-balance").className).toEqual("disabled-value")
    expect(await screen.getByTestId("summary-claimable").className).toEqual("disabled-value")
    expect(await screen.getByTestId("summary-still-vesting").className).toEqual("disabled-value")
    expect(await screen.getByTestId("summary-total-balance").className).toEqual("disabled-value")
  })

  it("claimable staking reward appears on portfolio", async () => {
    const {gfi, stakingRewards, communityRewards, merkleDistributor, user} = await setupClaimableStakingReward(
      goldfinchProtocol,
      seniorPoolLoaded
    )

    renderRewards(stakingRewards, gfi, user, merkleDistributor, communityRewards)

    expect(await screen.findByText("Total GFI balance")).toBeVisible()
    expect(await screen.findByText("Wallet balance")).toBeVisible()
    expect(await screen.findByText("Claimable")).toBeVisible()
    expect(await screen.findByText("Still vesting")).toBeVisible()

    expect(await screen.getByTestId("summary-wallet-balance").textContent).toEqual("0.00")
    expect(await screen.getByTestId("summary-claimable").textContent).toEqual("0.71")
    expect(await screen.getByTestId("summary-still-vesting").textContent).toEqual("128.89")
    expect(await screen.getByTestId("summary-total-balance").textContent).toEqual("129.60")

    expect(await screen.getByTestId("summary-wallet-balance").className).toEqual("value")
    expect(await screen.getByTestId("summary-claimable").className).toEqual("value")
    expect(await screen.getByTestId("summary-still-vesting").className).toEqual("value")
    expect(await screen.getByTestId("summary-total-balance").className).toEqual("value")
  })

  it("community reward appears on portfolio", async () => {
    const {gfi, stakingRewards, communityRewards, merkleDistributor, user} = await setupClaimableCommunityReward(
      goldfinchProtocol,
      seniorPoolLoaded
    )
    renderRewards(stakingRewards, gfi, user, merkleDistributor, communityRewards)

    expect(await screen.findByText("Wallet balance")).toBeVisible()
    expect(await screen.findByText("Claimable")).toBeVisible()
    expect(await screen.findByText("Still vesting")).toBeVisible()
    expect(await screen.findByText("Total GFI balance")).toBeVisible()

    expect(await screen.getByTestId("summary-wallet-balance").textContent).toEqual("0.00")
    expect(await screen.getByTestId("summary-claimable").textContent).toEqual("1,000.00")
    expect(await screen.getByTestId("summary-still-vesting").textContent).toEqual("0.00")
    expect(await screen.getByTestId("summary-total-balance").textContent).toEqual("1,000.00")

    expect(await screen.getByTestId("summary-wallet-balance").className).toEqual("value")
    expect(await screen.getByTestId("summary-claimable").className).toEqual("value")
    expect(await screen.getByTestId("summary-still-vesting").className).toEqual("value")
    expect(await screen.getByTestId("summary-total-balance").className).toEqual("value")
  })

  it("non accepted airdrops don't appear on portfolio", async () => {
    const {gfi, stakingRewards, communityRewards, merkleDistributor, user} = await setupAirdrop(
      goldfinchProtocol,
      seniorPoolLoaded
    )

    renderRewards(stakingRewards, gfi, user, merkleDistributor, communityRewards)

    expect(await screen.findByText("Total GFI balance")).toBeVisible()
    expect(await screen.findByText("Wallet balance")).toBeVisible()
    expect(await screen.findByText("Claimable")).toBeVisible()
    expect(await screen.findByText("Still vesting")).toBeVisible()

    expect(await screen.getByTestId("summary-wallet-balance").textContent).toEqual("0.00")
    expect(await screen.getByTestId("summary-claimable").textContent).toEqual("0.00")
    expect(await screen.getByTestId("summary-still-vesting").textContent).toEqual("0.00")
    expect(await screen.getByTestId("summary-total-balance").textContent).toEqual("0.00")

    expect(await screen.getByTestId("summary-wallet-balance").className).toEqual("disabled-value")
    expect(await screen.getByTestId("summary-claimable").className).toEqual("disabled-value")
    expect(await screen.getByTestId("summary-still-vesting").className).toEqual("disabled-value")
    expect(await screen.getByTestId("summary-total-balance").className).toEqual("disabled-value")
  })

  it("community reward and staking reward appear on portfolio", async () => {
    const {gfi, stakingRewards, communityRewards, merkleDistributor, user} = await setupCommunityRewardAndStakingReward(
      goldfinchProtocol,
      seniorPoolLoaded
    )

    renderRewards(stakingRewards, gfi, user, merkleDistributor, communityRewards)

    expect(await screen.findByText("Total GFI balance")).toBeVisible()
    expect(await screen.findByText("Wallet balance")).toBeVisible()
    expect(await screen.findByText("Claimable")).toBeVisible()
    expect(await screen.findByText("Still vesting")).toBeVisible()

    expect(await screen.getByTestId("summary-wallet-balance").textContent).toEqual("0.00")
    expect(await screen.getByTestId("summary-claimable").textContent).toEqual("1,000.71")
    expect(await screen.getByTestId("summary-still-vesting").textContent).toEqual("128.89")
    expect(await screen.getByTestId("summary-total-balance").textContent).toEqual("1,129.60")

    expect(await screen.getByTestId("summary-wallet-balance").className).toEqual("value")
    expect(await screen.getByTestId("summary-claimable").className).toEqual("value")
    expect(await screen.getByTestId("summary-still-vesting").className).toEqual("value")
    expect(await screen.getByTestId("summary-total-balance").className).toEqual("value")
  })

  it("vesting community reward appears on portfolio", async () => {
    const {gfi, stakingRewards, communityRewards, merkleDistributor, user} = await setupVestingCommunityReward(
      goldfinchProtocol,
      seniorPoolLoaded
    )
    renderRewards(stakingRewards, gfi, user, merkleDistributor, communityRewards)

    expect(await screen.findByText("Wallet balance")).toBeVisible()
    expect(await screen.findByText("Claimable")).toBeVisible()
    expect(await screen.findByText("Still vesting")).toBeVisible()
    expect(await screen.findByText("Total GFI balance")).toBeVisible()

    expect(await screen.getByTestId("summary-wallet-balance").textContent).toEqual("0.00")
    expect(await screen.getByTestId("summary-claimable").textContent).toEqual("0.00")
    expect(await screen.getByTestId("summary-still-vesting").textContent).toEqual("1,000.00")
    expect(await screen.getByTestId("summary-total-balance").textContent).toEqual("1,000.00")

    expect(await screen.getByTestId("summary-wallet-balance").className).toEqual("value")
    expect(await screen.getByTestId("summary-claimable").className).toEqual("value")
    expect(await screen.getByTestId("summary-still-vesting").className).toEqual("value")
    expect(await screen.getByTestId("summary-total-balance").className).toEqual("value")
  })

  it("staking reward partially claimed appear on portfolio", async () => {
    const {gfi, stakingRewards, communityRewards, merkleDistributor, user} = await setupPartiallyClaimedStakingReward(
      goldfinchProtocol,
      seniorPoolLoaded
    )

    renderRewards(stakingRewards, gfi, user, merkleDistributor, communityRewards)

    expect(await screen.findByText("Wallet balance")).toBeVisible()
    expect(await screen.findByText("Claimable")).toBeVisible()
    expect(await screen.findByText("Still vesting")).toBeVisible()
    expect(await screen.findByText("Total GFI balance")).toBeVisible()

    expect(await screen.getByTestId("summary-wallet-balance").textContent).toEqual("0.00")
    expect(await screen.getByTestId("summary-claimable").textContent).toEqual("2.24")
    expect(await screen.getByTestId("summary-still-vesting").textContent).toEqual("265.94")
    expect(await screen.getByTestId("summary-total-balance").textContent).toEqual("269.00")

    expect(await screen.getByTestId("summary-wallet-balance").className).toEqual("value")
    expect(await screen.getByTestId("summary-claimable").className).toEqual("value")
    expect(await screen.getByTestId("summary-still-vesting").className).toEqual("value")
    expect(await screen.getByTestId("summary-total-balance").className).toEqual("value")
  })
})
