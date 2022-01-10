import "@testing-library/jest-dom"
import {fireEvent, render, screen, waitFor} from "@testing-library/react"
import BigNumber from "bignumber.js"
import {mock, resetMocks} from "depay-web3-mock"
import {MemoryRouter as Router} from "react-router-dom"
import {ThemeProvider} from "styled-components"
import {AppContext, LeavesCurrentBlock} from "../../App"
import {CommunityRewardsLoaded} from "../../ethereum/communityRewards"
import {GFILoaded} from "../../ethereum/gfi"
import {GoldfinchProtocol} from "../../ethereum/GoldfinchProtocol"
import {MerkleDirectDistributorLoaded} from "../../ethereum/merkleDirectDistributor"
import {MerkleDistributorLoaded} from "../../ethereum/merkleDistributor"
import {NetworkMonitor} from "../../ethereum/networkMonitor"
import {PoolData, SeniorPool, SeniorPoolLoaded, StakingRewardsLoaded} from "../../ethereum/pool"
import {
  UserCommunityRewardsLoaded,
  UserLoaded,
  UserMerkleDirectDistributorLoaded,
  UserMerkleDistributorLoaded,
} from "../../ethereum/user"
import * as utils from "../../ethereum/utils"
import Rewards from "../../pages/rewards"
import {defaultTheme} from "../../styles/theme"
import {assertWithLoadedInfo} from "../../types/loadable"
import {
  ABOUT_ROUTE,
  AppRoute,
  BORROW_ROUTE,
  EARN_ROUTE,
  INDEX_ROUTE,
  PRIVACY_POLICY_ROUTE,
  GFI_ROUTE,
  SENIOR_POOL_AGREEMENT_NON_US_ROUTE,
  SENIOR_POOL_ROUTE,
  TERMS_OF_SERVICE_ROUTE,
  TRANCHED_POOL_ROUTE,
  TRANSACTIONS_ROUTE,
  VERIFY_ROUTE,
} from "../../types/routes"
import {SessionData} from "../../types/session"
import {UserWalletWeb3Status} from "../../types/web3"
import {BlockInfo} from "../../utils"
import web3, {getUserWalletWeb3Status} from "../../web3"
import {blockchain, defaultCurrentBlock, getDeployments, network, recipient} from "../rewards/__utils__/constants"
import {resetAirdropMocks} from "../rewards/__utils__/mocks"
import {
  merkleDistributorAirdropVesting,
  prepareBaseDeps,
  prepareUserRelatedDeps,
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

web3.readOnly.setProvider((global.window as any).ethereum)
web3.userWallet.setProvider((global.window as any).ethereum)

function renderRewards(
  deps: {
    stakingRewards: StakingRewardsLoaded | undefined
    gfi: GFILoaded | undefined
    user: UserLoaded | undefined
    merkleDistributor: MerkleDistributorLoaded | undefined
    merkleDirectDistributor: MerkleDirectDistributorLoaded | undefined
    communityRewards: CommunityRewardsLoaded | undefined
    userMerkleDistributor: UserMerkleDistributorLoaded | undefined
    userMerkleDirectDistributor: UserMerkleDirectDistributorLoaded | undefined
    userCommunityRewards: UserCommunityRewardsLoaded | undefined
  },
  currentBlock: BlockInfo,
  refreshCurrentBlock?: () => Promise<void>,
  networkMonitor?: NetworkMonitor,
  sessionData?: SessionData,
  leavesCurrentBlock?: LeavesCurrentBlock,
  userWalletWeb3Status?: UserWalletWeb3Status
) {
  sessionData = sessionData || {
    signature: "foo",
    signatureBlockNum: currentBlock.number,
    signatureBlockNumTimestamp: currentBlock.timestamp,
    version: 1,
  }
  let defaultUserWalletWeb3Status
  if (deps.user) {
    defaultUserWalletWeb3Status = {
      type: "connected",
      networkName: "localhost",
      address: deps.user.address,
    }
  } else {
    defaultUserWalletWeb3Status = {
      type: "no_web3",
      networkName: undefined,
      address: undefined,
    }
  }
  userWalletWeb3Status = userWalletWeb3Status || defaultUserWalletWeb3Status
  const setLeafCurrentBlock = (route: AppRoute, currentBlock: BlockInfo) => {
    // pass
  }
  const store = {
    currentBlock,
    leavesCurrentBlock,
    refreshCurrentBlock,
    setLeafCurrentBlock,
    network,
    networkMonitor,
    sessionData,
    userWalletWeb3Status,
    ...deps,
  }

  return render(
    <AppContext.Provider value={store}>
      <ThemeProvider theme={defaultTheme}>
        <Router initialEntries={[GFI_ROUTE]}>
          <Rewards />
        </Router>
      </ThemeProvider>
    </AppContext.Provider>
  )
}

describe("Rewards portfolio overview", () => {
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

  describe("loading state", () => {
    it("shows loading message when all requirements are empty", async () => {
      renderRewards(
        {
          stakingRewards: undefined,
          gfi: undefined,
          user: undefined,
          merkleDistributor: undefined,
          merkleDirectDistributor: undefined,
          communityRewards: undefined,
          userMerkleDistributor: undefined,
          userMerkleDirectDistributor: undefined,
          userCommunityRewards: undefined,
        },
        currentBlock
      )
      expect(await screen.findByText("Loading...")).toBeVisible()
    })

    it("shows loading message when all but one requirement are empty", async () => {
      const {stakingRewards} = await prepareBaseDeps(goldfinchProtocol, currentBlock)
      renderRewards(
        {
          stakingRewards,
          gfi: undefined,
          user: undefined,
          merkleDistributor: undefined,
          merkleDirectDistributor: undefined,
          communityRewards: undefined,
          userMerkleDistributor: undefined,
          userMerkleDirectDistributor: undefined,
          userCommunityRewards: undefined,
        },
        currentBlock
      )
      expect(await screen.findByText("Loading...")).toBeVisible()
    })
    it("shows loading message when all but two requirements are empty", async () => {
      const {stakingRewards, gfi} = await prepareBaseDeps(goldfinchProtocol, currentBlock)
      renderRewards(
        {
          stakingRewards,
          gfi,
          user: undefined,
          merkleDistributor: undefined,
          merkleDirectDistributor: undefined,
          communityRewards: undefined,
          userMerkleDistributor: undefined,
          userMerkleDirectDistributor: undefined,
          userCommunityRewards: undefined,
        },
        currentBlock
      )
      expect(await screen.findByText("Loading...")).toBeVisible()
    })
    it("shows loading message when all but three requirements are empty", async () => {
      const baseDeps = await prepareBaseDeps(goldfinchProtocol, currentBlock)
      const {user} = await prepareUserRelatedDeps({goldfinchProtocol, seniorPool, ...baseDeps}, {currentBlock})
      renderRewards(
        {
          stakingRewards: baseDeps.stakingRewards,
          gfi: baseDeps.gfi,
          user,
          merkleDistributor: undefined,
          merkleDirectDistributor: undefined,
          communityRewards: undefined,
          userMerkleDistributor: undefined,
          userMerkleDirectDistributor: undefined,
          userCommunityRewards: undefined,
        },
        currentBlock
      )
      expect(await screen.findByText("Loading...")).toBeVisible()
    })
    it("shows loading message when all but four requirements are empty", async () => {
      const baseDeps = await prepareBaseDeps(goldfinchProtocol, currentBlock)
      const {user} = await prepareUserRelatedDeps({goldfinchProtocol, seniorPool, ...baseDeps}, {currentBlock})
      renderRewards(
        {
          stakingRewards: baseDeps.stakingRewards,
          gfi: baseDeps.gfi,
          user,
          merkleDistributor: baseDeps.merkleDistributor,
          merkleDirectDistributor: undefined,
          communityRewards: undefined,
          userMerkleDistributor: undefined,
          userMerkleDirectDistributor: undefined,
          userCommunityRewards: undefined,
        },
        currentBlock
      )
      expect(await screen.findByText("Loading...")).toBeVisible()
    })
    it("shows loading message when all but five requirements are empty", async () => {
      const baseDeps = await prepareBaseDeps(goldfinchProtocol, currentBlock)
      const {user} = await prepareUserRelatedDeps({goldfinchProtocol, seniorPool, ...baseDeps}, {currentBlock})
      renderRewards(
        {
          stakingRewards: baseDeps.stakingRewards,
          gfi: baseDeps.gfi,
          user,
          merkleDistributor: baseDeps.merkleDistributor,
          merkleDirectDistributor: baseDeps.merkleDirectDistributor,
          communityRewards: undefined,
          userMerkleDistributor: undefined,
          userMerkleDirectDistributor: undefined,
          userCommunityRewards: undefined,
        },
        currentBlock
      )
      expect(await screen.findByText("Loading...")).toBeVisible()
    })
    it("shows loading message when all but six requirements are empty", async () => {
      const baseDeps = await prepareBaseDeps(goldfinchProtocol, currentBlock)
      const {user} = await prepareUserRelatedDeps({goldfinchProtocol, seniorPool, ...baseDeps}, {currentBlock})
      renderRewards(
        {
          stakingRewards: baseDeps.stakingRewards,
          gfi: baseDeps.gfi,
          user,
          merkleDistributor: baseDeps.merkleDistributor,
          merkleDirectDistributor: baseDeps.merkleDirectDistributor,
          communityRewards: baseDeps.communityRewards,
          userMerkleDistributor: undefined,
          userMerkleDirectDistributor: undefined,
          userCommunityRewards: undefined,
        },
        currentBlock
      )
      expect(await screen.findByText("Loading...")).toBeVisible()
    })
    it("shows loading message when all but seven requirements are empty", async () => {
      const baseDeps = await prepareBaseDeps(goldfinchProtocol, currentBlock)
      const {user, userMerkleDistributor} = await prepareUserRelatedDeps(
        {goldfinchProtocol, seniorPool, ...baseDeps},
        {currentBlock}
      )
      renderRewards(
        {
          stakingRewards: baseDeps.stakingRewards,
          gfi: baseDeps.gfi,
          user,
          merkleDistributor: baseDeps.merkleDistributor,
          merkleDirectDistributor: baseDeps.merkleDirectDistributor,
          communityRewards: baseDeps.communityRewards,
          userMerkleDistributor,
          userMerkleDirectDistributor: undefined,
          userCommunityRewards: undefined,
        },
        currentBlock
      )
      expect(await screen.findByText("Loading...")).toBeVisible()
    })
    it("shows loading message when all but eight requirements are empty", async () => {
      const baseDeps = await prepareBaseDeps(goldfinchProtocol, currentBlock)
      const {user, userMerkleDistributor, userMerkleDirectDistributor} = await prepareUserRelatedDeps(
        {goldfinchProtocol, seniorPool, ...baseDeps},
        {currentBlock}
      )
      renderRewards(
        {
          stakingRewards: baseDeps.stakingRewards,
          gfi: baseDeps.gfi,
          user,
          merkleDistributor: baseDeps.merkleDistributor,
          merkleDirectDistributor: baseDeps.merkleDirectDistributor,
          communityRewards: baseDeps.communityRewards,
          userMerkleDistributor,
          userMerkleDirectDistributor,
          userCommunityRewards: undefined,
        },
        currentBlock
      )
      expect(await screen.findByText("Loading...")).toBeVisible()
    })

    it("doesn't show loading message when all requirements are loaded", async () => {
      const baseDeps = await prepareBaseDeps(goldfinchProtocol, currentBlock)
      const {user, userMerkleDistributor, userMerkleDirectDistributor, userCommunityRewards} =
        await prepareUserRelatedDeps({goldfinchProtocol, seniorPool, ...baseDeps}, {currentBlock})
      renderRewards(
        {
          stakingRewards: baseDeps.stakingRewards,
          gfi: baseDeps.gfi,
          user,
          merkleDistributor: baseDeps.merkleDistributor,
          merkleDirectDistributor: baseDeps.merkleDirectDistributor,
          communityRewards: baseDeps.communityRewards,
          userMerkleDistributor,
          userMerkleDirectDistributor,
          userCommunityRewards,
        },
        currentBlock
      )

      expect(await screen.queryByText("Loading...")).not.toBeInTheDocument()
    })
  })

  it("shows empty portfolio", async () => {
    const baseDeps = await prepareBaseDeps(goldfinchProtocol, currentBlock)
    const userRelated = await prepareUserRelatedDeps({goldfinchProtocol, seniorPool, ...baseDeps}, {currentBlock})
    renderRewards({...baseDeps, ...userRelated}, currentBlock)

    expect(await screen.findByText("Total rewards")).toBeVisible()
    expect(await screen.findByText("Claimable")).toBeVisible()
    expect(await screen.findByText("Vesting", {selector: "span"})).toBeVisible()

    expect(await screen.getByTestId("summary-claimable").textContent).toEqual("0.00")
    expect(await screen.getByTestId("summary-still-vesting").textContent).toEqual("0.00")
    expect(await screen.getByTestId("summary-total-balance").textContent).toEqual("0.00")
  })

  it("shows wallet balance on portfolio", async () => {
    const baseDeps = await prepareBaseDeps(goldfinchProtocol, currentBlock)
    const userRelated = await prepareUserRelatedDeps(
      {goldfinchProtocol, seniorPool, ...baseDeps},
      {currentBlock, gfi: {gfiBalance: "1000000000000000000"}}
    )
    renderRewards({...baseDeps, ...userRelated}, currentBlock)

    expect(await screen.findByText("Total rewards")).toBeVisible()
    expect(await screen.findByText("Claimable")).toBeVisible()
    expect(await screen.findByText("Vesting", {selector: "span"})).toBeVisible()

    expect(await screen.getByTestId("summary-claimable").textContent).toEqual("0.00")
    expect(await screen.getByTestId("summary-still-vesting").textContent).toEqual("0.00")
    expect(await screen.getByTestId("summary-total-balance").textContent).toEqual("1.00")
  })

  describe("StakingRewards", () => {
    it("in same block as staking, staking reward won't be reflected in portfolio, as nothing has vested and there is no optimistic increment", async () => {
      const deps = await setupNewStakingReward(goldfinchProtocol, seniorPool, currentBlock)

      renderRewards(deps, currentBlock)

      expect(await screen.findByText("Total rewards")).toBeVisible()
      expect(await screen.findByText("Claimable")).toBeVisible()
      expect(await screen.findByText("Vesting", {selector: "span"})).toBeVisible()

      expect(await screen.getByTestId("summary-claimable").textContent).toEqual("0.00")
      expect(await screen.getByTestId("summary-still-vesting").textContent).toEqual("0.00")
      expect(await screen.getByTestId("summary-total-balance").textContent).toEqual("0.00")

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
      const deps = await setupClaimableStakingReward(goldfinchProtocol, seniorPool, currentBlock)

      renderRewards(deps, currentBlock)

      expect(await screen.findByText("Total rewards")).toBeVisible()
      expect(await screen.findByText("Claimable")).toBeVisible()
      expect(await screen.findByText("Vesting", {selector: "span"})).toBeVisible()

      expect(await screen.getByTestId("summary-claimable").textContent).toEqual("0.71")
      expect(await screen.getByTestId("summary-still-vesting").textContent).toEqual("128.89")
      expect(await screen.getByTestId("summary-total-balance").textContent).toEqual("129.60")

      expect(await screen.getByTestId("summary-claimable").className).toEqual("value")
      expect(await screen.getByTestId("summary-still-vesting").className).toEqual("value")
      expect(await screen.getByTestId("summary-total-balance").className).toEqual("value")
    })

    describe("wallet balance is 0", () => {
      it("partially-claimed staking reward appears on portfolio", async () => {
        const deps = await setupPartiallyClaimedStakingReward(goldfinchProtocol, seniorPool, undefined, currentBlock)

        renderRewards(deps, currentBlock)

        expect(await screen.findByText("Claimable")).toBeVisible()
        expect(await screen.findByText("Vesting", {selector: "span"})).toBeVisible()
        expect(await screen.findByText("Total rewards")).toBeVisible()

        expect(await screen.getByTestId("summary-claimable").textContent).toEqual("2.24")
        expect(await screen.getByTestId("summary-still-vesting").textContent).toEqual("265.94")
        expect(await screen.getByTestId("summary-total-balance").textContent).toEqual("268.18")

        expect(await screen.getByTestId("summary-claimable").className).toEqual("value")
        expect(await screen.getByTestId("summary-still-vesting").className).toEqual("value")
        expect(await screen.getByTestId("summary-total-balance").className).toEqual("value")
      })
    })
    describe("wallet balance is > 0", () => {
      it("partially-claimed staking reward appears on portfolio", async () => {
        const deps = await setupPartiallyClaimedStakingReward(
          goldfinchProtocol,
          seniorPool,
          "1000000000000000000",
          currentBlock
        )

        renderRewards(deps, currentBlock)

        expect(await screen.findByText("Claimable")).toBeVisible()
        expect(await screen.findByText("Vesting", {selector: "span"})).toBeVisible()
        expect(await screen.findByText("Total rewards")).toBeVisible()

        expect(await screen.getByTestId("summary-claimable").textContent).toEqual("2.24")
        expect(await screen.getByTestId("summary-still-vesting").textContent).toEqual("265.94")
        expect(await screen.getByTestId("summary-total-balance").textContent).toEqual("269.18")

        expect(await screen.getByTestId("summary-claimable").className).toEqual("value")
        expect(await screen.getByTestId("summary-still-vesting").className).toEqual("value")
        expect(await screen.getByTestId("summary-total-balance").className).toEqual("value")
      })
    })
  })

  describe("CommunityRewards", () => {
    it("MerkleDistributor airdrop without vesting that has not been accepted is counted in portfolio", async () => {
      const deps = await setupMerkleDistributorAirdropNoVesting(goldfinchProtocol, seniorPool, currentBlock)

      renderRewards(deps, currentBlock)

      expect(await screen.findByText("Total rewards")).toBeVisible()
      expect(await screen.findByText("Claimable")).toBeVisible()
      expect(await screen.findByText("Vesting", {selector: "span"})).toBeVisible()

      expect(await screen.getByTestId("summary-claimable").textContent).toEqual("1,000.00")
      expect(await screen.getByTestId("summary-still-vesting").textContent).toEqual("0.00")
      expect(await screen.getByTestId("summary-total-balance").textContent).toEqual("1,000.00")

      expect(await screen.getByTestId("summary-claimable").className).toEqual("value")
      expect(await screen.getByTestId("summary-still-vesting").className).toEqual("value")
      expect(await screen.getByTestId("summary-total-balance").className).toEqual("value")
    })

    it("MerkleDistributor airdrop with vesting that has not been accepted is counted in portfolio", async () => {
      const deps = await setupMerkleDistributorAirdropVesting(
        goldfinchProtocol,
        seniorPool,
        String(currentBlock.timestamp - parseInt(merkleDistributorAirdropVesting.grant.vestingLength, 16) / 2),
        new BigNumber(merkleDistributorAirdropVesting.grant.amount).dividedBy(2).toString(10),
        currentBlock
      )

      renderRewards(deps, currentBlock)

      expect(await screen.findByText("Total rewards")).toBeVisible()
      expect(await screen.findByText("Claimable")).toBeVisible()
      expect(await screen.findByText("Vesting", {selector: "span"})).toBeVisible()

      expect(await screen.getByTestId("summary-claimable").textContent).toEqual("500.00")
      expect(await screen.getByTestId("summary-still-vesting").textContent).toEqual("500.00")
      expect(await screen.getByTestId("summary-total-balance").textContent).toEqual("1,000.00")

      expect(await screen.getByTestId("summary-claimable").className).toEqual("value")
      expect(await screen.getByTestId("summary-still-vesting").className).toEqual("value")
      expect(await screen.getByTestId("summary-total-balance").className).toEqual("value")
    })

    it("accepted community reward with vesting appears on portfolio", async () => {
      const deps = await setupVestingCommunityReward(goldfinchProtocol, seniorPool, currentBlock)
      renderRewards(deps, currentBlock)

      expect(await screen.findByText("Claimable")).toBeVisible()
      expect(await screen.findByText("Vesting", {selector: "span"})).toBeVisible()
      expect(await screen.findByText("Total rewards")).toBeVisible()

      expect(await screen.getByTestId("summary-claimable").textContent).toEqual("0.00")
      expect(await screen.getByTestId("summary-still-vesting").textContent).toEqual("1,000.00")
      expect(await screen.getByTestId("summary-total-balance").textContent).toEqual("1,000.00")

      expect(await screen.getByTestId("summary-claimable").className).toEqual("value")
      expect(await screen.getByTestId("summary-still-vesting").className).toEqual("value")
      expect(await screen.getByTestId("summary-total-balance").className).toEqual("value")
    })

    it("accepted community reward without vesting appears on portfolio", async () => {
      const deps = await setupClaimableCommunityReward(goldfinchProtocol, seniorPool, currentBlock)
      renderRewards(deps, currentBlock)

      expect(await screen.findByText("Claimable")).toBeVisible()
      expect(await screen.findByText("Vesting", {selector: "span"})).toBeVisible()
      expect(await screen.findByText("Total rewards")).toBeVisible()

      expect(await screen.getByTestId("summary-claimable").textContent).toEqual("1,000.00")
      expect(await screen.getByTestId("summary-still-vesting").textContent).toEqual("0.00")
      expect(await screen.getByTestId("summary-total-balance").textContent).toEqual("1,000.00")

      expect(await screen.getByTestId("summary-claimable").className).toEqual("value")
      expect(await screen.getByTestId("summary-still-vesting").className).toEqual("value")
      expect(await screen.getByTestId("summary-total-balance").className).toEqual("value")
    })

    it("accepted community reward partially claimed and still vesting appears on portfolio", async () => {
      const deps = await setupPartiallyClaimedCommunityReward(
        goldfinchProtocol,
        seniorPool,
        "5480000000000000000",
        currentBlock
      )
      renderRewards(deps, currentBlock)

      expect(await screen.findByText("Claimable")).toBeVisible()
      expect(await screen.findByText("Vesting", {selector: "span"})).toBeVisible()
      expect(await screen.findByText("Total rewards")).toBeVisible()

      expect(await screen.getByTestId("summary-claimable").textContent).toEqual("10.96")
      expect(await screen.getByTestId("summary-still-vesting").textContent).toEqual("983.56")
      expect(await screen.getByTestId("summary-total-balance").textContent).toEqual("1,000.00")

      expect(await screen.getByTestId("summary-claimable").className).toEqual("value")
      expect(await screen.getByTestId("summary-still-vesting").className).toEqual("value")
      expect(await screen.getByTestId("summary-total-balance").className).toEqual("value")
    })
  })

  describe("MerkleDirectDistributor rewards", () => {
    it("MerkleDirectDistributor airdrop that has not been accepted is counted in portfolio", async () => {
      const deps = await setupMerkleDirectDistributorAirdrop(goldfinchProtocol, seniorPool, currentBlock)

      renderRewards(deps, currentBlock)

      expect(await screen.findByText("Total rewards")).toBeVisible()
      expect(await screen.findByText("Claimable")).toBeVisible()
      expect(await screen.findByText("Vesting", {selector: "span"})).toBeVisible()

      expect(await screen.getByTestId("summary-claimable").textContent).toEqual("2,500.00")
      expect(await screen.getByTestId("summary-still-vesting").textContent).toEqual("0.00")
      expect(await screen.getByTestId("summary-total-balance").textContent).toEqual("2,500.00")

      expect(await screen.getByTestId("summary-claimable").className).toEqual("value")
      expect(await screen.getByTestId("summary-still-vesting").className).toEqual("value")
      expect(await screen.getByTestId("summary-total-balance").className).toEqual("value")
    })

    it("accepted MerkleDirectDistributor reward appears on portfolio", async () => {
      const deps = await setupAcceptedDirectReward(goldfinchProtocol, seniorPool, currentBlock)
      renderRewards(deps, currentBlock)

      expect(await screen.findByText("Claimable")).toBeVisible()
      expect(await screen.findByText("Vesting", {selector: "span"})).toBeVisible()
      expect(await screen.findByText("Total rewards")).toBeVisible()

      expect(await screen.getByTestId("summary-claimable").textContent).toEqual("0.00")
      expect(await screen.getByTestId("summary-still-vesting").textContent).toEqual("0.00")
      expect(await screen.getByTestId("summary-total-balance").textContent).toEqual("2,500.00")

      expect(await screen.getByTestId("summary-claimable").className).toEqual("value")
      expect(await screen.getByTestId("summary-still-vesting").className).toEqual("value")
      expect(await screen.getByTestId("summary-total-balance").className).toEqual("value")
    })
  })

  describe("Staking and community rewards", () => {
    it("accepted community reward and staking reward appear on portfolio", async () => {
      const deps = await setupCommunityRewardAndStakingReward(goldfinchProtocol, seniorPool, currentBlock)

      renderRewards(deps, currentBlock)

      expect(await screen.findByText("Total rewards")).toBeVisible()
      expect(await screen.findByText("Claimable")).toBeVisible()
      expect(await screen.findByText("Vesting", {selector: "span"})).toBeVisible()

      expect(await screen.getByTestId("summary-claimable").textContent).toEqual("1,000.71")
      expect(await screen.getByTestId("summary-still-vesting").textContent).toEqual("128.89")
      expect(await screen.getByTestId("summary-total-balance").textContent).toEqual("1,129.60")

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
  const OLD_ENV = process.env

  beforeEach(() => {
    jest.resetModules()
    process.env = {...OLD_ENV}
  })
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

  afterAll(() => {
    process.env = OLD_ENV
  })

  it("shows empty list", async () => {
    const baseDeps = await prepareBaseDeps(goldfinchProtocol, currentBlock)
    const userRelatedDeps = await prepareUserRelatedDeps({goldfinchProtocol, seniorPool, ...baseDeps}, {currentBlock})
    const deps = {...baseDeps, ...userRelatedDeps}

    const {container} = renderRewards(deps, currentBlock)

    const list = container.getElementsByClassName("rewards-list-item")
    expect(list.length).toEqual(1)
    expect(list[0]?.textContent).toContain("You have no rewards. You can earn rewards by supplying")
  })

  it("disables all buttons during global refresh", async () => {
    const deps = await setupClaimableStakingReward(goldfinchProtocol, seniorPool, currentBlock)

    renderRewards(deps, currentBlock, undefined, undefined, undefined, {
      [INDEX_ROUTE]: undefined,
      [EARN_ROUTE]: undefined,
      [ABOUT_ROUTE]: undefined,
      [GFI_ROUTE]: {number: currentBlock.number - 1, timestamp: currentBlock.timestamp - 1},
      [BORROW_ROUTE]: undefined,
      [TRANSACTIONS_ROUTE]: undefined,
      [SENIOR_POOL_ROUTE]: undefined,
      [TRANCHED_POOL_ROUTE]: undefined,
      [VERIFY_ROUTE]: undefined,
      [TERMS_OF_SERVICE_ROUTE]: undefined,
      [PRIVACY_POLICY_ROUTE]: undefined,
      [SENIOR_POOL_AGREEMENT_NON_US_ROUTE]: undefined,
    })

    expect(await screen.findByText("Staked 50K FIDU")).toBeVisible()
    expect(screen.getByText("129.60 GFI to date • Dec 29, 2021")).toBeVisible()
    expect(await screen.findByText("Claim GFI")).toBeVisible()
    expect(await screen.findByText("Claim GFI")).toHaveClass("disabled-button")
  })

  it("shows staking reward on rewards list", async () => {
    const deps = await setupNewStakingReward(goldfinchProtocol, seniorPool, currentBlock)
    renderRewards(deps, currentBlock)

    expect(await screen.findByText("Staked 50K FIDU")).toBeVisible()
    expect(screen.getByText("0.00 GFI to date • Dec 29, 2021")).toBeVisible()
    expect(await screen.findByText("Vesting", {selector: "button"})).toBeVisible()
    expect((await screen.findAllByText("0.00")).length).toBe(6)

    fireEvent.click(screen.getByText("Staked 50K FIDU"))
    await waitFor(async () => {
      expect(await screen.findByText("Transaction details")).toBeVisible()
      expect(await screen.findByText("Vesting schedule")).toBeVisible()
      expect(await screen.findByText("Linear until 100% on Dec 29, 2022")).toBeVisible()

      expect(await screen.findByText("Claim status")).toBeVisible()
      expect(await screen.findByText("$0.00 (0.00 GFI) claimed of your total vested 0.00 GFI")).toBeVisible()

      expect(await screen.findByText("Current earn rate")).toBeVisible()
      expect(await screen.findByText("+453.60 GFI granted per week")).toBeVisible()

      expect(await screen.findByText("Vesting status")).toBeVisible()
      expect(await screen.findByText("--.--% (0.00 GFI) vested")).toBeVisible()

      expect(screen.getByText("Etherscan").closest("a")).toHaveAttribute(
        "href",
        `https://${network.name}.etherscan.io/address/${deps.stakingRewards.address}`
      )
    })
  })

  it("shows default value when GFI price is undefined", async () => {
    process.env.REACT_APP_TOGGLE_GET_GFI_PRICE = "true"

    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({goldfinch: {usd: undefined}}),
      })
    ) as jest.Mock

    const deps = await setupClaimableStakingReward(goldfinchProtocol, seniorPool, currentBlock)

    renderRewards(deps, currentBlock)

    fireEvent.click(screen.getByText("Staked 50K FIDU"))
    await waitFor(async () => {
      expect(await screen.findByText("Claim status")).toBeVisible()
      expect(await screen.findByText("$--.-- (0.00 GFI) claimed of your total vested 0.71 GFI")).toBeVisible()
    })
  })

  it("shows default value if the request returns an empty object", async () => {
    process.env.REACT_APP_TOGGLE_GET_GFI_PRICE = "true"

    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      })
    ) as jest.Mock

    const deps = await setupPartiallyClaimedStakingReward(goldfinchProtocol, seniorPool, undefined, currentBlock)

    renderRewards(deps, currentBlock)

    fireEvent.click(screen.getByText("Staked 50K FIDU"))
    expect(await screen.findByText("Claim status")).toBeVisible()
    expect(await screen.findByText("$--.-- (0.82 GFI) claimed of your total vested 3.06 GFI")).toBeVisible()
  })

  it("shows GFI price from Coingecko API", async () => {
    process.env.REACT_APP_TOGGLE_GET_GFI_PRICE = "true"

    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({goldfinch: {usd: 200}}),
      })
    ) as jest.Mock

    const deps = await setupPartiallyClaimedStakingReward(goldfinchProtocol, seniorPool, undefined, currentBlock)

    renderRewards(deps, currentBlock)

    fireEvent.click(screen.getByText("Staked 50K FIDU"))
    expect(await screen.findByText("Claim status")).toBeVisible()
    expect(await screen.findByText("$164.33 (0.82 GFI) claimed of your total vested 3.06 GFI")).toBeVisible()
  })

  it("shows claimable staking reward on rewards list", async () => {
    const deps = await setupClaimableStakingReward(goldfinchProtocol, seniorPool, currentBlock)

    renderRewards(deps, currentBlock)

    expect(await screen.findByText("Staked 50K FIDU")).toBeVisible()
    expect(screen.getByText("129.60 GFI to date • Dec 29, 2021")).toBeVisible()
    expect(await screen.findByText("Claim GFI")).toBeVisible()

    expect(screen.getByTestId("detail-unvested").textContent).toEqual("128.89")
    expect(screen.getByTestId("detail-claimable").textContent).toEqual("0.71")

    fireEvent.click(screen.getByText("Staked 50K FIDU"))
    await waitFor(async () => {
      expect(await screen.findByText("Transaction details")).toBeVisible()
      expect(await screen.findByText("Vesting schedule")).toBeVisible()
      expect(await screen.findByText("Linear until 100% on Dec 29, 2022")).toBeVisible()

      expect(await screen.findByText("Claim status")).toBeVisible()
      expect(await screen.findByText("$0.00 (0.00 GFI) claimed of your total vested 0.71 GFI")).toBeVisible()

      expect(await screen.findByText("Current earn rate")).toBeVisible()
      expect(await screen.findByText("+453.60 GFI granted per week")).toBeVisible()

      expect(await screen.findByText("Vesting status")).toBeVisible()
      expect(await screen.findByText("0.55% (0.71 GFI) vested")).toBeVisible()

      expect(screen.getByText("Etherscan").closest("a")).toHaveAttribute(
        "href",
        `https://${network.name}.etherscan.io/address/${deps.stakingRewards.address}`
      )
    })
  })

  it("shows claimable community reward on rewards list", async () => {
    const deps = await setupClaimableCommunityReward(goldfinchProtocol, seniorPool, currentBlock)

    renderRewards(deps, currentBlock)

    expect(await screen.findByText("Goldfinch Investment")).toBeVisible()
    expect(screen.getByText("1,000.00 GFI • Dec 29, 2021")).toBeVisible()
    expect(await screen.findByText("Claim GFI")).toBeVisible()

    expect(screen.getByTestId("detail-unvested").textContent).toEqual("0.00")
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

    expect(await screen.findByText("Claim status")).toBeVisible()
    expect(await screen.findByText("$0.00 (0.00 GFI) claimed of your total vested 1,000.00 GFI")).toBeVisible()

    expect(screen.getByText("Etherscan").closest("a")).toHaveAttribute(
      "href",
      `https://${network.name}.etherscan.io/address/${deps.communityRewards.address}`
    )
  })

  it("shows vesting community reward on rewards list", async () => {
    const deps = await setupVestingCommunityReward(goldfinchProtocol, seniorPool, currentBlock)

    renderRewards(deps, currentBlock)

    expect(await screen.findByText("Goldfinch Investment")).toBeVisible()
    expect(screen.getByText("1,000.00 GFI • Dec 29, 2021")).toBeVisible()
    expect(await screen.findByText("Vesting", {selector: "button"})).toBeVisible()

    expect(screen.getByTestId("detail-unvested").textContent).toEqual("1,000.00")
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

    expect(await screen.findByText("Claim status")).toBeVisible()
    expect(await screen.findByText("$0.00 (0.00 GFI) claimed of your total vested 0.00 GFI")).toBeVisible()

    expect(screen.getByText("Etherscan").closest("a")).toHaveAttribute(
      "href",
      `https://${network.name}.etherscan.io/address/${deps.communityRewards.address}`
    )
  })

  it("shows airdrop from MerkleDistributor without vesting", async () => {
    const deps = await setupMerkleDistributorAirdropNoVesting(goldfinchProtocol, seniorPool, currentBlock)

    renderRewards(deps, currentBlock)

    expect(await screen.findByText("Goldfinch Investment")).toBeVisible()
    expect(screen.getByText("1,000.00 GFI • Jan 11, 2022")).toBeVisible()
    expect(await screen.findByText("Accept")).toBeVisible()

    expect(screen.getByTestId("detail-unvested").textContent).toEqual("0.00")
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
      `https://${network.name}.etherscan.io/address/${deps.merkleDistributor.address}`
    )
  })

  it("shows airdrop from MerkleDistributor with vesting", async () => {
    const deps = await setupMerkleDistributorAirdropVesting(
      goldfinchProtocol,
      seniorPool,
      String(currentBlock.timestamp - parseInt(merkleDistributorAirdropVesting.grant.vestingLength, 16) / 2),
      new BigNumber(merkleDistributorAirdropVesting.grant.amount).dividedBy(2).toString(10),
      currentBlock
    )

    renderRewards(deps, currentBlock)

    expect(await screen.findByText("Goldfinch Investment")).toBeVisible()
    expect(screen.getByText("1,000.00 GFI • Jan 11, 2022")).toBeVisible()
    expect(await screen.findByText("Accept")).toBeVisible()

    expect(screen.getByTestId("detail-unvested").textContent).toEqual("500.00")
    expect(screen.getByTestId("detail-claimable").textContent).toEqual("500.00")

    fireEvent.click(screen.getByText("Goldfinch Investment"))
    expect(await screen.findByText("Transaction details")).toBeVisible()
    expect(await screen.findByText("1,000.00 GFI reward for participating as a Goldfinch investor")).toBeVisible()

    expect(await screen.findByText("Vesting status")).toBeVisible()
    expect(await screen.findByText("$500.00 (500.00 GFI) vested")).toBeVisible()

    expect(await screen.findByText("Vesting schedule")).toBeVisible()
    expect(await screen.findByText("Linear until 100% on Jan 11, 2023")).toBeVisible()

    expect(screen.getByText("Etherscan").closest("a")).toHaveAttribute(
      "href",
      `https://${network.name}.etherscan.io/address/${deps.merkleDistributor.address}`
    )
  })

  it("shows airdrop from MerkleDirectDistributor", async () => {
    const deps = await setupMerkleDirectDistributorAirdrop(goldfinchProtocol, seniorPool, currentBlock)

    renderRewards(deps, currentBlock)

    expect(await screen.findByText("Flight Academy")).toBeVisible()
    expect(screen.getByText("2,500.00 GFI • Jan 11, 2022")).toBeVisible()
    expect(await screen.findByText("Claim GFI")).toBeVisible()

    expect(screen.getByTestId("detail-unvested").textContent).toEqual("0.00")
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
      `https://${network.name}.etherscan.io/address/${deps.merkleDirectDistributor.address}`
    )
  })

  it("shows accepted community reward and staking reward", async () => {
    const deps = await setupCommunityRewardAndStakingReward(goldfinchProtocol, seniorPool, currentBlock)

    renderRewards(deps, currentBlock)

    expect(await screen.findByText("Staked 50K FIDU")).toBeVisible()
    expect(screen.getByText("129.60 GFI to date • Dec 29, 2021")).toBeVisible()
    expect(await screen.findByText("Goldfinch Investment")).toBeVisible()
    expect(screen.getByText("1,000.00 GFI • Dec 29, 2021")).toBeVisible()
    expect(await screen.getAllByText("Claim GFI").length).toBe(2)

    expect(screen.getAllByTestId("detail-unvested")[0]?.textContent).toEqual("128.89")
    expect(screen.getAllByTestId("detail-claimable")[0]?.textContent).toEqual("0.71")
    expect(screen.getAllByTestId("detail-unvested")[1]?.textContent).toEqual("0.00")
    expect(screen.getAllByTestId("detail-claimable")[1]?.textContent).toEqual("1,000.00")

    fireEvent.click(screen.getByText("Staked 50K FIDU"))
    expect(await screen.findByText("Transaction details")).toBeVisible()
    expect(await screen.findByText("Vesting schedule")).toBeVisible()
    expect(await screen.findByText("Linear until 100% on Dec 29, 2022")).toBeVisible()

    expect(await screen.findByText("Claim status")).toBeVisible()
    expect(await screen.findByText("$0.00 (0.00 GFI) claimed of your total vested 0.71 GFI")).toBeVisible()

    expect(await screen.findByText("Current earn rate")).toBeVisible()
    expect(await screen.findByText("+453.60 GFI granted per week")).toBeVisible()

    expect(await screen.findByText("Vesting status")).toBeVisible()
    expect(await screen.findByText("0.55% (0.71 GFI) vested")).toBeVisible()

    expect(screen.getByText("Etherscan").closest("a")).toHaveAttribute(
      "href",
      `https://${network.name}.etherscan.io/address/${deps.stakingRewards.address}`
    )
    fireEvent.click(screen.getByText("Staked 50K FIDU"))

    fireEvent.click(screen.getByText("Goldfinch Investment"))
    expect(await screen.findByText("Transaction details")).toBeVisible()
    expect(
      await screen.findByText("1,000.00 GFI reward on Dec 29, 2021 for participating as a Goldfinch investor")
    ).toBeVisible()

    expect(await screen.findByText("Vesting status")).toBeVisible()
    expect(await screen.findByText("100.00% (1,000.00 GFI) vested")).toBeVisible()

    expect(await screen.findByText("Vesting schedule")).toBeVisible()
    expect(await screen.findByText("Immediate")).toBeVisible()

    expect(await screen.findByText("Claim status")).toBeVisible()
    expect(await screen.findByText("$0.00 (0.00 GFI) claimed of your total vested 1,000.00 GFI")).toBeVisible()

    expect(screen.getByText("Etherscan").closest("a")).toHaveAttribute(
      "href",
      `https://${network.name}.etherscan.io/address/${deps.communityRewards.address}`
    )
  })

  it("shows accepted MerkleDirectDistributor reward and staking reward", async () => {
    const deps = await setupDirectRewardAndStakingReward(goldfinchProtocol, seniorPool, currentBlock)

    renderRewards(deps, currentBlock)

    expect(await screen.findByText("Staked 50K FIDU")).toBeVisible()
    expect(screen.getByText("129.60 GFI to date • Dec 29, 2021")).toBeVisible()
    expect(await screen.findByText("Flight Academy")).toBeVisible()
    expect(screen.getByText("2,500.00 GFI • Jan 11, 2022")).toBeVisible()
    expect(await screen.getAllByText("Claim GFI").length).toBe(1)
    expect(await screen.getAllByText("Claimed").length).toBe(1)

    expect(screen.getAllByTestId("detail-unvested")[0]?.textContent).toEqual("128.89")
    expect(screen.getAllByTestId("detail-claimable")[0]?.textContent).toEqual("0.71")
    expect(screen.getAllByTestId("detail-unvested")[1]?.textContent).toEqual("0.00")
    expect(screen.getAllByTestId("detail-claimable")[1]?.textContent).toEqual("0.00")

    fireEvent.click(screen.getByText("Staked 50K FIDU"))
    expect(await screen.findByText("Transaction details")).toBeVisible()
    expect(await screen.findByText("Vesting schedule")).toBeVisible()
    expect(await screen.findByText("Linear until 100% on Dec 29, 2022")).toBeVisible()

    expect(await screen.findByText("Claim status")).toBeVisible()
    expect(await screen.findByText("$0.00 (0.00 GFI) claimed of your total vested 0.71 GFI")).toBeVisible()

    expect(await screen.findByText("Current earn rate")).toBeVisible()
    expect(await screen.findByText("+453.60 GFI granted per week")).toBeVisible()

    expect(await screen.findByText("Vesting status")).toBeVisible()
    expect(await screen.findByText("0.55% (0.71 GFI) vested")).toBeVisible()

    expect(screen.getByText("Etherscan").closest("a")).toHaveAttribute(
      "href",
      `https://${network.name}.etherscan.io/address/${deps.stakingRewards.address}`
    )
    fireEvent.click(screen.getByText("Staked 50K FIDU"))

    fireEvent.click(screen.getByText("Flight Academy"))
    expect(await screen.findByText("Transaction details")).toBeVisible()
    expect(await screen.findByText("2,500.00 GFI reward for participating in Flight Academy")).toBeVisible()

    expect(await screen.findByText("Vesting status")).toBeVisible()
    expect(await screen.findByText("$2,500.00 (2,500.00 GFI) vested")).toBeVisible()

    expect(await screen.findByText("Vesting schedule")).toBeVisible()
    expect(await screen.findByText("Immediate")).toBeVisible()

    expect(screen.getByText("Etherscan").closest("a")).toHaveAttribute(
      "href",
      `https://${network.name}.etherscan.io/address/${deps.merkleDirectDistributor.address}`
    )
  })

  it("shows accepted community reward, accepted MerkleDirectDistributor reward, and staking reward", async () => {
    const deps = await setupCommunityRewardAndDirectRewardAndStakingReward(goldfinchProtocol, seniorPool, currentBlock)

    renderRewards(deps, currentBlock)

    expect(await screen.findByText("Staked 50K FIDU")).toBeVisible()
    expect(screen.getByText("129.60 GFI to date • Dec 29, 2021")).toBeVisible()
    expect(await screen.findByText("Goldfinch Investment")).toBeVisible()
    expect(screen.getByText("1,000.00 GFI • Dec 29, 2021")).toBeVisible()
    expect(await screen.findByText("Flight Academy")).toBeVisible()
    expect(screen.getByText("2,500.00 GFI • Jan 11, 2022")).toBeVisible()
    expect(await screen.getAllByText("Claim GFI").length).toBe(2)
    expect(await screen.getAllByText("Claimed").length).toBe(1)

    expect(screen.getAllByTestId("detail-unvested")[0]?.textContent).toEqual("128.89")
    expect(screen.getAllByTestId("detail-claimable")[0]?.textContent).toEqual("0.71")
    expect(screen.getAllByTestId("detail-unvested")[1]?.textContent).toEqual("0.00")
    expect(screen.getAllByTestId("detail-claimable")[1]?.textContent).toEqual("1,000.00")
    expect(screen.getAllByTestId("detail-unvested")[2]?.textContent).toEqual("0.00")
    expect(screen.getAllByTestId("detail-claimable")[2]?.textContent).toEqual("0.00")

    fireEvent.click(screen.getByText("Staked 50K FIDU"))
    expect(await screen.findByText("Transaction details")).toBeVisible()
    expect(await screen.findByText("Vesting schedule")).toBeVisible()
    expect(await screen.findByText("Linear until 100% on Dec 29, 2022")).toBeVisible()

    expect(await screen.findByText("Claim status")).toBeVisible()
    expect(await screen.findByText("$0.00 (0.00 GFI) claimed of your total vested 0.71 GFI")).toBeVisible()

    expect(await screen.findByText("Current earn rate")).toBeVisible()
    expect(await screen.findByText("+453.60 GFI granted per week")).toBeVisible()

    expect(await screen.findByText("Vesting status")).toBeVisible()
    expect(await screen.findByText("0.55% (0.71 GFI) vested")).toBeVisible()

    expect(screen.getByText("Etherscan").closest("a")).toHaveAttribute(
      "href",
      `https://${network.name}.etherscan.io/address/${deps.stakingRewards.address}`
    )
    fireEvent.click(screen.getByText("Staked 50K FIDU"))

    fireEvent.click(screen.getByText("Goldfinch Investment"))
    expect(await screen.findByText("Transaction details")).toBeVisible()
    expect(
      await screen.findByText("1,000.00 GFI reward on Dec 29, 2021 for participating as a Goldfinch investor")
    ).toBeVisible()

    expect(await screen.findByText("Vesting status")).toBeVisible()
    expect(await screen.findByText("100.00% (1,000.00 GFI) vested")).toBeVisible()

    expect(await screen.findByText("Vesting schedule")).toBeVisible()
    expect(await screen.findByText("Immediate")).toBeVisible()

    expect(await screen.findByText("Claim status")).toBeVisible()
    expect(await screen.findByText("$0.00 (0.00 GFI) claimed of your total vested 1,000.00 GFI")).toBeVisible()

    expect(screen.getByText("Etherscan").closest("a")).toHaveAttribute(
      "href",
      `https://${network.name}.etherscan.io/address/${deps.communityRewards.address}`
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
      `https://${network.name}.etherscan.io/address/${deps.merkleDirectDistributor.address}`
    )
  })

  it("staking reward partially claimed appears on list", async () => {
    const deps = await setupPartiallyClaimedStakingReward(goldfinchProtocol, seniorPool, undefined, currentBlock)

    renderRewards(deps, currentBlock)

    expect(await screen.findByText("Staked 50K FIDU")).toBeVisible()
    expect(screen.getByText("269.00 GFI to date • Dec 29, 2020")).toBeVisible()
    expect(await screen.findByText("Claim GFI")).toBeVisible()

    expect(screen.getByTestId("detail-unvested").textContent).toEqual("265.94")
    expect(screen.getByTestId("detail-claimable").textContent).toEqual("2.24")

    fireEvent.click(screen.getByText("Staked 50K FIDU"))
    await waitFor(async () => {
      expect(await screen.findByText("Transaction details")).toBeVisible()
      expect(await screen.findByText("Vesting schedule")).toBeVisible()
      expect(await screen.findByText("Linear until 100% on Dec 29, 2022")).toBeVisible()

      expect(await screen.findByText("Claim status")).toBeVisible()
      expect(await screen.findByText("$0.82 (0.82 GFI) claimed of your total vested 3.06 GFI")).toBeVisible()

      expect(await screen.findByText("Current earn rate")).toBeVisible()
      expect(await screen.findByText("+453.60 GFI granted per week")).toBeVisible()

      expect(await screen.findByText("Vesting status")).toBeVisible()
      expect(await screen.findByText("1.14% (3.06 GFI) vested")).toBeVisible()

      expect(screen.getByText("Etherscan").closest("a")).toHaveAttribute(
        "href",
        `https://${network.name}.etherscan.io/address/${deps.stakingRewards.address}`
      )
    })
  })

  it("community reward partially claimed appears on list", async () => {
    const deps = await setupPartiallyClaimedCommunityReward(goldfinchProtocol, seniorPool, undefined, currentBlock)

    renderRewards(deps, currentBlock)

    expect(await screen.findByText("Goldfinch Investment")).toBeVisible()
    expect(screen.getByText("1,000.00 GFI • Dec 23, 2021")).toBeVisible()
    expect(await screen.findByText("Claim GFI")).toBeVisible()

    expect(screen.getByTestId("detail-unvested").textContent).toEqual("983.56")
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

    expect(await screen.findByText("Claim status")).toBeVisible()
    expect(await screen.findByText("$5.48 (5.48 GFI) claimed of your total vested 16.44 GFI")).toBeVisible()

    expect(screen.getByText("Etherscan").closest("a")).toHaveAttribute(
      "href",
      `https://${network.name}.etherscan.io/address/${deps.communityRewards.address}`
    )
  })

  it("Accepted MerkleDirectDistributor reward appears on list", async () => {
    const deps = await setupDirectReward(goldfinchProtocol, seniorPool, currentBlock)

    renderRewards(deps, currentBlock)

    expect(await screen.findByText("Flight Academy")).toBeVisible()
    expect(screen.getByText("2,500.00 GFI • Jan 11, 2022")).toBeVisible()
    expect(screen.getAllByText("Claimed").length).toBe(1)

    expect(screen.getAllByTestId("detail-unvested")[0]?.textContent).toEqual("0.00")
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
      `https://${network.name}.etherscan.io/address/${deps.merkleDirectDistributor.address}`
    )
  })

  describe("rewards transactions", () => {
    it("for MerkleDistributor airdrop, clicking button triggers sending `acceptGrant()`", async () => {
      const deps = await setupMerkleDistributorAirdropNoVesting(goldfinchProtocol, seniorPool, currentBlock)
      const networkMonitor = {
        addPendingTX: () => {},
        watch: () => {},
        markTXErrored: () => {},
      } as unknown as NetworkMonitor
      const refreshCurrentBlock = jest.fn()

      renderRewards(deps, currentBlock, refreshCurrentBlock, networkMonitor)

      expect(await screen.findByText("Goldfinch Investment")).toBeVisible()
      expect(screen.getByText("1,000.00 GFI • Jan 11, 2022")).toBeVisible()
      expect(await screen.findByText("Accept")).toBeVisible()

      web3.userWallet.eth.getGasPrice = () => {
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
      const watchAssetMock = mock({
        blockchain,
        watchAsset: {
          params: {
            type: "ERC20",
            options: {
              address: deps.gfi.address,
              symbol: "GFI",
              decimals: 18,
              image: "https://app.goldfinch.finance/gfi-token.svg",
            },
          },
          return: true,
        },
      })

      fireEvent.click(screen.getByText("Accept"))
      await waitFor(async () => {
        expect(await screen.getByText("Accepting...")).toBeInTheDocument()
      })
      expect(acceptMock).toHaveBeenCalled()
      expect(watchAssetMock).not.toHaveBeenCalled()
    })

    it("for MerkleDirectDistributor airdrop, clicking button triggers sending `acceptGrant()`", async () => {
      const deps = await setupMerkleDirectDistributorAirdrop(goldfinchProtocol, seniorPool, currentBlock)
      const networkMonitor = {
        addPendingTX: () => {},
        watch: () => {},
        markTXErrored: () => {},
      } as unknown as NetworkMonitor
      const refreshCurrentBlock = jest.fn()

      renderRewards(deps, currentBlock, refreshCurrentBlock, networkMonitor)

      expect(await screen.findByText("Flight Academy")).toBeVisible()
      expect(await screen.getByText("2,500.00 GFI • Jan 11, 2022")).toBeVisible()
      expect(await screen.findByText("Claim GFI")).toBeVisible()

      web3.userWallet.eth.getGasPrice = () => {
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
      const watchAssetMock = mock({
        blockchain,
        watchAsset: {
          params: {
            type: "ERC20",
            options: {
              address: deps.gfi.address,
              symbol: "GFI",
              decimals: 18,
              image: "https://app.goldfinch.finance/gfi-token.svg",
            },
          },
          return: true,
        },
      })

      fireEvent.click(screen.getByText("Claim GFI"))
      await waitFor(async () => {
        expect(await screen.getByText("Claiming...")).toBeInTheDocument()
      })
      expect(acceptMock).toHaveBeenCalled()
      expect(watchAssetMock).toHaveBeenCalled()
    })

    it("clicking community rewards button triggers sending `getReward()`", async () => {
      const deps = await setupClaimableCommunityReward(goldfinchProtocol, seniorPool, currentBlock)
      const networkMonitor = {
        addPendingTX: () => {},
        watch: () => {},
        markTXErrored: () => {},
      } as unknown as NetworkMonitor
      const refreshCurrentBlock = jest.fn()

      renderRewards(deps, currentBlock, refreshCurrentBlock, networkMonitor)

      expect(await screen.findByText("Goldfinch Investment")).toBeVisible()
      expect(await screen.getByText("1,000.00 GFI • Dec 29, 2021")).toBeVisible()
      expect(await screen.findByText("Claim GFI")).toBeVisible()

      web3.userWallet.eth.getGasPrice = () => {
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
      const watchAssetMock = mock({
        blockchain,
        watchAsset: {
          params: {
            type: "ERC20",
            options: {
              address: deps.gfi.address,
              symbol: "GFI",
              decimals: 18,
              image: "https://app.goldfinch.finance/gfi-token.svg",
            },
          },
          return: true,
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
      expect(watchAssetMock).toHaveBeenCalled()
    })

    it("clicking staking reward button triggers sending `getReward()`", async () => {
      const deps = await setupClaimableStakingReward(goldfinchProtocol, seniorPool, currentBlock)
      const networkMonitor = {
        addPendingTX: () => {},
        watch: () => {},
        markTXErrored: () => {},
      } as unknown as NetworkMonitor
      const refreshCurrentBlock = jest.fn()

      renderRewards(deps, currentBlock, refreshCurrentBlock, networkMonitor)

      expect(await screen.findByText("Claim GFI")).toBeVisible()

      web3.userWallet.eth.getGasPrice = () => {
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
      const watchAssetMock = mock({
        blockchain,
        watchAsset: {
          params: {
            type: "ERC20",
            options: {
              address: deps.gfi.address,
              symbol: "GFI",
              decimals: 18,
              image: "https://app.goldfinch.finance/gfi-token.svg",
            },
          },
          return: true,
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
      expect(watchAssetMock).toHaveBeenCalled()
    })
  })
})
