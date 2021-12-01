import {CreditDesk} from "@goldfinch-eng/protocol/typechain/web3/CreditDesk"
import "@testing-library/jest-dom"
import {fireEvent, render, screen, waitFor} from "@testing-library/react"
import BigNumber from "bignumber.js"
import {mock, resetMocks} from "depay-web3-mock"
import {BrowserRouter as Router} from "react-router-dom"
import {ThemeProvider} from "styled-components"
import {AppContext} from "../../App"
import {CommunityRewardsLoaded, MerkleDirectDistributorLoaded} from "../../ethereum/communityRewards"
import {GFILoaded} from "../../ethereum/gfi"
import {GoldfinchProtocol} from "../../ethereum/GoldfinchProtocol"
import {MerkleDistributorLoaded} from "../../ethereum/merkleDistributor"
import {NetworkMonitor} from "../../ethereum/networkMonitor"
import {PoolData, SeniorPool, SeniorPoolLoaded, StakingRewardsLoaded} from "../../ethereum/pool"
import {User, UserLoaded} from "../../ethereum/user"
import * as utils from "../../ethereum/utils"
import Rewards from "../../pages/rewards"
import {defaultTheme} from "../../styles/theme"
import {assertWithLoadedInfo} from "../../types/loadable"
import {BlockInfo} from "../../utils"
import web3 from "../../web3"
import {blockchain, defaultCurrentBlock, getDeployments, network, recipient} from "../rewards/__utils__/constants"
import {
  assertAllMocksAreCalled,
  mockUserInitializationContractCalls,
  resetAirdropMocks,
  RewardsMockData,
} from "../rewards/__utils__/mocks"
import {
  getDefaultClasses,
  merkleDistributorAirdropVesting,
  setupAcceptedDirectReward,
  setupClaimableCommunityReward,
  setupClaimableStakingReward,
  setupCommunityRewardAndDirectRewardAndStakingReward,
  setupCommunityRewardAndStakingReward,
  setupDirectReward,
  setupDirectRewardAndStakingReward,
  setupMerkleDirectDistributorAirdrop,
  setupMerkleDistributorAirdropNoVesting,
  setupMerkleDistributorAirdropVesting,
  setupNewStakingReward,
  setupPartiallyClaimedCommunityReward,
  setupPartiallyClaimedStakingReward,
  setupVestingCommunityReward,
} from "../rewards/__utils__/scenarios"

mock({
  blockchain: "ethereum",
})

web3.setProvider((global.window as any).ethereum)

