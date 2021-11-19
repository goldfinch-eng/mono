import {CreditDesk} from "@goldfinch-eng/protocol/typechain/web3/CreditDesk"
import "@testing-library/jest-dom"
import {render, screen} from "@testing-library/react"
import {mock, resetMocks} from "depay-web3-mock"
import {BrowserRouter as Router} from "react-router-dom"
import {AppContext} from "../../App"
import {CommunityRewardsLoaded, MerkleDistributorLoaded} from "../../ethereum/communityRewards"
import {GFILoaded} from "../../ethereum/gfi"
import {GoldfinchProtocol} from "../../ethereum/GoldfinchProtocol"
import {PoolData, SeniorPool, SeniorPoolLoaded, StakingRewardsLoaded} from "../../ethereum/pool"
import {User, UserLoaded} from "../../ethereum/user"
import * as utils from "../../ethereum/utils"
import Rewards from "../../pages/rewards"
import {assertWithLoadedInfo} from "../../types/loadable"
import web3 from "../../web3"
import {blockchain, blockInfo, DEPLOYMENTS, network, recipient} from "../rewards/__utils__/constants"
import {
  assertAllMocksAreCalled,
  mockUserInitializationContractCalls,
  RewardsMockData,
  setupMocksForAirdrop,
} from "../rewards/__utils__/mocks"
import {
  getDefaultClasses,
  setupAirdrop,
  setupClaimableCommunityReward,
  setupClaimableStakingReward,
  setupCommunityRewardAndStakingReward,
  setupNewStakingReward,
  setupPartiallyClaimedStakingReward,
  setupVestingCommunityReward,
} from "../rewards/__utils__/scenarios"

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
  merkleDistributor: MerkleDistributorLoaded,
  rewardsMock?: RewardsMockData
): Promise<UserLoaded> {
  const user = new User(recipient, network.name, undefined as unknown as CreditDesk, goldfinchProtocol, undefined)
  const mocks = mockUserInitializationContractCalls(user, stakingRewards, gfi, communityRewards, rewardsMock)

  await user.initialize(seniorPoolLoaded, stakingRewards, gfi, communityRewards, merkleDistributor, blockInfo)
  assertAllMocksAreCalled(mocks)
  assertWithLoadedInfo(user)
  return user
}