function renderRewards(
  stakingRewards: StakingRewardsLoaded | undefined,
  gfi: GFILoaded | undefined,
  user: UserLoaded | undefined,
  merkleDistributor: MerkleDistributorLoaded | undefined,
  merkleDirectDistributor: MerkleDirectDistributorLoaded | undefined,
  communityRewards: CommunityRewardsLoaded | undefined,
  currentBlock: BlockInfo,
  refreshCurrentBlock?: () => Promise<void>,
  networkMonitor?: NetworkMonitor
) {
  const store = {
    currentBlock,
    network,
    stakingRewards,
    gfi,
    user,
    merkleDistributor,
    merkleDirectDistributor,
    communityRewards,
    refreshCurrentBlock,
    networkMonitor,
  }

  return render(
    <AppContext.Provider value={store}>
      <ThemeProvider theme={defaultTheme}>
        <Router>
          <Rewards />
        </Router>
      </ThemeProvider>
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
  merkleDirectDistributor: MerkleDirectDistributorLoaded,
  rewardsMock: RewardsMockData
): Promise<UserLoaded> {
  const user = new User(recipient, network.name, undefined as unknown as CreditDesk, goldfinchProtocol, undefined)
  const mocks = await mockUserInitializationContractCalls(
    user,
    stakingRewards,
    gfi,
    communityRewards,
    merkleDistributor,
    rewardsMock
  )

  await user.initialize(
    seniorPoolLoaded,
    stakingRewards,
    gfi,
    communityRewards,
    merkleDistributor,
    merkleDirectDistributor,
    rewardsMock.currentBlock
  )
  assertAllMocksAreCalled(mocks)
  assertWithLoadedInfo(user)
  return user
}

describe("Rewards portfolio overview", () => {
  let seniorPoolLoaded: SeniorPoolLoaded
  let goldfinchProtocol = new GoldfinchProtocol(network)
  const currentBlock = defaultCurrentBlock

  beforeEach(resetMocks)
  beforeEach(() => mock({blockchain, accounts: {return: [recipient]}}))
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
        poolData: {} as PoolData,
        isPaused: false,
      },
    }
    assertWithLoadedInfo(_seniorPoolLoaded)
    seniorPoolLoaded = _seniorPoolLoaded
  })

  describe("loading state", () => {
    it("shows loading message when all requirements are empty", async () => {
      renderRewards(undefined, undefined, undefined, undefined, undefined, undefined, currentBlock)
      expect(await screen.findByText("Loading...")).toBeVisible()
    })

    it("shows loading message when all but one requirement are empty", async () => {
      const {stakingRewards} = await getDefaultClasses(goldfinchProtocol, currentBlock)
      renderRewards(stakingRewards, undefined, undefined, undefined, undefined, undefined, currentBlock)
      expect(await screen.findByText("Loading...")).toBeVisible()
    })
    it("shows loading message when all but two requirements are empty", async () => {
      const {stakingRewards, gfi} = await getDefaultClasses(goldfinchProtocol, currentBlock)
      renderRewards(stakingRewards, gfi, undefined, undefined, undefined, undefined, currentBlock)
      expect(await screen.findByText("Loading...")).toBeVisible()
    })
    it("shows loading message when all but three requirements are empty", async () => {
      const {stakingRewards, gfi, merkleDistributor, merkleDirectDistributor, communityRewards} =
        await getDefaultClasses(goldfinchProtocol, currentBlock)
      const user = await getUserLoaded(
        goldfinchProtocol,
        seniorPoolLoaded,
        stakingRewards,
        gfi,
        communityRewards,
        merkleDistributor,
        merkleDirectDistributor,
        {currentBlock}
      )
      renderRewards(stakingRewards, gfi, user, undefined, undefined, undefined, currentBlock)
      expect(await screen.findByText("Loading...")).toBeVisible()
    })
    it("shows loading message when all but four requirements are empty", async () => {
      const {stakingRewards, gfi, merkleDistributor, merkleDirectDistributor, communityRewards} =
        await getDefaultClasses(goldfinchProtocol, currentBlock)
      const user = await getUserLoaded(
        goldfinchProtocol,
        seniorPoolLoaded,
        stakingRewards,
        gfi,
        communityRewards,
        merkleDistributor,
        merkleDirectDistributor,
        {currentBlock}
      )
      renderRewards(stakingRewards, gfi, user, merkleDistributor, undefined, undefined, currentBlock)
      expect(await screen.findByText("Loading...")).toBeVisible()
    })
    it("shows loading message when all but five requirements are empty", async () => {
      const {stakingRewards, gfi, merkleDistributor, merkleDirectDistributor, communityRewards} =
        await getDefaultClasses(goldfinchProtocol, currentBlock)
      const user = await getUserLoaded(
        goldfinchProtocol,
        seniorPoolLoaded,
        stakingRewards,
        gfi,
        communityRewards,
        merkleDistributor,
        merkleDirectDistributor,
        {currentBlock}
      )
      renderRewards(stakingRewards, gfi, user, merkleDistributor, merkleDirectDistributor, undefined, currentBlock)
      expect(await screen.findByText("Loading...")).toBeVisible()
    })

    it("doesn't show loading message when all requirements are loaded", async () => {
      const {gfi, stakingRewards, communityRewards, merkleDistributor, merkleDirectDistributor} =
        await getDefaultClasses(goldfinchProtocol, currentBlock)
      const user = await getUserLoaded(
        goldfinchProtocol,
        seniorPoolLoaded,
        stakingRewards,
        gfi,
        communityRewards,
        merkleDistributor,
        merkleDirectDistributor,
        {currentBlock}
      )
      renderRewards(
        stakingRewards,
        gfi,
        user,
        merkleDistributor,
        merkleDirectDistributor,
        communityRewards,
        currentBlock
      )

      expect(await screen.queryByText("Loading...")).not.toBeInTheDocument()
    })
  })

  it("shows empty portfolio", async () => {
    const {gfi, stakingRewards, communityRewards, merkleDistributor, merkleDirectDistributor} = await getDefaultClasses(
      goldfinchProtocol,
      currentBlock
    )
    const user = await getUserLoaded(
      goldfinchProtocol,
      seniorPoolLoaded,
      stakingRewards,
      gfi,
      communityRewards,
      merkleDistributor,
      merkleDirectDistributor,
      {currentBlock}
    )
    renderRewards(stakingRewards, gfi, user, merkleDistributor, merkleDirectDistributor, communityRewards, currentBlock)

    expect(await screen.findByText("Total GFI balance")).toBeVisible()
    expect(await screen.findByText("Wallet balance")).toBeVisible()
    expect(await screen.findByText("Fully vested")).toBeVisible()
    expect(await screen.findByText("Still vesting")).toBeVisible()

    expect(await screen.getByTestId("summary-wallet-balance").textContent).toEqual("0.00")
    expect(await screen.getByTestId("summary-claimable").textContent).toEqual("0.00")
    expect(await screen.getByTestId("summary-still-vesting").textContent).toEqual("0.00")
    expect(await screen.getByTestId("summary-total-balance").textContent).toEqual("0.00")
  })

  it("shows wallet balance on portfolio", async () => {
    const {gfi, stakingRewards, communityRewards, merkleDistributor, merkleDirectDistributor} = await getDefaultClasses(
      goldfinchProtocol,
      currentBlock
    )
    const user = await getUserLoaded(
      goldfinchProtocol,
      seniorPoolLoaded,
      stakingRewards,
      gfi,
      communityRewards,
      merkleDistributor,
      merkleDirectDistributor,
      {currentBlock, gfi: {gfiBalance: "1000000000000000000"}}
    )
    renderRewards(stakingRewards, gfi, user, merkleDistributor, merkleDirectDistributor, communityRewards, currentBlock)

    expect(await screen.findByText("Total GFI balance")).toBeVisible()
    expect(await screen.findByText("Wallet balance")).toBeVisible()
    expect(await screen.findByText("Fully vested")).toBeVisible()
    expect(await screen.findByText("Still vesting")).toBeVisible()

    expect(await screen.getByTestId("summary-wallet-balance").textContent).toEqual("1.00")
    expect(await screen.getByTestId("summary-claimable").textContent).toEqual("0.00")
    expect(await screen.getByTestId("summary-still-vesting").textContent).toEqual("0.00")
    expect(await screen.getByTestId("summary-total-balance").textContent).toEqual("1.00")
  })

  describe("StakingRewards", () => {
    it("in same block as staking, staking reward won't be reflected in portfolio, as nothing has vested and there is no optimistic increment", async () => {
      const {gfi, stakingRewards, communityRewards, merkleDistributor, merkleDirectDistributor, user} =
        await setupNewStakingReward(goldfinchProtocol, seniorPoolLoaded, currentBlock)

      renderRewards(
        stakingRewards,
        gfi,
        user,
        merkleDistributor,
        merkleDirectDistributor,
        communityRewards,
        currentBlock
      )

      expect(await screen.findByText("Total GFI balance")).toBeVisible()
      expect(await screen.findByText("Wallet balance")).toBeVisible()
      expect(await screen.findByText("Fully vested")).toBeVisible()
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

    xit("after staking but before unstaking or getting rewards, staking reward is reflected in portfolio, as optimistic increment", async () => {
      // TODO
    })

    xit("after partially unstaking, staking reward is reflected in portfolio, as sum of vested amount plus optimistic increment", async () => {
      // TODO
    })

    xit("after fully unstaking, staking reward is reflected in portfolio, as vested amount", async () => {
      // TODO
    })

    xit("after getting rewards, staking reward is reflected in portfolio, as sum of claimed amount and optimistic increment", async () => {
      // TODO
    })

    xit("after getting rewards and then partially unstaking, staking reward is reflected in portfolio, as sum of claimed amount, vested amount, and optimistic increment", async () => {
      // TODO
    })

    it("staking reward with non-zero claimable amount appears on portfolio", async () => {
      const {gfi, stakingRewards, communityRewards, merkleDistributor, merkleDirectDistributor, user} =
        await setupClaimableStakingReward(goldfinchProtocol, seniorPoolLoaded, currentBlock)

      renderRewards(
        stakingRewards,
        gfi,
        user,
        merkleDistributor,
        merkleDirectDistributor,
        communityRewards,
        currentBlock
      )

      expect(await screen.findByText("Total GFI balance")).toBeVisible()
      expect(await screen.findByText("Wallet balance")).toBeVisible()
      expect(await screen.findByText("Fully vested")).toBeVisible()
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

    describe("wallet balance is 0", () => {
      it("partially-claimed staking reward appears on portfolio", async () => {
        const {gfi, stakingRewards, communityRewards, merkleDistributor, merkleDirectDistributor, user} =
          await setupPartiallyClaimedStakingReward(goldfinchProtocol, seniorPoolLoaded, undefined, currentBlock)

        renderRewards(
          stakingRewards,
          gfi,
          user,
          merkleDistributor,
          merkleDirectDistributor,
          communityRewards,
          currentBlock
        )

        expect(await screen.findByText("Wallet balance")).toBeVisible()
        expect(await screen.findByText("Fully vested")).toBeVisible()
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
    })
    describe("wallet balance is > 0", () => {
      it("partially-claimed staking reward appears on portfolio", async () => {
        const {gfi, stakingRewards, communityRewards, merkleDistributor, merkleDirectDistributor, user} =
          await setupPartiallyClaimedStakingReward(
            goldfinchProtocol,
            seniorPoolLoaded,
            "1000000000000000000",
            currentBlock
          )

        renderRewards(
          stakingRewards,
          gfi,
          user,
          merkleDistributor,
          merkleDirectDistributor,
          communityRewards,
          currentBlock
        )

        expect(await screen.findByText("Wallet balance")).toBeVisible()
        expect(await screen.findByText("Fully vested")).toBeVisible()
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

  describe("CommunityRewards", () => {
    it("MerkleDistributor airdrop without vesting that has not been accepted is counted in portfolio", async () => {
      const {gfi, stakingRewards, communityRewards, merkleDistributor, merkleDirectDistributor, user} =
        await setupMerkleDistributorAirdropNoVesting(goldfinchProtocol, seniorPoolLoaded, currentBlock)

      renderRewards(
        stakingRewards,
        gfi,
        user,
        merkleDistributor,
        merkleDirectDistributor,
        communityRewards,
        currentBlock
      )

      expect(await screen.findByText("Total GFI balance")).toBeVisible()
      expect(await screen.findByText("Wallet balance")).toBeVisible()
      expect(await screen.findByText("Fully vested")).toBeVisible()
      expect(await screen.findByText("Still vesting")).toBeVisible()

      expect(await screen.getByTestId("summary-wallet-balance").textContent).toEqual("0.00")
      expect(await screen.getByTestId("summary-claimable").textContent).toEqual("1,000.00")
      expect(await screen.getByTestId("summary-still-vesting").textContent).toEqual("0.00")
      expect(await screen.getByTestId("summary-total-balance").textContent).toEqual("1,000.00")

      expect(await screen.getByTestId("summary-wallet-balance").className).toEqual("value")
      expect(await screen.getByTestId("summary-claimable").className).toEqual("value")
      expect(await screen.getByTestId("summary-still-vesting").className).toEqual("value")
      expect(await screen.getByTestId("summary-total-balance").className).toEqual("value")
    })

    it("MerkleDistributor airdrop with vesting that has not been accepted is counted in portfolio", async () => {
      const {gfi, stakingRewards, communityRewards, merkleDistributor, merkleDirectDistributor, user} =
        await setupMerkleDistributorAirdropVesting(
          goldfinchProtocol,
          seniorPoolLoaded,
          String(currentBlock.timestamp - parseInt(merkleDistributorAirdropVesting.grant.vestingLength, 16) / 2),
          new BigNumber(merkleDistributorAirdropVesting.grant.amount).dividedBy(2).toString(10),
          currentBlock
        )

      renderRewards(
        stakingRewards,
        gfi,
        user,
        merkleDistributor,
        merkleDirectDistributor,
        communityRewards,
        currentBlock
      )

      expect(await screen.findByText("Total GFI balance")).toBeVisible()
      expect(await screen.findByText("Wallet balance")).toBeVisible()
      expect(await screen.findByText("Fully vested")).toBeVisible()
      expect(await screen.findByText("Still vesting")).toBeVisible()

      expect(await screen.getByTestId("summary-wallet-balance").textContent).toEqual("0.00")
      expect(await screen.getByTestId("summary-claimable").textContent).toEqual("500.00")
      expect(await screen.getByTestId("summary-still-vesting").textContent).toEqual("500.00")
      expect(await screen.getByTestId("summary-total-balance").textContent).toEqual("1,000.00")

      expect(await screen.getByTestId("summary-wallet-balance").className).toEqual("value")
      expect(await screen.getByTestId("summary-claimable").className).toEqual("value")
      expect(await screen.getByTestId("summary-still-vesting").className).toEqual("value")
      expect(await screen.getByTestId("summary-total-balance").className).toEqual("value")
    })

    it("accepted community reward with vesting appears on portfolio", async () => {
      const {gfi, stakingRewards, communityRewards, merkleDistributor, merkleDirectDistributor, user} =
        await setupVestingCommunityReward(goldfinchProtocol, seniorPoolLoaded, currentBlock)
      renderRewards(
        stakingRewards,
        gfi,
        user,
        merkleDistributor,
        merkleDirectDistributor,
        communityRewards,
        currentBlock
      )

      expect(await screen.findByText("Wallet balance")).toBeVisible()
      expect(await screen.findByText("Fully vested")).toBeVisible()
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

    it("accepted community reward without vesting appears on portfolio", async () => {
      const {gfi, stakingRewards, communityRewards, merkleDistributor, merkleDirectDistributor, user} =
        await setupClaimableCommunityReward(goldfinchProtocol, seniorPoolLoaded, currentBlock)
      renderRewards(
        stakingRewards,
        gfi,
        user,
        merkleDistributor,
        merkleDirectDistributor,
        communityRewards,
        currentBlock
      )

      expect(await screen.findByText("Wallet balance")).toBeVisible()
      expect(await screen.findByText("Fully vested")).toBeVisible()
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

    it("accepted community reward partially claimed and still vesting appears on portfolio", async () => {
      const {gfi, stakingRewards, communityRewards, merkleDistributor, merkleDirectDistributor, user} =
        await setupPartiallyClaimedCommunityReward(
          goldfinchProtocol,
          seniorPoolLoaded,
          "5480000000000000000",
          currentBlock
        )
      renderRewards(
        stakingRewards,
        gfi,
        user,
        merkleDistributor,
        merkleDirectDistributor,
        communityRewards,
        currentBlock
      )

      expect(await screen.findByText("Wallet balance")).toBeVisible()
      expect(await screen.findByText("Fully vested")).toBeVisible()
      expect(await screen.findByText("Still vesting")).toBeVisible()
      expect(await screen.findByText("Total GFI balance")).toBeVisible()

      expect(await screen.getByTestId("summary-wallet-balance").textContent).toEqual("5.48")
      expect(await screen.getByTestId("summary-claimable").textContent).toEqual("10.96")
      expect(await screen.getByTestId("summary-still-vesting").textContent).toEqual("983.56")
      expect(await screen.getByTestId("summary-total-balance").textContent).toEqual("1,000.00")

      expect(await screen.getByTestId("summary-wallet-balance").className).toEqual("value")
      expect(await screen.getByTestId("summary-claimable").className).toEqual("value")
      expect(await screen.getByTestId("summary-still-vesting").className).toEqual("value")
      expect(await screen.getByTestId("summary-total-balance").className).toEqual("value")
    })
  })

  describe("MerkleDirectDistributor rewards", () => {
    it("MerkleDirectDistributor airdrop that has not been accepted is counted in portfolio", async () => {
      const {gfi, stakingRewards, communityRewards, merkleDistributor, merkleDirectDistributor, user} =
        await setupMerkleDirectDistributorAirdrop(goldfinchProtocol, seniorPoolLoaded, currentBlock)

      renderRewards(
        stakingRewards,
        gfi,
        user,
        merkleDistributor,
        merkleDirectDistributor,
        communityRewards,
        currentBlock
      )

      expect(await screen.findByText("Total GFI balance")).toBeVisible()
      expect(await screen.findByText("Wallet balance")).toBeVisible()
      expect(await screen.findByText("Fully vested")).toBeVisible()
      expect(await screen.findByText("Still vesting")).toBeVisible()

      expect(await screen.getByTestId("summary-wallet-balance").textContent).toEqual("0.00")
      expect(await screen.getByTestId("summary-claimable").textContent).toEqual("2,500.00")
      expect(await screen.getByTestId("summary-still-vesting").textContent).toEqual("0.00")
      expect(await screen.getByTestId("summary-total-balance").textContent).toEqual("2,500.00")

      expect(await screen.getByTestId("summary-wallet-balance").className).toEqual("value")
      expect(await screen.getByTestId("summary-claimable").className).toEqual("value")
      expect(await screen.getByTestId("summary-still-vesting").className).toEqual("value")
      expect(await screen.getByTestId("summary-total-balance").className).toEqual("value")
    })

    it("accepted MerkleDirectDistributor reward appears on portfolio", async () => {
      const {gfi, stakingRewards, communityRewards, merkleDistributor, merkleDirectDistributor, user} =
        await setupAcceptedDirectReward(goldfinchProtocol, seniorPoolLoaded, currentBlock)
      renderRewards(
        stakingRewards,
        gfi,
        user,
        merkleDistributor,
        merkleDirectDistributor,
        communityRewards,
        currentBlock
      )

      expect(await screen.findByText("Wallet balance")).toBeVisible()
      expect(await screen.findByText("Fully vested")).toBeVisible()
      expect(await screen.findByText("Still vesting")).toBeVisible()
      expect(await screen.findByText("Total GFI balance")).toBeVisible()

      expect(await screen.getByTestId("summary-wallet-balance").textContent).toEqual("2,500.00")
      expect(await screen.getByTestId("summary-claimable").textContent).toEqual("0.00")
      expect(await screen.getByTestId("summary-still-vesting").textContent).toEqual("0.00")
      expect(await screen.getByTestId("summary-total-balance").textContent).toEqual("2,500.00")

      expect(await screen.getByTestId("summary-wallet-balance").className).toEqual("value")
      expect(await screen.getByTestId("summary-claimable").className).toEqual("value")
      expect(await screen.getByTestId("summary-still-vesting").className).toEqual("value")
      expect(await screen.getByTestId("summary-total-balance").className).toEqual("value")
    })
  })

  describe("Staking and community rewards", () => {
    it("accepted community reward and staking reward appear on portfolio", async () => {
      const {gfi, stakingRewards, communityRewards, merkleDistributor, merkleDirectDistributor, user} =
        await setupCommunityRewardAndStakingReward(goldfinchProtocol, seniorPoolLoaded, currentBlock)

      renderRewards(
        stakingRewards,
        gfi,
        user,
        merkleDistributor,
        merkleDirectDistributor,
        communityRewards,
        currentBlock
      )

      expect(await screen.findByText("Total GFI balance")).toBeVisible()
      expect(await screen.findByText("Wallet balance")).toBeVisible()
      expect(await screen.findByText("Fully vested")).toBeVisible()
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
  })
})

describe("Rewards list and detail", () => {
  let seniorPool: SeniorPoolLoaded
  let goldfinchProtocol = new GoldfinchProtocol(network)
  const currentBlock = defaultCurrentBlock

  beforeEach(resetMocks)
  beforeEach(() => mock({blockchain, accounts: {return: [recipient]}}))
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
        poolData: {} as PoolData,
        isPaused: false,
      },
    }
    assertWithLoadedInfo(_seniorPoolLoaded)
    seniorPool = _seniorPoolLoaded
  })

  it("shows empty list", async () => {
    const {gfi, stakingRewards, communityRewards, merkleDistributor, merkleDirectDistributor} = await getDefaultClasses(
      goldfinchProtocol,
      currentBlock
    )

    const user = new User(recipient, network.name, undefined as unknown as CreditDesk, goldfinchProtocol, undefined)
    const mocks = await mockUserInitializationContractCalls(
      user,
      stakingRewards,
      gfi,
      communityRewards,
      merkleDistributor,
      {currentBlock}
    )
    await user.initialize(
      seniorPool,
      stakingRewards,
      gfi,
      communityRewards,
      merkleDistributor,
      merkleDirectDistributor,
      currentBlock
    )
    assertAllMocksAreCalled(mocks)
    assertWithLoadedInfo(user)

    const {container} = renderRewards(
      stakingRewards,
      gfi,
      user,
      merkleDistributor,
      merkleDirectDistributor,
      communityRewards,
      currentBlock
    )

    const list = container.getElementsByClassName("rewards-list-item")
    expect(list.length).toEqual(1)
    expect(list[0]?.textContent).toContain("You have no rewards. You can earn rewards by supplying")
  })

  it("shows staking reward on rewards list", async () => {
    const {gfi, stakingRewards, communityRewards, merkleDistributor, merkleDirectDistributor, user} =
      await setupNewStakingReward(goldfinchProtocol, seniorPool, currentBlock)
    renderRewards(stakingRewards, gfi, user, merkleDistributor, merkleDirectDistributor, communityRewards, currentBlock)

    expect(await screen.findByText("Staked 50K FIDU on Dec 29")).toBeVisible()
    expect(await screen.findByText("Vesting")).toBeVisible()
    expect((await screen.findAllByText("0.00")).length).toBe(7)

    fireEvent.click(screen.getByText("Staked 50K FIDU on Dec 29"))
    await waitFor(async () => {
      expect(await screen.findByText("Transaction details")).toBeVisible()
      expect(await screen.findByText("Vesting schedule")).toBeVisible()
      expect(await screen.findByText("Linear until 100% on Dec 29, 2022")).toBeVisible()

      expect(await screen.findByText("Claim status")).toBeVisible()
      expect(await screen.findByText("0.00 claimed of your total vested 0.00 GFI")).toBeVisible()

      expect(await screen.findByText("Current earn rate")).toBeVisible()
      expect(await screen.findByText("+453.60 granted per week")).toBeVisible()

      expect(await screen.findByText("Vesting status")).toBeVisible()
      expect(await screen.findByText("--.--% (0.00 GFI) vested")).toBeVisible()

      expect(screen.getByText("Etherscan").closest("a")).toHaveAttribute(
        "href",
        `https://${network.name}.etherscan.io/address/${stakingRewards.address}`
      )
    })
  })

  it("shows claimable staking reward on rewards list", async () => {
    const {gfi, stakingRewards, communityRewards, merkleDistributor, merkleDirectDistributor, user} =
      await setupClaimableStakingReward(goldfinchProtocol, seniorPool, currentBlock)

    renderRewards(stakingRewards, gfi, user, merkleDistributor, merkleDirectDistributor, communityRewards, currentBlock)

    expect(await screen.findByText("Staked 50K FIDU on Dec 29")).toBeVisible()
    expect(await screen.findByText("Claim GFI")).toBeVisible()

    expect(screen.getByTestId("detail-granted").textContent).toEqual("129.60")
    expect(screen.getByTestId("detail-claimable").textContent).toEqual("0.71")

    fireEvent.click(screen.getByText("Staked 50K FIDU on Dec 29"))
    await waitFor(async () => {
      expect(await screen.findByText("Transaction details")).toBeVisible()
      expect(await screen.findByText("Vesting schedule")).toBeVisible()
      expect(await screen.findByText("Linear until 100% on Dec 29, 2022")).toBeVisible()

      expect(await screen.findByText("Claim status")).toBeVisible()
      expect(await screen.findByText("0.00 claimed of your total vested 0.71 GFI")).toBeVisible()

      expect(await screen.findByText("Current earn rate")).toBeVisible()
      expect(await screen.findByText("+453.60 granted per week")).toBeVisible()

      expect(await screen.findByText("Vesting status")).toBeVisible()
      expect(await screen.findByText("0.55% (0.71 GFI) vested")).toBeVisible()

      expect(screen.getByText("Etherscan").closest("a")).toHaveAttribute(
        "href",
        `https://${network.name}.etherscan.io/address/${stakingRewards.address}`
      )
    })
  })

  it("shows claimable community reward on rewards list", async () => {
    const {gfi, stakingRewards, communityRewards, merkleDistributor, merkleDirectDistributor, user} =
      await setupClaimableCommunityReward(goldfinchProtocol, seniorPool, currentBlock)

    renderRewards(stakingRewards, gfi, user, merkleDistributor, merkleDirectDistributor, communityRewards, currentBlock)

    expect(await screen.findByText("Goldfinch Investment")).toBeVisible()
    expect(await screen.findByText("Claim GFI")).toBeVisible()

    expect(screen.getByTestId("detail-granted").textContent).toEqual("1,000.00")
    expect(screen.getByTestId("detail-claimable").textContent).toEqual("1,000.00")

    fireEvent.click(screen.getByText("Goldfinch Investment"))
    expect(await screen.findByText("Transaction details")).toBeVisible()
    expect(
      await screen.findByText("1,000.00 GFI reward on Dec 29, 2021 for participating as a Goldfinch investor")
    ).toBeVisible()

    expect(await screen.findByText("Vesting status")).toBeVisible()
    expect(await screen.findByText("100.00% (1,000.00 GFI) vested")).toBeVisible()

    expect(await screen.findByText("Vesting schedule")).toBeVisible()
    expect(await screen.findByText("Immediate")).toBeVisible()

    expect(screen.getByText("Etherscan").closest("a")).toHaveAttribute(
      "href",
      `https://${network.name}.etherscan.io/address/${communityRewards.address}`
    )
  })

  it("shows vesting community reward on rewards list", async () => {
    const {gfi, stakingRewards, communityRewards, merkleDistributor, merkleDirectDistributor, user} =
      await setupVestingCommunityReward(goldfinchProtocol, seniorPool, currentBlock)

    renderRewards(stakingRewards, gfi, user, merkleDistributor, merkleDirectDistributor, communityRewards, currentBlock)

    expect(await screen.findByText("Goldfinch Investment")).toBeVisible()
    expect(await screen.findByText("Vesting")).toBeVisible()

    expect(screen.getByTestId("detail-granted").textContent).toEqual("1,000.00")
    expect(screen.getByTestId("detail-claimable").textContent).toEqual("0.00")

    fireEvent.click(screen.getByText("Goldfinch Investment"))
    expect(await screen.findByText("Transaction details")).toBeVisible()
    expect(
      await screen.findByText("1,000.00 GFI reward on Dec 29, 2021 for participating as a Goldfinch investor")
    ).toBeVisible()

    expect(await screen.findByText("Vesting status")).toBeVisible()
    expect(await screen.findByText("0.00% (0.00 GFI) vested")).toBeVisible()

    expect(await screen.findByText("Vesting schedule")).toBeVisible()
    expect(await screen.findByText("Linear until 100% on Dec 29, 2021")).toBeVisible()

    expect(screen.getByText("Etherscan").closest("a")).toHaveAttribute(
      "href",
      `https://${network.name}.etherscan.io/address/${communityRewards.address}`
    )
  })

  it("shows airdrop from MerkleDistributor without vesting", async () => {
    const {gfi, stakingRewards, communityRewards, merkleDistributor, merkleDirectDistributor, user} =
      await setupMerkleDistributorAirdropNoVesting(goldfinchProtocol, seniorPool, currentBlock)

    renderRewards(stakingRewards, gfi, user, merkleDistributor, merkleDirectDistributor, communityRewards, currentBlock)

    expect(await screen.findByText("Goldfinch Investment")).toBeVisible()
    expect(await screen.findByText("Accept")).toBeVisible()

    expect(screen.getByTestId("detail-granted").textContent).toEqual("1,000.00")
    expect(screen.getByTestId("detail-claimable").textContent).toEqual("1,000.00")

    fireEvent.click(screen.getByText("Goldfinch Investment"))
    expect(await screen.findByText("Transaction details")).toBeVisible()
    expect(await screen.findByText("1,000.00 GFI reward for participating as a Goldfinch investor")).toBeVisible()

    expect(await screen.findByText("Vesting status")).toBeVisible()
    expect(await screen.findByText("$1,000.00 (1,000.00 GFI) vested")).toBeVisible()

    expect(await screen.findByText("Vesting schedule")).toBeVisible()
    expect(await screen.findByText("Immediate")).toBeVisible()

    expect(screen.getByText("Etherscan").closest("a")).toHaveAttribute(
      "href",
      `https://${network.name}.etherscan.io/address/${merkleDistributor.address}`
    )
  })

  it("shows airdrop from MerkleDistributor with vesting", async () => {
    const {gfi, stakingRewards, communityRewards, merkleDistributor, merkleDirectDistributor, user} =
      await setupMerkleDistributorAirdropVesting(
        goldfinchProtocol,
        seniorPool,
        String(currentBlock.timestamp - parseInt(merkleDistributorAirdropVesting.grant.vestingLength, 16) / 2),
        new BigNumber(merkleDistributorAirdropVesting.grant.amount).dividedBy(2).toString(10),
        currentBlock
      )

    renderRewards(stakingRewards, gfi, user, merkleDistributor, merkleDirectDistributor, communityRewards, currentBlock)

    expect(await screen.findByText("Goldfinch Investment")).toBeVisible()
    expect(await screen.findByText("Accept")).toBeVisible()

    expect(screen.getByTestId("detail-granted").textContent).toEqual("1,000.00")
    expect(screen.getByTestId("detail-claimable").textContent).toEqual("500.00")

    fireEvent.click(screen.getByText("Goldfinch Investment"))
    expect(await screen.findByText("Transaction details")).toBeVisible()
    expect(await screen.findByText("1,000.00 GFI reward for participating as a Goldfinch investor")).toBeVisible()

    expect(await screen.findByText("Vesting status")).toBeVisible()
    expect(await screen.findByText("$500.00 (500.00 GFI) vested")).toBeVisible()

    expect(await screen.findByText("Vesting schedule")).toBeVisible()
    expect(await screen.findByText("Linear until 100% on Dec 7, 2022")).toBeVisible()

    expect(screen.getByText("Etherscan").closest("a")).toHaveAttribute(
      "href",
      `https://${network.name}.etherscan.io/address/${merkleDistributor.address}`
    )
  })

  it("shows airdrop from MerkleDirectDistributor", async () => {
    const {gfi, stakingRewards, communityRewards, merkleDistributor, merkleDirectDistributor, user} =
      await setupMerkleDirectDistributorAirdrop(goldfinchProtocol, seniorPool, currentBlock)

    renderRewards(stakingRewards, gfi, user, merkleDistributor, merkleDirectDistributor, communityRewards, currentBlock)

    expect(await screen.findByText("Flight Academy")).toBeVisible()
    expect(await screen.findByText("Accept")).toBeVisible()

    expect(screen.getByTestId("detail-granted").textContent).toEqual("2,500.00")
    expect(screen.getByTestId("detail-claimable").textContent).toEqual("2,500.00")

    fireEvent.click(screen.getByText("Flight Academy"))
    expect(await screen.findByText("Transaction details")).toBeVisible()
    expect(await screen.findByText("2,500.00 GFI reward for participating in Flight Academy")).toBeVisible()

    expect(await screen.findByText("Vesting status")).toBeVisible()
    expect(await screen.findByText("$2,500.00 (2,500.00 GFI) vested")).toBeVisible()

    expect(await screen.findByText("Vesting schedule")).toBeVisible()
    expect(await screen.findByText("Immediate")).toBeVisible()

    expect(screen.getByText("Etherscan").closest("a")).toHaveAttribute(
      "href",
      `https://${network.name}.etherscan.io/address/${merkleDirectDistributor.address}`
    )
  })

  it("shows accepted community reward and staking reward", async () => {
    const {gfi, stakingRewards, communityRewards, merkleDistributor, merkleDirectDistributor, user} =
      await setupCommunityRewardAndStakingReward(goldfinchProtocol, seniorPool, currentBlock)

    renderRewards(stakingRewards, gfi, user, merkleDistributor, merkleDirectDistributor, communityRewards, currentBlock)

    expect(await screen.findByText("Staked 50K FIDU on Dec 29")).toBeVisible()
    expect(await screen.findByText("Goldfinch Investment")).toBeVisible()
    expect(await screen.getAllByText("Claim GFI").length).toBe(2)

    expect(screen.getAllByTestId("detail-granted")[0]?.textContent).toEqual("1,000.00")
    expect(screen.getAllByTestId("detail-claimable")[0]?.textContent).toEqual("1,000.00")
    expect(screen.getAllByTestId("detail-granted")[1]?.textContent).toEqual("129.60")
    expect(screen.getAllByTestId("detail-claimable")[1]?.textContent).toEqual("0.71")

    fireEvent.click(screen.getByText("Staked 50K FIDU on Dec 29"))
    expect(await screen.findByText("Transaction details")).toBeVisible()
    expect(await screen.findByText("Vesting schedule")).toBeVisible()
    expect(await screen.findByText("Linear until 100% on Dec 29, 2022")).toBeVisible()

    expect(await screen.findByText("Claim status")).toBeVisible()
    expect(await screen.findByText("0.00 claimed of your total vested 0.71 GFI")).toBeVisible()

    expect(await screen.findByText("Current earn rate")).toBeVisible()
    expect(await screen.findByText("+453.60 granted per week")).toBeVisible()

    expect(await screen.findByText("Vesting status")).toBeVisible()
    expect(await screen.findByText("0.55% (0.71 GFI) vested")).toBeVisible()

    expect(screen.getByText("Etherscan").closest("a")).toHaveAttribute(
      "href",
      `https://${network.name}.etherscan.io/address/${stakingRewards.address}`
    )
    fireEvent.click(screen.getByText("Staked 50K FIDU on Dec 29"))

    fireEvent.click(screen.getByText("Goldfinch Investment"))
    expect(await screen.findByText("Transaction details")).toBeVisible()
    expect(
      await screen.findByText("1,000.00 GFI reward on Dec 29, 2021 for participating as a Goldfinch investor")
    ).toBeVisible()

    expect(await screen.findByText("Vesting status")).toBeVisible()
    expect(await screen.findByText("100.00% (1,000.00 GFI) vested")).toBeVisible()

    expect(await screen.findByText("Vesting schedule")).toBeVisible()
    expect(await screen.findByText("Immediate")).toBeVisible()

    expect(screen.getByText("Etherscan").closest("a")).toHaveAttribute(
      "href",
      `https://${network.name}.etherscan.io/address/${communityRewards.address}`
    )
  })

  it("shows accepted MerkleDirectDistributor reward and staking reward", async () => {
    const {gfi, stakingRewards, communityRewards, merkleDistributor, merkleDirectDistributor, user} =
      await setupDirectRewardAndStakingReward(goldfinchProtocol, seniorPool, currentBlock)

    renderRewards(stakingRewards, gfi, user, merkleDistributor, merkleDirectDistributor, communityRewards, currentBlock)

    expect(await screen.findByText("Staked 50K FIDU on Dec 29")).toBeVisible()
    expect(await screen.findByText("Flight Academy")).toBeVisible()
    expect(await screen.getAllByText("Claim GFI").length).toBe(1)
    expect(await screen.getAllByText("Claimed").length).toBe(1)

    expect(screen.getAllByTestId("detail-granted")[0]?.textContent).toEqual("2,500.00")
    expect(screen.getAllByTestId("detail-claimable")[0]?.textContent).toEqual("0.00")
    expect(screen.getAllByTestId("detail-granted")[1]?.textContent).toEqual("129.60")
    expect(screen.getAllByTestId("detail-claimable")[1]?.textContent).toEqual("0.71")

    fireEvent.click(screen.getByText("Staked 50K FIDU on Dec 29"))
    expect(await screen.findByText("Transaction details")).toBeVisible()
    expect(await screen.findByText("Vesting schedule")).toBeVisible()
    expect(await screen.findByText("Linear until 100% on Dec 29, 2022")).toBeVisible()

    expect(await screen.findByText("Claim status")).toBeVisible()
    expect(await screen.findByText("0.00 claimed of your total vested 0.71 GFI")).toBeVisible()

    expect(await screen.findByText("Current earn rate")).toBeVisible()
    expect(await screen.findByText("+453.60 granted per week")).toBeVisible()

    expect(await screen.findByText("Vesting status")).toBeVisible()
    expect(await screen.findByText("0.55% (0.71 GFI) vested")).toBeVisible()

    expect(screen.getByText("Etherscan").closest("a")).toHaveAttribute(
      "href",
      `https://${network.name}.etherscan.io/address/${stakingRewards.address}`
    )
    fireEvent.click(screen.getByText("Staked 50K FIDU on Dec 29"))

    fireEvent.click(screen.getByText("Flight Academy"))
    expect(await screen.findByText("Transaction details")).toBeVisible()
    expect(await screen.findByText("2,500.00 GFI reward for participating in Flight Academy")).toBeVisible()

    expect(await screen.findByText("Vesting status")).toBeVisible()
    expect(await screen.findByText("$2,500.00 (2,500.00 GFI) vested")).toBeVisible()

    expect(await screen.findByText("Vesting schedule")).toBeVisible()
    expect(await screen.findByText("Immediate")).toBeVisible()

    expect(screen.getByText("Etherscan").closest("a")).toHaveAttribute(
      "href",
      `https://${network.name}.etherscan.io/address/${merkleDirectDistributor.address}`
    )
  })

  it("shows accepted community reward, accepted MerkleDirectDistributor reward, and staking reward", async () => {
    const {gfi, stakingRewards, communityRewards, merkleDistributor, merkleDirectDistributor, user} =
      await setupCommunityRewardAndDirectRewardAndStakingReward(goldfinchProtocol, seniorPool, currentBlock)

    renderRewards(stakingRewards, gfi, user, merkleDistributor, merkleDirectDistributor, communityRewards, currentBlock)

    expect(await screen.findByText("Staked 50K FIDU on Dec 29")).toBeVisible()
    expect(await screen.findByText("Goldfinch Investment")).toBeVisible()
    expect(await screen.findByText("Flight Academy")).toBeVisible()
    expect(await screen.getAllByText("Claim GFI").length).toBe(2)
    expect(await screen.getAllByText("Claimed").length).toBe(1)

    expect(screen.getAllByTestId("detail-granted")[0]?.textContent).toEqual("2,500.00")
    expect(screen.getAllByTestId("detail-claimable")[0]?.textContent).toEqual("0.00")
    expect(screen.getAllByTestId("detail-granted")[1]?.textContent).toEqual("1,000.00")
    expect(screen.getAllByTestId("detail-claimable")[1]?.textContent).toEqual("1,000.00")
    expect(screen.getAllByTestId("detail-granted")[2]?.textContent).toEqual("129.60")
    expect(screen.getAllByTestId("detail-claimable")[2]?.textContent).toEqual("0.71")

    fireEvent.click(screen.getByText("Staked 50K FIDU on Dec 29"))
    expect(await screen.findByText("Transaction details")).toBeVisible()
    expect(await screen.findByText("Vesting schedule")).toBeVisible()
    expect(await screen.findByText("Linear until 100% on Dec 29, 2022")).toBeVisible()

    expect(await screen.findByText("Claim status")).toBeVisible()
    expect(await screen.findByText("0.00 claimed of your total vested 0.71 GFI")).toBeVisible()

    expect(await screen.findByText("Current earn rate")).toBeVisible()
    expect(await screen.findByText("+453.60 granted per week")).toBeVisible()

    expect(await screen.findByText("Vesting status")).toBeVisible()
    expect(await screen.findByText("0.55% (0.71 GFI) vested")).toBeVisible()

    expect(screen.getByText("Etherscan").closest("a")).toHaveAttribute(
      "href",
      `https://${network.name}.etherscan.io/address/${stakingRewards.address}`
    )
    fireEvent.click(screen.getByText("Staked 50K FIDU on Dec 29"))

    fireEvent.click(screen.getByText("Goldfinch Investment"))
    expect(await screen.findByText("Transaction details")).toBeVisible()
    expect(
      await screen.findByText("1,000.00 GFI reward on Dec 29, 2021 for participating as a Goldfinch investor")
    ).toBeVisible()

    expect(await screen.findByText("Vesting status")).toBeVisible()
    expect(await screen.findByText("100.00% (1,000.00 GFI) vested")).toBeVisible()

    expect(await screen.findByText("Vesting schedule")).toBeVisible()
    expect(await screen.findByText("Immediate")).toBeVisible()

    expect(screen.getByText("Etherscan").closest("a")).toHaveAttribute(
      "href",
      `https://${network.name}.etherscan.io/address/${communityRewards.address}`
    )
    fireEvent.click(screen.getByText("Goldfinch Investment"))

    fireEvent.click(screen.getByText("Flight Academy"))
    expect(await screen.findByText("Transaction details")).toBeVisible()
    expect(await screen.findByText("2,500.00 GFI reward for participating in Flight Academy")).toBeVisible()

    expect(await screen.findByText("Vesting status")).toBeVisible()
    expect(await screen.findByText("$2,500.00 (2,500.00 GFI) vested")).toBeVisible()

    expect(await screen.findByText("Vesting schedule")).toBeVisible()
    expect(await screen.findByText("Immediate")).toBeVisible()

    expect(screen.getByText("Etherscan").closest("a")).toHaveAttribute(
      "href",
      `https://${network.name}.etherscan.io/address/${merkleDirectDistributor.address}`
    )
  })

  it("staking reward partially claimed appears on list", async () => {
    const {gfi, stakingRewards, communityRewards, merkleDistributor, merkleDirectDistributor, user} =
      await setupPartiallyClaimedStakingReward(goldfinchProtocol, seniorPool, undefined, currentBlock)

    renderRewards(stakingRewards, gfi, user, merkleDistributor, merkleDirectDistributor, communityRewards, currentBlock)

    expect(await screen.findByText("Staked 50K FIDU on Dec 29")).toBeVisible()
    expect(await screen.findByText("Claim GFI")).toBeVisible()

    expect(screen.getByTestId("detail-granted").textContent).toEqual("269.00")
    expect(screen.getByTestId("detail-claimable").textContent).toEqual("2.24")

    fireEvent.click(screen.getByText("Staked 50K FIDU on Dec 29"))
    await waitFor(async () => {
      expect(await screen.findByText("Transaction details")).toBeVisible()
      expect(await screen.findByText("Vesting schedule")).toBeVisible()
      expect(await screen.findByText("Linear until 100% on Dec 29, 2022")).toBeVisible()

      expect(await screen.findByText("Claim status")).toBeVisible()
      expect(await screen.findByText("0.82 claimed of your total vested 3.06 GFI")).toBeVisible()

      expect(await screen.findByText("Current earn rate")).toBeVisible()
      expect(await screen.findByText("+453.60 granted per week")).toBeVisible()

      expect(await screen.findByText("Vesting status")).toBeVisible()
      expect(await screen.findByText("1.14% (3.06 GFI) vested")).toBeVisible()

      expect(screen.getByText("Etherscan").closest("a")).toHaveAttribute(
        "href",
        `https://${network.name}.etherscan.io/address/${stakingRewards.address}`
      )
    })
  })

  it("community reward partially claimed appears on list", async () => {
    const {gfi, stakingRewards, communityRewards, merkleDistributor, merkleDirectDistributor, user} =
      await setupPartiallyClaimedCommunityReward(goldfinchProtocol, seniorPool, undefined, currentBlock)

    renderRewards(stakingRewards, gfi, user, merkleDistributor, merkleDirectDistributor, communityRewards, currentBlock)

    expect(await screen.findByText("Goldfinch Investment")).toBeVisible()
    expect(await screen.findByText("Claim GFI")).toBeVisible()

    expect(screen.getByTestId("detail-granted").textContent).toEqual("1,000.00")
    expect(screen.getByTestId("detail-claimable").textContent).toEqual("10.96")

    fireEvent.click(screen.getByText("Goldfinch Investment"))
    expect(await screen.findByText("Transaction details")).toBeVisible()
    expect(
      await screen.findByText("1,000.00 GFI reward on Dec 23, 2021 for participating as a Goldfinch investor")
    ).toBeVisible()

    expect(await screen.findByText("Vesting status")).toBeVisible()
    expect(await screen.findByText("1.64% (16.44 GFI) vested")).toBeVisible()

    expect(await screen.findByText("Vesting schedule")).toBeVisible()
    expect(await screen.findByText("Linear until 100% on Dec 8, 2022")).toBeVisible()

    expect(screen.getByText("Etherscan").closest("a")).toHaveAttribute(
      "href",
      `https://${network.name}.etherscan.io/address/${communityRewards.address}`
    )
  })

  it("Accepted MerkleDirectDistributor reward appears on list", async () => {
    const {gfi, stakingRewards, communityRewards, merkleDistributor, merkleDirectDistributor, user} =
      await setupDirectReward(goldfinchProtocol, seniorPool, currentBlock)

    renderRewards(stakingRewards, gfi, user, merkleDistributor, merkleDirectDistributor, communityRewards, currentBlock)

    expect(await screen.findByText("Flight Academy")).toBeVisible()
    expect(screen.getAllByText("Claimed").length).toBe(1)

    expect(screen.getAllByTestId("detail-granted")[0]?.textContent).toEqual("2,500.00")
    expect(screen.getAllByTestId("detail-claimable")[0]?.textContent).toEqual("0.00")

    fireEvent.click(screen.getByText("Flight Academy"))
    expect(await screen.findByText("Transaction details")).toBeVisible()
    expect(await screen.findByText("2,500.00 GFI reward for participating in Flight Academy")).toBeVisible()

    expect(await screen.findByText("Vesting status")).toBeVisible()
    expect(await screen.findByText("$2,500.00 (2,500.00 GFI) vested")).toBeVisible()

    expect(await screen.findByText("Vesting schedule")).toBeVisible()
    expect(await screen.findByText("Immediate")).toBeVisible()

    expect(screen.getByText("Etherscan").closest("a")).toHaveAttribute(
      "href",
      `https://${network.name}.etherscan.io/address/${merkleDirectDistributor.address}`
    )
  })

  describe("rewards transactions", () => {
    it("for MerkleDistributor airdrop, clicking button triggers sending `acceptGrant()`", async () => {
      const {gfi, stakingRewards, communityRewards, merkleDistributor, merkleDirectDistributor, user} =
        await setupMerkleDistributorAirdropNoVesting(goldfinchProtocol, seniorPool, currentBlock)
      const networkMonitor = {
        addPendingTX: () => {},
        watch: () => {},
        markTXErrored: () => {},
      } as unknown as NetworkMonitor
      const refreshCurrentBlock = jest.fn()

      renderRewards(
        stakingRewards,
        gfi,
        user,
        merkleDistributor,
        merkleDirectDistributor,
        communityRewards,
        currentBlock,
        refreshCurrentBlock,
        networkMonitor
      )

      expect(await screen.findByText("Goldfinch Investment")).toBeVisible()
      expect(await screen.findByText("Accept")).toBeVisible()

      web3.eth.getGasPrice = () => {
        return Promise.resolve("100000000")
      }
      const DEPLOYMENTS = await getDeployments()
      const acceptMock = mock({
        blockchain,
        transaction: {
          to: DEPLOYMENTS.contracts.MerkleDistributor.address,
          api: DEPLOYMENTS.contracts.MerkleDistributor.abi,
          method: "acceptGrant",
          params: [
            "0",
            "1000000000000000000000",
            "0",
            "0",
            "1",
            [
              "0x0000000000000000000000000000000000000000000000000000000000000000",
              "0x0000000000000000000000000000000000000000000000000000000000000000",
              "0x0000000000000000000000000000000000000000000000000000000000000000",
            ],
          ],
        },
      })

      fireEvent.click(screen.getByText("Accept"))
      await waitFor(async () => {
        expect(await screen.getByText("Accepting...")).toBeInTheDocument()
      })
      expect(acceptMock).toHaveBeenCalled()
    })

    it("for MerkleDirectDistributor airdrop, clicking button triggers sending `acceptGrant()`", async () => {
      const {gfi, stakingRewards, communityRewards, merkleDistributor, merkleDirectDistributor, user} =
        await setupMerkleDirectDistributorAirdrop(goldfinchProtocol, seniorPool, currentBlock)
      const networkMonitor = {
        addPendingTX: () => {},
        watch: () => {},
        markTXErrored: () => {},
      } as unknown as NetworkMonitor
      const refreshCurrentBlock = jest.fn()

      renderRewards(
        stakingRewards,
        gfi,
        user,
        merkleDistributor,
        merkleDirectDistributor,
        communityRewards,
        currentBlock,
        refreshCurrentBlock,
        networkMonitor
      )

      expect(await screen.findByText("Flight Academy")).toBeVisible()
      expect(await screen.findByText("Accept")).toBeVisible()

      web3.eth.getGasPrice = () => {
        return Promise.resolve("100000000")
      }
      const DEPLOYMENTS = await getDeployments()
      const acceptMock = mock({
        blockchain,
        transaction: {
          to: DEPLOYMENTS.contracts.MerkleDirectDistributor.address,
          api: DEPLOYMENTS.contracts.MerkleDirectDistributor.abi,
          method: "acceptGrant",
          params: [
            "0",
            "2500000000000000000000",
            [
              "0x0000000000000000000000000000000000000000000000000000000000000000",
              "0x0000000000000000000000000000000000000000000000000000000000000000",
              "0x0000000000000000000000000000000000000000000000000000000000000000",
            ],
          ],
        },
      })

      fireEvent.click(screen.getByText("Accept"))
      await waitFor(async () => {
        expect(await screen.getByText("Accepting...")).toBeInTheDocument()
      })
      expect(acceptMock).toHaveBeenCalled()
    })

    it("clicking community rewards button triggers sending `getReward()`", async () => {
      const {gfi, stakingRewards, communityRewards, merkleDistributor, merkleDirectDistributor, user} =
        await setupClaimableCommunityReward(goldfinchProtocol, seniorPool, currentBlock)
      const networkMonitor = {
        addPendingTX: () => {},
        watch: () => {},
        markTXErrored: () => {},
      } as unknown as NetworkMonitor
      const refreshCurrentBlock = jest.fn()

      renderRewards(
        stakingRewards,
        gfi,
        user,
        merkleDistributor,
        merkleDirectDistributor,
        communityRewards,
        currentBlock,
        refreshCurrentBlock,
        networkMonitor
      )

      expect(await screen.findByText("Goldfinch Investment")).toBeVisible()
      expect(await screen.findByText("Claim GFI")).toBeVisible()

      web3.eth.getGasPrice = () => {
        return Promise.resolve("100000000")
      }
      const DEPLOYMENTS = await getDeployments()
      const getRewardMock = mock({
        blockchain,
        transaction: {
          to: DEPLOYMENTS.contracts.CommunityRewards.address,
          api: DEPLOYMENTS.contracts.CommunityRewards.abi,
          method: "getReward",
          params: "1",
        },
      })

      fireEvent.click(screen.getByText("Claim GFI"))
      await waitFor(async () => {
        expect(screen.getByText("Submit")).not.toBeDisabled()
      })
      fireEvent.click(screen.getByText("Submit"))
      await waitFor(async () => {
        expect(await screen.getByText("Submitting...")).toBeInTheDocument()
      })

      expect(getRewardMock).toHaveBeenCalled()
    })

    it("clicking staking reward button triggers sending `getReward()`", async () => {
      const {gfi, stakingRewards, communityRewards, merkleDistributor, merkleDirectDistributor, user} =
        await setupClaimableStakingReward(goldfinchProtocol, seniorPool, currentBlock)
      const networkMonitor = {
        addPendingTX: () => {},
        watch: () => {},
        markTXErrored: () => {},
      } as unknown as NetworkMonitor
      const refreshCurrentBlock = jest.fn()

      renderRewards(
        stakingRewards,
        gfi,
        user,
        merkleDistributor,
        merkleDirectDistributor,
        communityRewards,
        currentBlock,
        refreshCurrentBlock,
        networkMonitor
      )

      expect(await screen.findByText("Claim GFI")).toBeVisible()

      web3.eth.getGasPrice = () => {
        return Promise.resolve("100000000")
      }
      const DEPLOYMENTS = await getDeployments()
      const getRewardMock = mock({
        blockchain,
        transaction: {
          to: DEPLOYMENTS.contracts.StakingRewards.address,
          api: DEPLOYMENTS.contracts.StakingRewards.abi,
          method: "getReward",
          params: "1",
        },
      })

      fireEvent.click(screen.getByText("Claim GFI"))
      await waitFor(async () => {
        expect(screen.getByText("Submit")).not.toBeDisabled()
      })
      fireEvent.click(screen.getByText("Submit"))
      await waitFor(async () => {
        expect(await screen.getByText("Submitting...")).toBeInTheDocument()
      })

      expect(getRewardMock).toHaveBeenCalled()
    })
  })
})