describe("Rewards portfolio overview", () => {
  let seniorPoolLoaded: SeniorPoolLoaded
  let goldfinchProtocol = new GoldfinchProtocol(network)

  beforeEach(resetMocks)
  beforeEach(() => mock({blockchain, accounts: {return: [recipient]}}))
  beforeEach(async () => {
    jest.spyOn(utils, "getDeployments").mockImplementation(() => {
      return Promise.resolve(DEPLOYMENTS)
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
    seniorPoolLoaded = _seniorPoolLoaded
  })

  describe("loading state", () => {
    it("shows loading message when all requirements are empty", async () => {
      renderRewards(undefined, undefined, undefined, undefined, undefined)
      expect(await screen.findByText("Loading...")).toBeVisible()
    })

    it("shows loading message when all but one requirement are empty", async () => {
      const {stakingRewards} = await getDefaultClasses(goldfinchProtocol)
      renderRewards(stakingRewards, undefined, undefined, undefined, undefined)
      expect(await screen.findByText("Loading...")).toBeVisible()
    })
    it("shows loading message when all but two requirements are empty", async () => {
      const {stakingRewards, gfi} = await getDefaultClasses(goldfinchProtocol)
      renderRewards(stakingRewards, gfi, undefined, undefined, undefined)
      expect(await screen.findByText("Loading...")).toBeVisible()
    })
    it("shows loading message when all but three requirements are empty", async () => {
      const {stakingRewards, gfi, merkleDistributor, communityRewards} = await getDefaultClasses(goldfinchProtocol)
      const user = await getUserLoaded(
        goldfinchProtocol,
        seniorPoolLoaded,
        stakingRewards,
        gfi,
        communityRewards,
        merkleDistributor
      )
      renderRewards(stakingRewards, gfi, user, undefined, undefined)
      expect(await screen.findByText("Loading...")).toBeVisible()
    })
    it("shows loading message when all but four requirements are empty", async () => {
      const {stakingRewards, gfi, merkleDistributor, communityRewards} = await getDefaultClasses(goldfinchProtocol)
      const user = await getUserLoaded(
        goldfinchProtocol,
        seniorPoolLoaded,
        stakingRewards,
        gfi,
        communityRewards,
        merkleDistributor
      )
      renderRewards(stakingRewards, gfi, user, merkleDistributor, undefined)
      expect(await screen.findByText("Loading...")).toBeVisible()
    })

    it("doesn't show loading message when all requirements are loaded", async () => {
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
  })

  describe("claimable amount is 0", () => {
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

    it("shows wallet balance on portfolio", async () => {
      const {gfi, stakingRewards, communityRewards, merkleDistributor} = await getDefaultClasses(goldfinchProtocol)
      const user = await getUserLoaded(
        goldfinchProtocol,
        seniorPoolLoaded,
        stakingRewards,
        gfi,
        communityRewards,
        merkleDistributor,
        {gfi: {gfiBalance: "1000000000000000000"}}
      )
      renderRewards(stakingRewards, gfi, user, merkleDistributor, communityRewards)

      expect(await screen.findByText("Total GFI balance")).toBeVisible()
      expect(await screen.findByText("Wallet balance")).toBeVisible()
      expect(await screen.findByText("Claimable")).toBeVisible()
      expect(await screen.findByText("Still vesting")).toBeVisible()

      expect(await screen.getByTestId("summary-wallet-balance").textContent).toEqual("1.00")
      expect(await screen.getByTestId("summary-claimable").textContent).toEqual("0.00")
      expect(await screen.getByTestId("summary-still-vesting").textContent).toEqual("0.00")
      expect(await screen.getByTestId("summary-total-balance").textContent).toEqual("1.00")
    })
    it("staking reward before checkpoint (but still vesting) don't appear on portfolio", async () => {
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
  })

  describe("claimable amount > 0", () => {
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

    it("community reward without vesting appears on portfolio", async () => {
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

    it("community reward and staking reward appear on portfolio", async () => {
      const {gfi, stakingRewards, communityRewards, merkleDistributor, user} =
        await setupCommunityRewardAndStakingReward(goldfinchProtocol, seniorPoolLoaded)

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

    it("staking reward partially claimed (but with 0 wallet balance) appears on portfolio", async () => {
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
      expect(await screen.getByTestId("summary-total-balance").textContent).toEqual("268.18")

      expect(await screen.getByTestId("summary-wallet-balance").className).toEqual("value")
      expect(await screen.getByTestId("summary-claimable").className).toEqual("value")
      expect(await screen.getByTestId("summary-still-vesting").className).toEqual("value")
      expect(await screen.getByTestId("summary-total-balance").className).toEqual("value")
    })

    it("staking reward partially claimed (but with wallet balance) appears on portfolio", async () => {
      const {gfi, stakingRewards, communityRewards, merkleDistributor, user} = await setupPartiallyClaimedStakingReward(
        goldfinchProtocol,
        seniorPoolLoaded,
        "1000000000000000000"
      )

      renderRewards(stakingRewards, gfi, user, merkleDistributor, communityRewards)

      expect(await screen.findByText("Wallet balance")).toBeVisible()
      expect(await screen.findByText("Claimable")).toBeVisible()
      expect(await screen.findByText("Still vesting")).toBeVisible()
      expect(await screen.findByText("Total GFI balance")).toBeVisible()

      expect(await screen.getByTestId("summary-wallet-balance").textContent).toEqual("1.00")
      expect(await screen.getByTestId("summary-claimable").textContent).toEqual("2.24")
      expect(await screen.getByTestId("summary-still-vesting").textContent).toEqual("265.94")
      expect(await screen.getByTestId("summary-total-balance").textContent).toEqual("269.18")

      expect(await screen.getByTestId("summary-wallet-balance").className).toEqual("value")
      expect(await screen.getByTestId("summary-claimable").className).toEqual("value")
      expect(await screen.getByTestId("summary-still-vesting").className).toEqual("value")
      expect(await screen.getByTestId("summary-total-balance").className).toEqual("value")
    })
  })
})
