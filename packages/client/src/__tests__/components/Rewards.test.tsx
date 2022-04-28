import {mock, resetMocks, setBlockData} from "@depay/web3-mock"
import "@testing-library/jest-dom"
import {fireEvent, render, screen, waitFor} from "@testing-library/react"
import BigNumber from "bignumber.js"
import {MemoryRouter as Router} from "react-router-dom"
import {ThemeProvider} from "styled-components"
import {AppContext, LeavesCurrentBlock} from "../../App"
import {SeniorPoolStatus} from "../../components/Earn/types"
import {EarnProvider} from "../../contexts/EarnContext"
import {BackerMerkleDirectDistributorLoaded} from "../../ethereum/backerMerkleDirectDistributor"
import {BackerMerkleDistributorLoaded} from "../../ethereum/backerMerkleDistributor"
import {CommunityRewardsLoaded} from "../../ethereum/communityRewards"
import {COINBASE_API_GFI_PRICE_URL, COINGECKO_API_GFI_PRICE_URL, GFILoaded, GFI_DECIMALS} from "../../ethereum/gfi"
import {GoldfinchProtocol} from "../../ethereum/GoldfinchProtocol"
import {MerkleDirectDistributorLoaded} from "../../ethereum/merkleDirectDistributor"
import {MerkleDistributorLoaded} from "../../ethereum/merkleDistributor"
import {NetworkMonitor} from "../../ethereum/networkMonitor"
import {SeniorPool, SeniorPoolData, SeniorPoolLoaded, StakingRewardsLoaded} from "../../ethereum/pool"
import {TranchedPool, TranchedPoolBacker} from "../../ethereum/tranchedPool"
import {
  UserBackerMerkleDirectDistributorLoaded,
  UserBackerMerkleDistributorLoaded,
  UserCommunityRewardsLoaded,
  UserLoaded,
  UserMerkleDirectDistributorLoaded,
  UserMerkleDistributorLoaded,
} from "../../ethereum/user"
import * as utils from "../../ethereum/utils"
import * as useEarnData from "../../hooks/useEarnData"
import {UseGraphQuerierConfig} from "../../hooks/useGraphQuerier"
import Rewards from "../../pages/rewards"
import {defaultTheme} from "../../styles/theme"
import {assertWithLoadedInfo} from "../../types/loadable"
import {
  ABOUT_ROUTE,
  AppRoute,
  BORROW_ROUTE,
  EARN_ROUTE,
  GFI_ROUTE,
  INDEX_ROUTE,
  PRIVACY_POLICY_ROUTE,
  SENIOR_POOL_AGREEMENT_NON_US_ROUTE,
  SENIOR_POOL_AGREEMENT_US_ROUTE,
  SENIOR_POOL_ROUTE,
  STAKE_ROUTE,
  TERMS_OF_SERVICE_ROUTE,
  TRANCHED_POOL_ROUTE,
  TRANSACTIONS_ROUTE,
  VERIFY_ROUTE,
} from "../../types/routes"
import {SessionData} from "../../types/session"
import {UserWalletWeb3Status} from "../../types/web3"
import {BlockInfo} from "../../utils"
import getWeb3 from "../../web3"
import {blockchain, defaultCurrentBlock, getDeployments, network, recipient} from "../rewards/__utils__/constants"
import {resetAirdropMocks} from "../rewards/__utils__/mocks"
import {
  merkleDistributorAirdropVesting,
  prepareBaseDeps,
  prepareUserRelatedDeps,
  setupAcceptedDirectReward,
  setupClaimableBackerReward,
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

const web3 = getWeb3()
web3.readOnly.setProvider((global.window as any).ethereum)
web3.userWallet.setProvider((global.window as any).ethereum)

const earnProviderGraphQuerierConfig: UseGraphQuerierConfig = {
  route: GFI_ROUTE,
  setAsLeaf: true,
}

function renderRewards(
  goldfinchProtocol: GoldfinchProtocol,
  deps: {
    stakingRewards: StakingRewardsLoaded | undefined
    gfi: GFILoaded | undefined
    user: UserLoaded | undefined
    merkleDistributor: MerkleDistributorLoaded | undefined
    backerMerkleDistributor: BackerMerkleDistributorLoaded | undefined
    merkleDirectDistributor: MerkleDirectDistributorLoaded | undefined
    backerMerkleDirectDistributor: BackerMerkleDirectDistributorLoaded | undefined
    communityRewards: CommunityRewardsLoaded | undefined
    userMerkleDistributor: UserMerkleDistributorLoaded | undefined
    userMerkleDirectDistributor: UserMerkleDirectDistributorLoaded | undefined
    userBackerMerkleDistributor: UserBackerMerkleDistributorLoaded | undefined
    userBackerMerkleDirectDistributor: UserBackerMerkleDirectDistributorLoaded | undefined
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
    goldfinchProtocol,
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
          <EarnProvider graphQuerierConfig={earnProviderGraphQuerierConfig}>
            <Rewards />
          </EarnProvider>
        </Router>
      </ThemeProvider>
    </AppContext.Provider>
  )
}

function mockPoolBackersData(poolTokenIds: string[], poolAddress: string, currentBlock: BlockInfo) {
  jest.spyOn(useEarnData, "usePoolBackersWeb3").mockReturnValue({
    backers: {
      loaded: true,
      value: [
        {
          tranchedPool: {
            address: poolAddress,
            creditLine: {
              termStartTime: new BigNumber(currentBlock.timestamp),
            },
            isSeniorTrancheId: (trancheId: BigNumber): boolean => {
              if (trancheId.toString() === "2") {
                return false
              } else {
                throw new Error(`Unexpected tranche id: ${typeof trancheId} ${trancheId}`)
              }
            },
          } as unknown as TranchedPool,
          principalAmount: new BigNumber(100).multipliedBy(utils.USDC_DECIMALS.toString(10)),
          principalAtRisk: new BigNumber(50).multipliedBy(utils.USDC_DECIMALS.toString(10)),
          tokenInfos: poolTokenIds.map((poolTokenId) => ({
            id: poolTokenId,
            tranche: new BigNumber(2),
          })),
          firstDepositBlockNumber: currentBlock.number,
        } as TranchedPoolBacker,
      ],
    },
    poolsAddresses: {
      loaded: true,
      value: [poolAddress],
    },
  })

  // Mock the `getBlock()` call done by `UserBackerRewards.initialize()`.
  setBlockData(currentBlock.number, currentBlock)
}

function mockUseEarnLogic() {
  jest.spyOn(useEarnData, "useSeniorPoolStatusWeb3").mockReturnValue({
    seniorPoolStatus: {
      loaded: true,
      value: {} as SeniorPoolStatus,
    },
  })
  jest.spyOn(useEarnData, "useTranchedPoolSubgraphData").mockReturnValue({
    backers: {
      loaded: true,
      value: [],
    },
    loading: false,
    error: undefined,
  })
  jest.spyOn(useEarnData, "usePoolBackersWeb3").mockReturnValue({
    backers: {
      loaded: true,
      value: [],
    },
    poolsAddresses: {
      loaded: true,
      value: [],
    },
  })
}

describe("Rewards summary", () => {
  let seniorPool: SeniorPoolLoaded
  let goldfinchProtocol = new GoldfinchProtocol(network)
  const currentBlock = defaultCurrentBlock
  const emptyDeps = {
    stakingRewards: undefined,
    gfi: undefined,
    user: undefined,
    backerMerkleDistributor: undefined,
    merkleDistributor: undefined,
    backerMerkleDirectDistributor: undefined,
    merkleDirectDistributor: undefined,
    communityRewards: undefined,
    userMerkleDistributor: undefined,
    userMerkleDirectDistributor: undefined,
    userBackerMerkleDistributor: undefined,
    userBackerMerkleDirectDistributor: undefined,
    userCommunityRewards: undefined,
  }

  beforeEach(resetMocks)
  beforeEach(() => mock({blockchain, accounts: {return: [recipient]}}))
  beforeEach(async () => {
    // Mock deployments JSON.
    jest.spyOn(utils, "getDeployments").mockImplementation(() => {
      return getDeployments()
    })

    resetAirdropMocks(goldfinchProtocol)

    // Mock instance of SeniorPool class.
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

    // Mock the things required by the Rewards page's use of the `useEarn()` hook.
    mockUseEarnLogic()
  })

  describe("loading state", () => {
    it("shows loading message when all requirements are empty", async () => {
      renderRewards(goldfinchProtocol, {...emptyDeps}, currentBlock)
      expect(await screen.findByText("Loading...")).toBeVisible()
    })

    it("shows loading message when some requirements are empty", async () => {
      const baseDeps = await prepareBaseDeps(goldfinchProtocol, currentBlock)
      const {user} = await prepareUserRelatedDeps({...baseDeps, goldfinchProtocol, seniorPool}, {currentBlock})
      renderRewards(
        goldfinchProtocol,
        {
          ...emptyDeps,
          stakingRewards: baseDeps.stakingRewards,
          gfi: baseDeps.gfi,
          user,
          merkleDistributor: baseDeps.merkleDistributor,
        },
        currentBlock
      )
      expect(await screen.findByText("Loading...")).toBeVisible()
    })

    it("doesn't show loading message when all requirements are loaded", async () => {
      const baseDeps = await prepareBaseDeps(goldfinchProtocol, currentBlock)
      const userRelated = await prepareUserRelatedDeps({...baseDeps, goldfinchProtocol, seniorPool}, {currentBlock})
      renderRewards(goldfinchProtocol, {...baseDeps, ...userRelated}, currentBlock)
      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument()
      })
    })
  })

  it("shows empty portfolio", async () => {
    const baseDeps = await prepareBaseDeps(goldfinchProtocol, currentBlock)
    const userRelated = await prepareUserRelatedDeps({...baseDeps, goldfinchProtocol, seniorPool}, {currentBlock})
    renderRewards(goldfinchProtocol, {...baseDeps, ...userRelated}, currentBlock)
    await waitFor(() => {
      expect(screen.queryByText("Loading...")).not.toBeInTheDocument()
    })

    expect(await screen.findByText("Total")).toBeVisible()
    expect(await screen.findByText("Claimable")).toBeVisible()
    expect(await screen.findByText("Still Locked", {selector: "span"})).toBeVisible()

    expect(await screen.getByTestId("summary-claimable").textContent).toEqual("0.00")
    expect(await screen.getByTestId("summary-still-vesting").textContent).toEqual("0.00")
    expect(await screen.getByTestId("summary-total-balance").textContent).toEqual("0.00")
  })

  it("shows wallet balance on portfolio", async () => {
    const baseDeps = await prepareBaseDeps(goldfinchProtocol, currentBlock)
    const userRelated = await prepareUserRelatedDeps(
      {...baseDeps, goldfinchProtocol, seniorPool},
      {currentBlock, gfi: {gfiBalance: "1000000000000000000"}}
    )
    renderRewards(goldfinchProtocol, {...baseDeps, ...userRelated}, currentBlock)
    await waitFor(() => {
      expect(screen.queryByText("Loading...")).not.toBeInTheDocument()
    })

    expect(await screen.findByText("Total")).toBeVisible()
    expect(await screen.findByText("Claimable")).toBeVisible()
    expect(await screen.findByText("Still Locked", {selector: "span"})).toBeVisible()

    expect(await screen.getByTestId("summary-claimable").textContent).toEqual("0.00")
    expect(await screen.getByTestId("summary-still-vesting").textContent).toEqual("0.00")
    expect(await screen.getByTestId("summary-total-balance").textContent).toEqual("1.00")
  })

  describe("StakingRewards", () => {
    it("in same block as staking, staking reward won't be reflected in portfolio, as nothing has vested and there is no optimistic increment", async () => {
      const deps = await setupNewStakingReward(goldfinchProtocol, seniorPool, currentBlock)

      renderRewards(goldfinchProtocol, deps, currentBlock)

      expect(await screen.findByText("Total")).toBeVisible()
      expect(await screen.findByText("Claimable")).toBeVisible()
      expect(await screen.findByText("Still Locked", {selector: "span"})).toBeVisible()

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

      renderRewards(goldfinchProtocol, deps, currentBlock)

      expect(await screen.findByText("Total")).toBeVisible()
      expect(await screen.findByText("Claimable")).toBeVisible()
      expect(await screen.findByText("Still Locked", {selector: "span"})).toBeVisible()

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

        renderRewards(goldfinchProtocol, deps, currentBlock)

        expect(await screen.findByText("Claimable")).toBeVisible()
        expect(await screen.findByText("Still Locked", {selector: "span"})).toBeVisible()
        expect(await screen.findByText("Total")).toBeVisible()

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

        renderRewards(goldfinchProtocol, deps, currentBlock)

        expect(await screen.findByText("Claimable")).toBeVisible()
        expect(await screen.findByText("Still Locked", {selector: "span"})).toBeVisible()
        expect(await screen.findByText("Total")).toBeVisible()

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
    it("MerkleDistributor and BackerMerkleDistributor airdrops without vesting that has not been accepted is counted in portfolio", async () => {
      const deps = await setupMerkleDistributorAirdropNoVesting(goldfinchProtocol, seniorPool, currentBlock, {
        distributor: true,
        backerDistributor: true,
      })

      renderRewards(goldfinchProtocol, deps, currentBlock)

      expect(await screen.findByText("Total")).toBeVisible()
      expect(await screen.findByText("Claimable")).toBeVisible()
      expect(await screen.findByText("Still Locked", {selector: "span"})).toBeVisible()

      expect(await screen.getByTestId("summary-claimable").textContent).toEqual("2,000.00")
      expect(await screen.getByTestId("summary-still-vesting").textContent).toEqual("0.00")
      expect(await screen.getByTestId("summary-total-balance").textContent).toEqual("2,000.00")

      expect(await screen.getByTestId("summary-claimable").className).toEqual("value")
      expect(await screen.getByTestId("summary-still-vesting").className).toEqual("value")
      expect(await screen.getByTestId("summary-total-balance").className).toEqual("value")
    })

    it("MerkleDistributor airdrop without vesting that has not been accepted is counted in portfolio", async () => {
      const deps = await setupMerkleDistributorAirdropNoVesting(goldfinchProtocol, seniorPool, currentBlock, {
        distributor: true,
        backerDistributor: false,
      })

      renderRewards(goldfinchProtocol, deps, currentBlock)

      expect(await screen.findByText("Total")).toBeVisible()
      expect(await screen.findByText("Claimable")).toBeVisible()
      expect(await screen.findByText("Still Locked", {selector: "span"})).toBeVisible()

      expect(await screen.getByTestId("summary-claimable").textContent).toEqual("1,000.00")
      expect(await screen.getByTestId("summary-still-vesting").textContent).toEqual("0.00")
      expect(await screen.getByTestId("summary-total-balance").textContent).toEqual("1,000.00")

      expect(await screen.getByTestId("summary-claimable").className).toEqual("value")
      expect(await screen.getByTestId("summary-still-vesting").className).toEqual("value")
      expect(await screen.getByTestId("summary-total-balance").className).toEqual("value")
    })

    it("BackerMerkleDistributor airdrop without vesting that has not been accepted is counted in portfolio", async () => {
      const deps = await setupMerkleDistributorAirdropNoVesting(goldfinchProtocol, seniorPool, currentBlock, {
        distributor: false,
        backerDistributor: true,
      })

      renderRewards(goldfinchProtocol, deps, currentBlock)

      expect(await screen.findByText("Total")).toBeVisible()
      expect(await screen.findByText("Claimable")).toBeVisible()
      expect(await screen.findByText("Still Locked", {selector: "span"})).toBeVisible()

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
        currentBlock,
        {distributor: true, backerDistributor: false}
      )

      renderRewards(goldfinchProtocol, deps, currentBlock)

      expect(await screen.findByText("Total")).toBeVisible()
      expect(await screen.findByText("Claimable")).toBeVisible()
      expect(await screen.findByText("Still Locked", {selector: "span"})).toBeVisible()

      expect(await screen.getByTestId("summary-claimable").textContent).toEqual("500.00")
      expect(await screen.getByTestId("summary-still-vesting").textContent).toEqual("500.00")
      expect(await screen.getByTestId("summary-total-balance").textContent).toEqual("1,000.00")

      expect(await screen.getByTestId("summary-claimable").className).toEqual("value")
      expect(await screen.getByTestId("summary-still-vesting").className).toEqual("value")
      expect(await screen.getByTestId("summary-total-balance").className).toEqual("value")
    })

    it("BackerMerkleDistributor airdrop with vesting that has not been accepted is counted in portfolio", async () => {
      const deps = await setupMerkleDistributorAirdropVesting(
        goldfinchProtocol,
        seniorPool,
        String(currentBlock.timestamp - parseInt(merkleDistributorAirdropVesting.grant.vestingLength, 16) / 2),
        new BigNumber(merkleDistributorAirdropVesting.grant.amount).dividedBy(2).toString(10),
        currentBlock,
        {distributor: false, backerDistributor: true}
      )

      renderRewards(goldfinchProtocol, deps, currentBlock)

      expect(await screen.findByText("Total")).toBeVisible()
      expect(await screen.findByText("Claimable")).toBeVisible()
      expect(await screen.findByText("Still Locked", {selector: "span"})).toBeVisible()

      expect(await screen.getByTestId("summary-claimable").textContent).toEqual("500.00")
      expect(await screen.getByTestId("summary-still-vesting").textContent).toEqual("500.00")
      expect(await screen.getByTestId("summary-total-balance").textContent).toEqual("1,000.00")

      expect(await screen.getByTestId("summary-claimable").className).toEqual("value")
      expect(await screen.getByTestId("summary-still-vesting").className).toEqual("value")
      expect(await screen.getByTestId("summary-total-balance").className).toEqual("value")
    })

    it("MerkleDistributor and BackerMerkleDistributor airdrops with vesting that has not been accepted is counted in portfolio", async () => {
      const deps = await setupMerkleDistributorAirdropVesting(
        goldfinchProtocol,
        seniorPool,
        String(currentBlock.timestamp - parseInt(merkleDistributorAirdropVesting.grant.vestingLength, 16) / 2),
        new BigNumber(merkleDistributorAirdropVesting.grant.amount).dividedBy(2).toString(10),
        currentBlock,
        {distributor: true, backerDistributor: true}
      )

      renderRewards(goldfinchProtocol, deps, currentBlock)

      expect(await screen.findByText("Total")).toBeVisible()
      expect(await screen.findByText("Claimable")).toBeVisible()
      expect(await screen.findByText("Still Locked", {selector: "span"})).toBeVisible()

      expect(await screen.getByTestId("summary-claimable").textContent).toEqual("1,000.00")
      expect(await screen.getByTestId("summary-still-vesting").textContent).toEqual("1,000.00")
      expect(await screen.getByTestId("summary-total-balance").textContent).toEqual("2,000.00")

      expect(await screen.getByTestId("summary-claimable").className).toEqual("value")
      expect(await screen.getByTestId("summary-still-vesting").className).toEqual("value")
      expect(await screen.getByTestId("summary-total-balance").className).toEqual("value")
    })

    it("accepted community reward with vesting appears on portfolio", async () => {
      const deps = await setupVestingCommunityReward(goldfinchProtocol, seniorPool, currentBlock)
      renderRewards(goldfinchProtocol, deps, currentBlock)

      expect(await screen.findByText("Claimable")).toBeVisible()
      expect(await screen.findByText("Still Locked", {selector: "span"})).toBeVisible()
      expect(await screen.findByText("Total")).toBeVisible()

      expect(await screen.getByTestId("summary-claimable").textContent).toEqual("0.00")
      expect(await screen.getByTestId("summary-still-vesting").textContent).toEqual("1,000.00")
      expect(await screen.getByTestId("summary-total-balance").textContent).toEqual("1,000.00")

      expect(await screen.getByTestId("summary-claimable").className).toEqual("value")
      expect(await screen.getByTestId("summary-still-vesting").className).toEqual("value")
      expect(await screen.getByTestId("summary-total-balance").className).toEqual("value")
    })

    it("accepted backer community reward with vesting appears on portfolio", async () => {
      const isBacker = true
      const deps = await setupVestingCommunityReward(goldfinchProtocol, seniorPool, currentBlock, isBacker)
      renderRewards(goldfinchProtocol, deps, currentBlock)

      expect(await screen.findByText("Claimable")).toBeVisible()
      expect(await screen.findByText("Still Locked", {selector: "span"})).toBeVisible()
      expect(await screen.findByText("Total")).toBeVisible()

      expect(await screen.getByTestId("summary-claimable").textContent).toEqual("0.00")
      expect(await screen.getByTestId("summary-still-vesting").textContent).toEqual("1,000.00")
      expect(await screen.getByTestId("summary-total-balance").textContent).toEqual("1,000.00")

      expect(await screen.getByTestId("summary-claimable").className).toEqual("value")
      expect(await screen.getByTestId("summary-still-vesting").className).toEqual("value")
      expect(await screen.getByTestId("summary-total-balance").className).toEqual("value")
    })

    it("accepted community reward without vesting appears on portfolio", async () => {
      const deps = await setupClaimableCommunityReward(goldfinchProtocol, seniorPool, currentBlock)
      renderRewards(goldfinchProtocol, deps, currentBlock)

      expect(await screen.findByText("Claimable")).toBeVisible()
      expect(await screen.findByText("Still Locked", {selector: "span"})).toBeVisible()
      expect(await screen.findByText("Total")).toBeVisible()

      expect(await screen.getByTestId("summary-claimable").textContent).toEqual("1,000.00")
      expect(await screen.getByTestId("summary-still-vesting").textContent).toEqual("0.00")
      expect(await screen.getByTestId("summary-total-balance").textContent).toEqual("1,000.00")

      expect(await screen.getByTestId("summary-claimable").className).toEqual("value")
      expect(await screen.getByTestId("summary-still-vesting").className).toEqual("value")
      expect(await screen.getByTestId("summary-total-balance").className).toEqual("value")
    })

    it("accepted backer community reward without vesting appears on portfolio", async () => {
      const isBacker = true
      const deps = await setupClaimableCommunityReward(goldfinchProtocol, seniorPool, currentBlock, isBacker)
      renderRewards(goldfinchProtocol, deps, currentBlock)

      expect(await screen.findByText("Claimable")).toBeVisible()
      expect(await screen.findByText("Still Locked", {selector: "span"})).toBeVisible()
      expect(await screen.findByText("Total")).toBeVisible()

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
      renderRewards(goldfinchProtocol, deps, currentBlock)

      expect(await screen.findByText("Claimable")).toBeVisible()
      expect(await screen.findByText("Still Locked", {selector: "span"})).toBeVisible()
      expect(await screen.findByText("Total")).toBeVisible()

      expect(await screen.getByTestId("summary-claimable").textContent).toEqual("10.96")
      expect(await screen.getByTestId("summary-still-vesting").textContent).toEqual("983.56")
      expect(await screen.getByTestId("summary-total-balance").textContent).toEqual("1,000.00")

      expect(await screen.getByTestId("summary-claimable").className).toEqual("value")
      expect(await screen.getByTestId("summary-still-vesting").className).toEqual("value")
      expect(await screen.getByTestId("summary-total-balance").className).toEqual("value")
    })

    it("accepted backer community reward partially claimed and still vesting appears on portfolio", async () => {
      const isBacker = true
      const deps = await setupPartiallyClaimedCommunityReward(
        goldfinchProtocol,
        seniorPool,
        "5480000000000000000",
        currentBlock,
        isBacker
      )
      renderRewards(goldfinchProtocol, deps, currentBlock)

      expect(await screen.findByText("Claimable")).toBeVisible()
      expect(await screen.findByText("Still Locked", {selector: "span"})).toBeVisible()
      expect(await screen.findByText("Total")).toBeVisible()

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

      renderRewards(goldfinchProtocol, deps, currentBlock)

      expect(await screen.findByText("Total")).toBeVisible()
      expect(await screen.findByText("Claimable")).toBeVisible()
      expect(await screen.findByText("Still Locked", {selector: "span"})).toBeVisible()

      expect(await screen.getByTestId("summary-claimable").textContent).toEqual("2,500.00")
      expect(await screen.getByTestId("summary-still-vesting").textContent).toEqual("0.00")
      expect(await screen.getByTestId("summary-total-balance").textContent).toEqual("2,500.00")

      expect(await screen.getByTestId("summary-claimable").className).toEqual("value")
      expect(await screen.getByTestId("summary-still-vesting").className).toEqual("value")
      expect(await screen.getByTestId("summary-total-balance").className).toEqual("value")
    })

    it("accepted MerkleDirectDistributor reward appears on portfolio", async () => {
      const deps = await setupAcceptedDirectReward(goldfinchProtocol, seniorPool, currentBlock)
      renderRewards(goldfinchProtocol, deps, currentBlock)

      expect(await screen.findByText("Claimable")).toBeVisible()
      expect(await screen.findByText("Still Locked", {selector: "span"})).toBeVisible()
      expect(await screen.findByText("Total")).toBeVisible()

      expect(await screen.getByTestId("summary-claimable").textContent).toEqual("0.00")
      expect(await screen.getByTestId("summary-still-vesting").textContent).toEqual("0.00")
      expect(await screen.getByTestId("summary-total-balance").textContent).toEqual("2,500.00")

      expect(await screen.getByTestId("summary-claimable").className).toEqual("value")
      expect(await screen.getByTestId("summary-still-vesting").className).toEqual("value")
      expect(await screen.getByTestId("summary-total-balance").className).toEqual("value")
    })
  })

  describe("BackerMerkleDirectDistributor rewards", () => {
    it("BackerMerkleDirectDistributor airdrop that has not been accepted is counted in portfolio", async () => {
      const isBacker = true
      const deps = await setupMerkleDirectDistributorAirdrop(goldfinchProtocol, seniorPool, currentBlock, isBacker)

      renderRewards(goldfinchProtocol, deps, currentBlock)

      expect(await screen.findByText("Total")).toBeVisible()
      expect(await screen.findByText("Claimable")).toBeVisible()
      expect(await screen.findByText("Still Locked", {selector: "span"})).toBeVisible()

      expect(await screen.getByTestId("summary-claimable").textContent).toEqual("2,500.00")
      expect(await screen.getByTestId("summary-still-vesting").textContent).toEqual("0.00")
      expect(await screen.getByTestId("summary-total-balance").textContent).toEqual("2,500.00")

      expect(await screen.getByTestId("summary-claimable").className).toEqual("value")
      expect(await screen.getByTestId("summary-still-vesting").className).toEqual("value")
      expect(await screen.getByTestId("summary-total-balance").className).toEqual("value")
    })

    it("accepted BackerMerkleDirectDistributor reward appears on portfolio", async () => {
      const isBacker = true
      const deps = await setupAcceptedDirectReward(goldfinchProtocol, seniorPool, currentBlock, isBacker)
      renderRewards(goldfinchProtocol, deps, currentBlock)

      expect(await screen.findByText("Claimable")).toBeVisible()
      expect(await screen.findByText("Still Locked", {selector: "span"})).toBeVisible()
      expect(await screen.findByText("Total")).toBeVisible()

      expect(await screen.getByTestId("summary-claimable").textContent).toEqual("0.00")
      expect(await screen.getByTestId("summary-still-vesting").textContent).toEqual("0.00")
      expect(await screen.getByTestId("summary-total-balance").textContent).toEqual("2,500.00")

      expect(await screen.getByTestId("summary-claimable").className).toEqual("value")
      expect(await screen.getByTestId("summary-still-vesting").className).toEqual("value")
      expect(await screen.getByTestId("summary-total-balance").className).toEqual("value")
    })
  })

  describe("BackerRewards rewards", () => {
    const poolTokenId = "1"
    const poolAddress = "0xfoo"

    beforeEach(async () => {
      // Override the mocking of `usePoolBackerWeb3()` done upstream, in order to define meaningful
      // `backers` info so that we can test behavior in the non-zero backer rewards scenario.
      mockPoolBackersData([poolTokenId], poolAddress, currentBlock)
    })

    it("for backer of tranched pool, reward with non-zero claimable amount appears on portfolio", async () => {
      const claimableBackersOnly = new BigNumber(1.5).multipliedBy(GFI_DECIMALS)
      const claimableSeniorPoolMatching = new BigNumber(1.5).multipliedBy(GFI_DECIMALS)
      const claimedBackersOnly = new BigNumber(0).multipliedBy(GFI_DECIMALS)
      const claimedSeniorPoolMatching = new BigNumber(0).multipliedBy(GFI_DECIMALS)

      const deps = await setupClaimableBackerReward(
        goldfinchProtocol,
        seniorPool,
        [
          {
            poolTokenId,
            claimableBackersOnly,
            claimableSeniorPoolMatching,
            claimedBackersOnly,
            claimedSeniorPoolMatching,
          },
        ],
        currentBlock
      )

      renderRewards(goldfinchProtocol, deps, currentBlock)

      const expectedClaimableDisplay = claimableBackersOnly
        .plus(claimableSeniorPoolMatching)
        .dividedBy(GFI_DECIMALS)
        .toString(10)
      expect(expectedClaimableDisplay).toEqual("3")

      expect(await screen.findByText("Total")).toBeVisible()
      expect(await screen.findByText("Claimable")).toBeVisible()
      expect(await screen.findByText("Still Locked", {selector: "span"})).toBeVisible()

      expect(await screen.getByTestId("summary-claimable").textContent).toEqual("3.00")
      expect(await screen.getByTestId("summary-still-vesting").textContent).toEqual("0.00")
      expect(await screen.getByTestId("summary-total-balance").textContent).toEqual("3.00")

      expect(await screen.getByTestId("summary-claimable").className).toEqual("value")
      expect(await screen.getByTestId("summary-still-vesting").className).toEqual("value")
      expect(await screen.getByTestId("summary-total-balance").className).toEqual("value")
    })
  })

  describe("Staking and community rewards", () => {
    it("accepted community reward and staking reward appear on portfolio", async () => {
      const deps = await setupCommunityRewardAndStakingReward(goldfinchProtocol, seniorPool, currentBlock)

      renderRewards(goldfinchProtocol, deps, currentBlock)

      expect(await screen.findByText("Total")).toBeVisible()
      expect(await screen.findByText("Claimable")).toBeVisible()
      expect(await screen.findByText("Still Locked", {selector: "span"})).toBeVisible()

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
    // Mock deployments JSON.
    jest.spyOn(utils, "getDeployments").mockImplementation(() => {
      return getDeployments()
    })

    // Mock GFI price request.
    jest.spyOn(global, "fetch").mockImplementation((input: RequestInfo) => {
      const url = input.toString()
      if (url === COINGECKO_API_GFI_PRICE_URL) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              goldfinch: {
                usd: 2,
              },
            }),
        } as Response)
      } else {
        fail(`Unexpected fetch url: ${url}`)
      }
    })

    resetAirdropMocks(goldfinchProtocol)

    // Mock instance of SeniorPool class.
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

    // Mock the things required by the Rewards page's use of the `useEarn()` hook.
    mockUseEarnLogic()
  })

  afterAll(() => {
    process.env = OLD_ENV
  })

  it("shows empty list", async () => {
    const baseDeps = await prepareBaseDeps(goldfinchProtocol, currentBlock)
    const userRelatedDeps = await prepareUserRelatedDeps({...baseDeps, goldfinchProtocol, seniorPool}, {currentBlock})
    const deps = {...baseDeps, ...userRelatedDeps}

    const {container} = renderRewards(goldfinchProtocol, deps, currentBlock)
    await waitFor(() => {
      expect(screen.queryByText("Loading...")).not.toBeInTheDocument()
    })

    const list = container.getElementsByClassName("rewards-list-item")
    expect(list.length).toEqual(1)
    expect(list[0]?.textContent).toContain("You have no rewards. You can earn rewards by supplying")
  })

  it("disables all buttons during global refresh", async () => {
    const deps = await setupClaimableStakingReward(goldfinchProtocol, seniorPool, currentBlock)

    renderRewards(goldfinchProtocol, deps, currentBlock, undefined, undefined, undefined, {
      [INDEX_ROUTE]: undefined,
      [EARN_ROUTE]: undefined,
      [STAKE_ROUTE]: undefined,
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
      [SENIOR_POOL_AGREEMENT_US_ROUTE]: undefined,
    })

    expect(await screen.findByText("Staked 50K FIDU")).toBeVisible()
    expect(screen.getByText("129.60 GFI to date • Dec 29, 2021")).toBeVisible()
    expect(await screen.findByText("Claim GFI")).toBeVisible()
    expect(await screen.findByText("Claim GFI")).toHaveClass("disabled-button")
  })

  it("shows staking reward on rewards list", async () => {
    const deps = await setupNewStakingReward(goldfinchProtocol, seniorPool, currentBlock)
    renderRewards(goldfinchProtocol, deps, currentBlock)

    expect(await screen.findByText("Staked 50K FIDU")).toBeVisible()
    expect(screen.getByText("0.00 GFI to date • Dec 29, 2021")).toBeVisible()
    expect(await screen.findByText("Still Locked", {selector: "button"})).toBeVisible()
    expect((await screen.findAllByText("0.00")).length).toBe(6)

    fireEvent.click(screen.getByText("Staked 50K FIDU"))
    await waitFor(async () => {
      expect(await screen.findByText("Transaction details")).toBeVisible()
      expect(await screen.findByText("Unlock schedule")).toBeVisible()
      expect(await screen.findByText("Linear until 100% on Dec 29, 2022")).toBeVisible()

      expect(await screen.findByText("Claim status")).toBeVisible()
      expect(await screen.findByText("$0.00 (0.00 GFI) claimed of your total unlocked 0.00 GFI")).toBeVisible()

      expect(await screen.findByText("Current earn rate")).toBeVisible()
      expect(await screen.findByText("+453.60 GFI granted per week")).toBeVisible()

      expect(await screen.findByText("Unlock status")).toBeVisible()
      expect(await screen.findByText("--.--% (0.00 GFI) unlocked")).toBeVisible()
    })

    expect(screen.getByText("Etherscan").closest("a")).toHaveAttribute(
      "href",
      `https://${network.name}.etherscan.io/tx/0x0000000000000000000000000000000000000000000000000000000000000000`
    )
  })

  describe("GFI Price", () => {
    it("shows empty value when request to Coingecko and fallback fail", async () => {
      jest.spyOn(global, "fetch").mockImplementation((input: RequestInfo) => {
        const url = input.toString()
        if (url === COINGECKO_API_GFI_PRICE_URL) {
          return Promise.reject("Request failed")
        } else if (url === COINBASE_API_GFI_PRICE_URL) {
          return Promise.reject("Request failed")
        } else {
          fail(`Unexpected fetch url: ${url}`)
        }
      })

      const deps = await setupClaimableStakingReward(goldfinchProtocol, seniorPool, currentBlock)

      renderRewards(goldfinchProtocol, deps, currentBlock)
      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument()
      })

      fireEvent.click(screen.getByText("Staked 50K FIDU"))
      await waitFor(async () => {
        expect(await screen.findByText("Claim status")).toBeVisible()
        expect(await screen.findByText("$--.-- (0.00 GFI) claimed of your total unlocked 0.71 GFI")).toBeVisible()
      })
    })

    it("shows empty value when JSON parsing fails", async () => {
      jest.spyOn(global, "fetch").mockImplementation((input: RequestInfo) => {
        const url = input.toString()
        if (url === COINGECKO_API_GFI_PRICE_URL) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.reject("JSON parsing failed."),
          } as Response)
        } else if (url === COINBASE_API_GFI_PRICE_URL) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.reject("JSON parsing failed."),
          } as Response)
        } else {
          fail(`Unexpected fetch url: ${url}`)
        }
      })

      const deps = await setupClaimableStakingReward(goldfinchProtocol, seniorPool, currentBlock)

      renderRewards(goldfinchProtocol, deps, currentBlock)
      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument()
      })

      fireEvent.click(screen.getByText("Staked 50K FIDU"))
      await waitFor(async () => {
        expect(await screen.findByText("Claim status")).toBeVisible()
        expect(await screen.findByText("$--.-- (0.00 GFI) claimed of your total unlocked 0.71 GFI")).toBeVisible()
      })
    })

    it("shows empty value when GFI price is undefined", async () => {
      jest.spyOn(global, "fetch").mockImplementation((input: RequestInfo) => {
        const url = input.toString()
        if (url === COINGECKO_API_GFI_PRICE_URL) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                goldfinch: {usd: undefined},
              }),
          } as Response)
        }
        if (url === COINBASE_API_GFI_PRICE_URL) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                data: {
                  base: "GFI",
                  currency: "USD",
                  amount: undefined,
                },
              }),
          } as Response)
        } else {
          fail(`Unexpected fetch url: ${url}`)
        }
      })

      const deps = await setupClaimableStakingReward(goldfinchProtocol, seniorPool, currentBlock)

      renderRewards(goldfinchProtocol, deps, currentBlock)
      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument()
      })

      fireEvent.click(screen.getByText("Staked 50K FIDU"))
      await waitFor(async () => {
        expect(await screen.findByText("Claim status")).toBeVisible()
        expect(await screen.findByText("$--.-- (0.00 GFI) claimed of your total unlocked 0.71 GFI")).toBeVisible()
      })
    })

    it("shows empty value if the request returns an unexpected object", async () => {
      jest.spyOn(global, "fetch").mockImplementation((input: RequestInfo) => {
        const url = input.toString()
        if (url === COINGECKO_API_GFI_PRICE_URL) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                foo: {
                  usd: 1,
                },
              }),
          } as Response)
        } else if (url === COINBASE_API_GFI_PRICE_URL) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                data: {
                  base: "BTC",
                  currency: "USD",
                  amount: "1.23",
                },
              }),
          } as Response)
        } else {
          fail(`Unexpected fetch url: ${url}`)
        }
      })

      const deps = await setupPartiallyClaimedStakingReward(goldfinchProtocol, seniorPool, undefined, currentBlock)

      renderRewards(goldfinchProtocol, deps, currentBlock)
      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument()
      })

      fireEvent.click(screen.getByText("Staked 50K FIDU"))
      expect(await screen.findByText("Claim status")).toBeVisible()
      expect(await screen.findByText("$--.-- (0.82 GFI) claimed of your total unlocked 3.06 GFI")).toBeVisible()
    })

    it("uses GFI price if the Coingecko request returns as expected", async () => {
      const deps = await setupPartiallyClaimedStakingReward(goldfinchProtocol, seniorPool, undefined, currentBlock)

      renderRewards(goldfinchProtocol, deps, currentBlock)
      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument()
      })

      fireEvent.click(screen.getByText("Staked 50K FIDU"))
      expect(await screen.findByText("Claim status")).toBeVisible()
      expect(await screen.findByText("$1.64 (0.82 GFI) claimed of your total unlocked 3.06 GFI")).toBeVisible()
    })

    it("uses GFI price if the fallback request returns as expected", async () => {
      jest.spyOn(global, "fetch").mockImplementation((input: RequestInfo) => {
        const url = input.toString()
        if (url === COINGECKO_API_GFI_PRICE_URL) {
          return Promise.reject("Request failed")
        } else if (url === COINBASE_API_GFI_PRICE_URL) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                data: {
                  base: "GFI",
                  currency: "USD",
                  amount: "2.00",
                },
              }),
          } as Response)
        } else {
          fail(`Unexpected fetch url: ${url}`)
        }
      })

      const deps = await setupPartiallyClaimedStakingReward(goldfinchProtocol, seniorPool, undefined, currentBlock)

      renderRewards(goldfinchProtocol, deps, currentBlock)
      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument()
      })

      fireEvent.click(screen.getByText("Staked 50K FIDU"))
      expect(await screen.findByText("Claim status")).toBeVisible()
      expect(await screen.findByText("$1.64 (0.82 GFI) claimed of your total unlocked 3.06 GFI")).toBeVisible()
    })
  })

  it("shows MerkleDistributor and BackerMerkleDistributor airdrops without vesting", async () => {
    const deps = await setupMerkleDistributorAirdropNoVesting(goldfinchProtocol, seniorPool, currentBlock, {
      distributor: true,
      backerDistributor: true,
    })

    renderRewards(goldfinchProtocol, deps, currentBlock)

    expect(await screen.findByText("Goldfinch Investment")).toBeVisible()
    expect(screen.getAllByText("1,000.00 GFI • Jan 11, 2022")[0]).toBeVisible()
    expect(await screen.getAllByText("Accept")[0]).toBeVisible()

    fireEvent.click(screen.getByText("Goldfinch Investment"))
    expect(await screen.findByText("Transaction details")).toBeVisible()
    expect(await screen.findByText("1,000.00 GFI for participating as a Goldfinch investor")).toBeVisible()

    expect(await screen.findByText("Unlock status")).toBeVisible()
    expect(await screen.findByText("$2,000.00 (1,000.00 GFI) unlocked")).toBeVisible()

    expect(await screen.findByText("Unlock schedule")).toBeVisible()
    expect(await screen.findByText("Immediate")).toBeVisible()

    expect(await screen.findByText("Claim status")).toBeVisible()
    expect(await screen.findByText("Unclaimed")).toBeVisible()

    expect(await screen.findByText("Backer")).toBeVisible()
    expect(screen.getAllByText("1,000.00 GFI • Jan 11, 2022")[1]).toBeVisible()
    expect(await screen.getAllByText("Accept")[1]).toBeVisible()
    fireEvent.click(screen.getByText("Goldfinch Investment"))

    fireEvent.click(screen.getByText("Backer"))
    expect(await screen.findByText("Transaction details")).toBeVisible()
    expect(await screen.findByText("1,000.00 GFI for participating as a Backer")).toBeVisible()

    expect(await screen.findByText("Unlock status")).toBeVisible()
    expect(await screen.findByText("$2,000.00 (1,000.00 GFI) unlocked")).toBeVisible()

    expect(await screen.findByText("Unlock schedule")).toBeVisible()
    expect(await screen.findByText("Immediate")).toBeVisible()

    expect(await screen.findByText("Claim status")).toBeVisible()
    expect(await screen.findByText("Unclaimed")).toBeVisible()

    expect(screen.queryByText("Etherscan")).not.toBeInTheDocument()
  })

  it("shows claimable staking reward on rewards list", async () => {
    const deps = await setupClaimableStakingReward(goldfinchProtocol, seniorPool, currentBlock)

    renderRewards(goldfinchProtocol, deps, currentBlock)

    expect(await screen.findByText("Staked 50K FIDU")).toBeVisible()
    expect(screen.getByText("129.60 GFI to date • Dec 29, 2021")).toBeVisible()
    expect(await screen.findByText("Claim GFI")).toBeVisible()

    expect(screen.getByTestId("detail-unvested").textContent).toEqual("128.89")
    expect(screen.getByTestId("detail-claimable").textContent).toEqual("0.71")

    fireEvent.click(screen.getByText("Staked 50K FIDU"))
    await waitFor(async () => {
      expect(await screen.findByText("Transaction details")).toBeVisible()
      expect(await screen.findByText("Unlock schedule")).toBeVisible()
      expect(await screen.findByText("Linear until 100% on Dec 29, 2022")).toBeVisible()

      expect(await screen.findByText("Claim status")).toBeVisible()
      expect(await screen.findByText("$0.00 (0.00 GFI) claimed of your total unlocked 0.71 GFI")).toBeVisible()

      expect(await screen.findByText("Current earn rate")).toBeVisible()
      expect(await screen.findByText("+453.60 GFI granted per week")).toBeVisible()

      expect(await screen.findByText("Unlock status")).toBeVisible()
      expect(await screen.findByText("0.55% (0.71 GFI) unlocked")).toBeVisible()
    })

    expect(screen.getByText("Etherscan").closest("a")).toHaveAttribute(
      "href",
      `https://${network.name}.etherscan.io/tx/0x0000000000000000000000000000000000000000000000000000000000000000`
    )
  })

  it("shows claimable community reward on rewards list", async () => {
    const deps = await setupClaimableCommunityReward(goldfinchProtocol, seniorPool, currentBlock)

    renderRewards(goldfinchProtocol, deps, currentBlock)

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

    expect(await screen.findByText("Unlock status")).toBeVisible()
    expect(await screen.findByText("100.00% (1,000.00 GFI) unlocked")).toBeVisible()

    expect(await screen.findByText("Unlock schedule")).toBeVisible()
    expect(await screen.findByText("Immediate")).toBeVisible()

    expect(await screen.findByText("Claim status")).toBeVisible()
    expect(await screen.findByText("$0.00 (0.00 GFI) claimed of your total unlocked 1,000.00 GFI")).toBeVisible()

    expect(screen.getByText("Etherscan").closest("a")).toHaveAttribute(
      "href",
      `https://${network.name}.etherscan.io/tx/0x0000000000000000000000000000000000000000000000000000000000000001`
    )
  })

  it("shows claimable backer community reward on rewards list", async () => {
    const isBacker = true
    const deps = await setupClaimableCommunityReward(goldfinchProtocol, seniorPool, currentBlock, isBacker)

    renderRewards(goldfinchProtocol, deps, currentBlock)

    expect(await screen.findByText("Backer")).toBeVisible()
    expect(screen.getByText("1,000.00 GFI • Dec 29, 2021")).toBeVisible()
    expect(await screen.findByText("Claim GFI")).toBeVisible()

    expect(screen.getByTestId("detail-unvested").textContent).toEqual("0.00")
    expect(screen.getByTestId("detail-claimable").textContent).toEqual("1,000.00")

    fireEvent.click(screen.getByText("Backer"))
    expect(await screen.findByText("Transaction details")).toBeVisible()
    expect(await screen.findByText("1,000.00 GFI reward on Dec 29, 2021 for participating as a Backer")).toBeVisible()

    expect(await screen.findByText("Unlock status")).toBeVisible()
    expect(await screen.findByText("100.00% (1,000.00 GFI) unlocked")).toBeVisible()

    expect(await screen.findByText("Unlock schedule")).toBeVisible()
    expect(await screen.findByText("Immediate")).toBeVisible()

    expect(await screen.findByText("Claim status")).toBeVisible()
    expect(await screen.findByText("$0.00 (0.00 GFI) claimed of your total unlocked 1,000.00 GFI")).toBeVisible()

    expect(screen.getByText("Etherscan").closest("a")).toHaveAttribute(
      "href",
      `https://${network.name}.etherscan.io/tx/0x0000000000000000000000000000000000000000000000000000000000000001`
    )
  })

  it("shows claimable backer reward on rewards list", async () => {
    const poolTokenId = "1"
    const poolAddress = "0xfoo"

    mockPoolBackersData([poolTokenId], poolAddress, currentBlock)

    const claimableBackersOnly = new BigNumber(1.5).multipliedBy(GFI_DECIMALS)
    const claimableSeniorPoolMatching = new BigNumber(1.5).multipliedBy(GFI_DECIMALS)
    const claimedBackersOnly = new BigNumber(0).multipliedBy(GFI_DECIMALS)
    const claimedSeniorPoolMatching = new BigNumber(0).multipliedBy(GFI_DECIMALS)

    const deps = await setupClaimableBackerReward(
      goldfinchProtocol,
      seniorPool,
      [
        {
          poolTokenId,
          claimableBackersOnly,
          claimableSeniorPoolMatching,
          claimedBackersOnly,
          claimedSeniorPoolMatching,
        },
      ],
      currentBlock
    )

    renderRewards(goldfinchProtocol, deps, currentBlock)

    expect(await screen.findByText(`Backer of Pool ${poolAddress}`)).toBeVisible()
    expect(screen.getByText("3.00 GFI • Dec 29, 2021")).toBeVisible()
    expect(await screen.findByText("Claim GFI")).toBeVisible()

    expect(screen.getByTestId("detail-unvested").textContent).toEqual("0.00")
    expect(screen.getByTestId("detail-claimable").textContent).toEqual("3.00")

    fireEvent.click(screen.getByText(`Backer of Pool ${poolAddress}`))
    expect(await screen.findByText("Transaction details")).toBeVisible()
    expect(
      await screen.findByText("Supplied $100.00 USDC beginning on Dec 29, 2021 ($50.00 USDC remaining)")
    ).toBeVisible()

    expect(await screen.findByText("Unlock status")).toBeVisible()
    expect(await screen.findByText("100.00% (3.00 GFI) unlocked")).toBeVisible()

    expect(await screen.findByText("Unlock schedule")).toBeVisible()
    expect(await screen.findByText("Immediate")).toBeVisible()

    expect(await screen.findByText("Claim status")).toBeVisible()
    expect(await screen.findByText("$0.00 (0.00 GFI) claimed of your total unlocked 3.00 GFI")).toBeVisible()

    expect(screen.queryByText("Etherscan")).not.toBeInTheDocument()
  })

  it("shows vesting community reward on rewards list", async () => {
    const deps = await setupVestingCommunityReward(goldfinchProtocol, seniorPool, currentBlock)

    renderRewards(goldfinchProtocol, deps, currentBlock)

    expect(await screen.findByText("Goldfinch Investment")).toBeVisible()
    expect(screen.getByText("1,000.00 GFI • Dec 29, 2021")).toBeVisible()
    expect(await screen.findByText("Still Locked", {selector: "button"})).toBeVisible()

    expect(screen.getByTestId("detail-unvested").textContent).toEqual("1,000.00")
    expect(screen.getByTestId("detail-claimable").textContent).toEqual("0.00")

    fireEvent.click(screen.getByText("Goldfinch Investment"))
    expect(await screen.findByText("Transaction details")).toBeVisible()
    expect(
      await screen.findByText("1,000.00 GFI reward on Dec 29, 2021 for participating as a Goldfinch investor")
    ).toBeVisible()

    expect(await screen.findByText("Unlock status")).toBeVisible()
    expect(await screen.findByText("0.00% (0.00 GFI) unlocked")).toBeVisible()

    expect(await screen.findByText("Unlock schedule")).toBeVisible()
    expect(await screen.findByText("Linear until 100% on Dec 29, 2021")).toBeVisible()

    expect(await screen.findByText("Claim status")).toBeVisible()
    expect(await screen.findByText("$0.00 (0.00 GFI) claimed of your total unlocked 0.00 GFI")).toBeVisible()

    expect(screen.getByText("Etherscan").closest("a")).toHaveAttribute(
      "href",
      `https://${network.name}.etherscan.io/tx/0x0000000000000000000000000000000000000000000000000000000000000001`
    )
  })

  it("shows vesting backer community reward on rewards list", async () => {
    const isBacker = true
    const deps = await setupVestingCommunityReward(goldfinchProtocol, seniorPool, currentBlock, isBacker)

    renderRewards(goldfinchProtocol, deps, currentBlock)

    expect(await screen.findByText("Backer")).toBeVisible()
    expect(screen.getByText("1,000.00 GFI • Dec 29, 2021")).toBeVisible()
    expect(await screen.findByText("Still Locked", {selector: "button"})).toBeVisible()

    expect(screen.getByTestId("detail-unvested").textContent).toEqual("1,000.00")
    expect(screen.getByTestId("detail-claimable").textContent).toEqual("0.00")

    fireEvent.click(screen.getByText("Backer"))
    expect(await screen.findByText("Transaction details")).toBeVisible()
    expect(await screen.findByText("1,000.00 GFI reward on Dec 29, 2021 for participating as a Backer")).toBeVisible()

    expect(await screen.findByText("Unlock status")).toBeVisible()
    expect(await screen.findByText("0.00% (0.00 GFI) unlocked")).toBeVisible()

    expect(await screen.findByText("Unlock schedule")).toBeVisible()
    expect(await screen.findByText("Linear until 100% on Dec 29, 2021")).toBeVisible()

    expect(await screen.findByText("Claim status")).toBeVisible()
    expect(await screen.findByText("$0.00 (0.00 GFI) claimed of your total unlocked 0.00 GFI")).toBeVisible()

    expect(screen.getByText("Etherscan").closest("a")).toHaveAttribute(
      "href",
      `https://${network.name}.etherscan.io/tx/0x0000000000000000000000000000000000000000000000000000000000000001`
    )
  })

  it("shows airdrop from MerkleDistributor without vesting", async () => {
    const deps = await setupMerkleDistributorAirdropNoVesting(goldfinchProtocol, seniorPool, currentBlock, {
      distributor: true,
      backerDistributor: false,
    })

    renderRewards(goldfinchProtocol, deps, currentBlock)

    expect(await screen.findByText("Goldfinch Investment")).toBeVisible()
    expect(screen.getByText("1,000.00 GFI • Jan 11, 2022")).toBeVisible()
    expect(await screen.findByText("Accept")).toBeVisible()

    expect(screen.getByTestId("detail-unvested").textContent).toEqual("0.00")
    expect(screen.getByTestId("detail-claimable").textContent).toEqual("1,000.00")

    fireEvent.click(screen.getByText("Goldfinch Investment"))
    expect(await screen.findByText("Transaction details")).toBeVisible()
    expect(await screen.findByText("1,000.00 GFI for participating as a Goldfinch investor")).toBeVisible()

    expect(await screen.findByText("Unlock status")).toBeVisible()
    expect(await screen.findByText("$2,000.00 (1,000.00 GFI) unlocked")).toBeVisible()

    expect(await screen.findByText("Unlock schedule")).toBeVisible()
    expect(await screen.findByText("Immediate")).toBeVisible()

    expect(await screen.findByText("Claim status")).toBeVisible()
    expect(await screen.findByText("Unclaimed")).toBeVisible()

    expect(screen.queryByText("Etherscan")).not.toBeInTheDocument()
  })

  it("shows airdrop from BackerMerkleDistributor without vesting", async () => {
    const deps = await setupMerkleDistributorAirdropNoVesting(goldfinchProtocol, seniorPool, currentBlock, {
      distributor: false,
      backerDistributor: true,
    })

    renderRewards(goldfinchProtocol, deps, currentBlock)

    expect(await screen.findByText("Backer")).toBeVisible()
    expect(screen.getByText("1,000.00 GFI • Jan 11, 2022")).toBeVisible()
    expect(await screen.findByText("Accept")).toBeVisible()

    expect(screen.getByTestId("detail-unvested").textContent).toEqual("0.00")
    expect(screen.getByTestId("detail-claimable").textContent).toEqual("1,000.00")

    fireEvent.click(screen.getByText("Backer"))
    expect(await screen.findByText("Transaction details")).toBeVisible()
    expect(await screen.findByText("1,000.00 GFI for participating as a Backer")).toBeVisible()

    expect(await screen.findByText("Unlock status")).toBeVisible()
    expect(await screen.findByText("$2,000.00 (1,000.00 GFI) unlocked")).toBeVisible()

    expect(await screen.findByText("Unlock schedule")).toBeVisible()
    expect(await screen.findByText("Immediate")).toBeVisible()

    expect(await screen.findByText("Claim status")).toBeVisible()
    expect(await screen.findByText("Unclaimed")).toBeVisible()

    expect(screen.queryByText("Etherscan")).not.toBeInTheDocument()
  })

  it("shows airdrop from MerkleDistributor with vesting", async () => {
    const deps = await setupMerkleDistributorAirdropVesting(
      goldfinchProtocol,
      seniorPool,
      String(currentBlock.timestamp - parseInt(merkleDistributorAirdropVesting.grant.vestingLength, 16) / 2),
      new BigNumber(merkleDistributorAirdropVesting.grant.amount).dividedBy(2).toString(10),
      currentBlock,
      {distributor: true, backerDistributor: false}
    )

    renderRewards(goldfinchProtocol, deps, currentBlock)

    expect(await screen.findByText("Goldfinch Investment")).toBeVisible()
    expect(screen.getByText("1,000.00 GFI • Jan 11, 2022")).toBeVisible()
    expect(await screen.findByText("Accept")).toBeVisible()

    expect(screen.getByTestId("detail-unvested").textContent).toEqual("500.00")
    expect(screen.getByTestId("detail-claimable").textContent).toEqual("500.00")

    fireEvent.click(screen.getByText("Goldfinch Investment"))
    expect(await screen.findByText("Transaction details")).toBeVisible()
    expect(await screen.findByText("1,000.00 GFI for participating as a Goldfinch investor")).toBeVisible()

    expect(await screen.findByText("Unlock status")).toBeVisible()
    expect(await screen.findByText("$1,000.00 (500.00 GFI) unlocked")).toBeVisible()

    expect(await screen.findByText("Unlock schedule")).toBeVisible()
    expect(await screen.findByText("Linear until 100% on Jan 11, 2023")).toBeVisible()

    expect(await screen.findByText("Claim status")).toBeVisible()
    expect(await screen.findByText("Unclaimed")).toBeVisible()

    expect(screen.queryByText("Etherscan")).not.toBeInTheDocument()
  })

  it("shows airdrop from BackerMerkleDistributor with vesting", async () => {
    const deps = await setupMerkleDistributorAirdropVesting(
      goldfinchProtocol,
      seniorPool,
      String(currentBlock.timestamp - parseInt(merkleDistributorAirdropVesting.grant.vestingLength, 16) / 2),
      new BigNumber(merkleDistributorAirdropVesting.grant.amount).dividedBy(2).toString(10),
      currentBlock,
      {distributor: false, backerDistributor: true}
    )

    renderRewards(goldfinchProtocol, deps, currentBlock)

    expect(await screen.findByText("Backer")).toBeVisible()
    expect(screen.getByText("1,000.00 GFI • Jan 11, 2022")).toBeVisible()
    expect(await screen.findByText("Accept")).toBeVisible()

    expect(screen.getByTestId("detail-unvested").textContent).toEqual("500.00")
    expect(screen.getByTestId("detail-claimable").textContent).toEqual("500.00")

    fireEvent.click(screen.getByText("Backer"))
    expect(await screen.findByText("Transaction details")).toBeVisible()
    expect(await screen.findByText("1,000.00 GFI for participating as a Backer")).toBeVisible()

    expect(await screen.findByText("Unlock status")).toBeVisible()
    expect(await screen.findByText("$1,000.00 (500.00 GFI) unlocked")).toBeVisible()

    expect(await screen.findByText("Unlock schedule")).toBeVisible()
    expect(await screen.findByText("Linear until 100% on Jan 11, 2023")).toBeVisible()

    expect(await screen.findByText("Claim status")).toBeVisible()
    expect(await screen.findByText("Unclaimed")).toBeVisible()

    expect(screen.queryByText("Etherscan")).not.toBeInTheDocument()
  })

  it("shows airdrop from MerkleDirectDistributor", async () => {
    const deps = await setupMerkleDirectDistributorAirdrop(goldfinchProtocol, seniorPool, currentBlock)

    renderRewards(goldfinchProtocol, deps, currentBlock)

    expect(await screen.findByText("Flight Academy")).toBeVisible()
    expect(screen.getByText("2,500.00 GFI • Jan 11, 2022")).toBeVisible()
    expect(await screen.findByText("Claim GFI")).toBeVisible()

    expect(screen.getByTestId("detail-unvested").textContent).toEqual("0.00")
    expect(screen.getByTestId("detail-claimable").textContent).toEqual("2,500.00")

    fireEvent.click(screen.getByText("Flight Academy"))
    expect(await screen.findByText("Transaction details")).toBeVisible()
    expect(await screen.findByText("2,500.00 GFI for participating in Flight Academy")).toBeVisible()

    expect(await screen.findByText("Unlock status")).toBeVisible()
    expect(await screen.findByText("$5,000.00 (2,500.00 GFI) unlocked")).toBeVisible()

    expect(await screen.findByText("Unlock schedule")).toBeVisible()
    expect(await screen.findByText("Immediate")).toBeVisible()

    expect(await screen.findByText("Claim status")).toBeVisible()
    expect(await screen.findByText("Unclaimed")).toBeVisible()

    expect(screen.queryByText("Etherscan")).not.toBeInTheDocument()
  })

  it("shows airdrop from BackerMerkleDirectDistributor", async () => {
    const isBacker = true
    const deps = await setupMerkleDirectDistributorAirdrop(goldfinchProtocol, seniorPool, currentBlock, isBacker)

    renderRewards(goldfinchProtocol, deps, currentBlock)

    expect(await screen.findByText("Backer")).toBeVisible()
    expect(screen.getByText("2,500.00 GFI • Jan 11, 2022")).toBeVisible()
    expect(await screen.findByText("Claim GFI")).toBeVisible()

    expect(screen.getByTestId("detail-unvested").textContent).toEqual("0.00")
    expect(screen.getByTestId("detail-claimable").textContent).toEqual("2,500.00")

    fireEvent.click(screen.getByText("Backer"))
    expect(await screen.findByText("Transaction details")).toBeVisible()
    expect(await screen.findByText("2,500.00 GFI for participating as a Backer")).toBeVisible()

    expect(await screen.findByText("Unlock status")).toBeVisible()
    expect(await screen.findByText("$5,000.00 (2,500.00 GFI) unlocked")).toBeVisible()

    expect(await screen.findByText("Unlock schedule")).toBeVisible()
    expect(await screen.findByText("Immediate")).toBeVisible()

    expect(await screen.findByText("Claim status")).toBeVisible()
    expect(await screen.findByText("Unclaimed")).toBeVisible()

    expect(screen.queryByText("Etherscan")).not.toBeInTheDocument()
  })

  it("shows accepted community reward and staking reward", async () => {
    const deps = await setupCommunityRewardAndStakingReward(goldfinchProtocol, seniorPool, currentBlock)

    renderRewards(goldfinchProtocol, deps, currentBlock)

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
    expect(await screen.findByText("Unlock schedule")).toBeVisible()
    expect(await screen.findByText("Linear until 100% on Dec 29, 2022")).toBeVisible()

    expect(await screen.findByText("Claim status")).toBeVisible()
    expect(await screen.findByText("$0.00 (0.00 GFI) claimed of your total unlocked 0.71 GFI")).toBeVisible()

    expect(await screen.findByText("Current earn rate")).toBeVisible()
    expect(await screen.findByText("+453.60 GFI granted per week")).toBeVisible()

    expect(await screen.findByText("Unlock status")).toBeVisible()
    expect(await screen.findByText("0.55% (0.71 GFI) unlocked")).toBeVisible()

    expect(screen.getByText("Etherscan").closest("a")).toHaveAttribute(
      "href",
      `https://${network.name}.etherscan.io/tx/0x0000000000000000000000000000000000000000000000000000000000000000`
    )

    fireEvent.click(screen.getByText("Staked 50K FIDU"))

    fireEvent.click(screen.getByText("Goldfinch Investment"))
    expect(await screen.findByText("Transaction details")).toBeVisible()
    expect(
      await screen.findByText("1,000.00 GFI reward on Dec 29, 2021 for participating as a Goldfinch investor")
    ).toBeVisible()

    expect(await screen.findByText("Unlock status")).toBeVisible()
    expect(await screen.findByText("100.00% (1,000.00 GFI) unlocked")).toBeVisible()

    expect(await screen.findByText("Unlock schedule")).toBeVisible()
    expect(await screen.findByText("Immediate")).toBeVisible()

    expect(await screen.findByText("Claim status")).toBeVisible()
    expect(await screen.findByText("$0.00 (0.00 GFI) claimed of your total unlocked 1,000.00 GFI")).toBeVisible()

    expect(screen.getByText("Etherscan").closest("a")).toHaveAttribute(
      "href",
      `https://${network.name}.etherscan.io/tx/0x0000000000000000000000000000000000000000000000000000000000000001`
    )
  })

  it("shows accepted MerkleDirectDistributor reward and staking reward", async () => {
    const deps = await setupDirectRewardAndStakingReward(goldfinchProtocol, seniorPool, currentBlock)

    renderRewards(goldfinchProtocol, deps, currentBlock)

    expect(await screen.findByText("Staked 50K FIDU")).toBeVisible()
    expect(screen.getByText("129.60 GFI to date • Dec 29, 2021")).toBeVisible()
    expect(await screen.findByText("Flight Academy")).toBeVisible()
    expect(screen.getByText("2,500.00 GFI • Jan 11, 2022")).toBeVisible()
    expect(screen.getAllByTestId("action-button")[0]?.textContent).toEqual("Claim GFI")
    expect(screen.getAllByTestId("action-button")[1]?.textContent).toEqual("Claimed")

    expect(screen.getAllByTestId("detail-unvested")[0]?.textContent).toEqual("128.89")
    expect(screen.getAllByTestId("detail-claimable")[0]?.textContent).toEqual("0.71")
    expect(screen.getAllByTestId("detail-unvested")[1]?.textContent).toEqual("0.00")
    expect(screen.getAllByTestId("detail-claimable")[1]?.textContent).toEqual("0.00")

    fireEvent.click(screen.getByText("Staked 50K FIDU"))
    expect(await screen.findByText("Transaction details")).toBeVisible()
    expect(await screen.findByText("Unlock schedule")).toBeVisible()
    expect(await screen.findByText("Linear until 100% on Dec 29, 2022")).toBeVisible()

    expect(await screen.getByTestId("claim-status-label").textContent).toEqual("Claim status")
    expect(await screen.getByTestId("claim-status-value").textContent).toEqual(
      "$0.00 (0.00 GFI) claimed of your total unlocked 0.71 GFI"
    )

    expect(await screen.findByText("Current earn rate")).toBeVisible()
    expect(await screen.findByText("+453.60 GFI granted per week")).toBeVisible()

    expect(await screen.findByText("Unlock status")).toBeVisible()
    expect(await screen.findByText("0.55% (0.71 GFI) unlocked")).toBeVisible()

    expect(screen.getByText("Etherscan").closest("a")).toHaveAttribute(
      "href",
      `https://${network.name}.etherscan.io/tx/0x0000000000000000000000000000000000000000000000000000000000000000`
    )

    fireEvent.click(screen.getByText("Staked 50K FIDU"))

    fireEvent.click(screen.getByText("Flight Academy"))
    expect(await screen.findByText("Transaction details")).toBeVisible()
    expect(await screen.findByText("2,500.00 GFI for participating in Flight Academy")).toBeVisible()

    expect(await screen.findByText("Unlock status")).toBeVisible()
    expect(await screen.findByText("$5,000.00 (2,500.00 GFI) unlocked")).toBeVisible()

    expect(await screen.findByText("Unlock schedule")).toBeVisible()
    expect(await screen.findByText("Immediate")).toBeVisible()

    expect(await screen.getByTestId("claim-status-label").textContent).toEqual("Claim status")
    expect(await screen.getByTestId("claim-status-value").textContent).toEqual("Claimed")

    expect(screen.getByText("Etherscan").closest("a")).toHaveAttribute(
      "href",
      `https://${network.name}.etherscan.io/tx/0x0000000000000000000000000000000000000000000000000000000000000002`
    )
  })

  it("shows accepted community reward, accepted MerkleDirectDistributor reward, and staking reward", async () => {
    const deps = await setupCommunityRewardAndDirectRewardAndStakingReward(goldfinchProtocol, seniorPool, currentBlock)

    renderRewards(goldfinchProtocol, deps, currentBlock)

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
    expect(await screen.findByText("Unlock schedule")).toBeVisible()
    expect(await screen.findByText("Linear until 100% on Dec 29, 2022")).toBeVisible()

    expect(await screen.findByText("Claim status")).toBeVisible()
    expect(await screen.findByText("$0.00 (0.00 GFI) claimed of your total unlocked 0.71 GFI")).toBeVisible()

    expect(await screen.findByText("Current earn rate")).toBeVisible()
    expect(await screen.findByText("+453.60 GFI granted per week")).toBeVisible()

    expect(await screen.findByText("Unlock status")).toBeVisible()
    expect(await screen.findByText("0.55% (0.71 GFI) unlocked")).toBeVisible()

    expect(screen.getByText("Etherscan").closest("a")).toHaveAttribute(
      "href",
      `https://${network.name}.etherscan.io/tx/0x0000000000000000000000000000000000000000000000000000000000000000`
    )

    fireEvent.click(screen.getByText("Staked 50K FIDU"))

    fireEvent.click(screen.getByText("Goldfinch Investment"))
    expect(await screen.findByText("Transaction details")).toBeVisible()
    expect(
      await screen.findByText("1,000.00 GFI reward on Dec 29, 2021 for participating as a Goldfinch investor")
    ).toBeVisible()

    expect(await screen.findByText("Unlock status")).toBeVisible()
    expect(await screen.findByText("100.00% (1,000.00 GFI) unlocked")).toBeVisible()

    expect(await screen.findByText("Unlock schedule")).toBeVisible()
    expect(await screen.findByText("Immediate")).toBeVisible()

    expect(await screen.getByTestId("claim-status-label").textContent).toEqual("Claim status")
    expect(await screen.getByTestId("claim-status-value").textContent).toEqual(
      "$0.00 (0.00 GFI) claimed of your total unlocked 1,000.00 GFI"
    )

    expect(screen.getByText("Etherscan").closest("a")).toHaveAttribute(
      "href",
      `https://${network.name}.etherscan.io/tx/0x0000000000000000000000000000000000000000000000000000000000000001`
    )

    fireEvent.click(screen.getByText("Goldfinch Investment"))

    fireEvent.click(screen.getByText("Flight Academy"))
    expect(await screen.findByText("Transaction details")).toBeVisible()
    expect(await screen.findByText("2,500.00 GFI for participating in Flight Academy")).toBeVisible()

    expect(await screen.findByText("Unlock status")).toBeVisible()
    expect(await screen.findByText("$5,000.00 (2,500.00 GFI) unlocked")).toBeVisible()

    expect(await screen.findByText("Unlock schedule")).toBeVisible()
    expect(await screen.findByText("Immediate")).toBeVisible()

    expect(await screen.getByTestId("claim-status-label").textContent).toEqual("Claim status")
    expect(await screen.getByTestId("claim-status-value").textContent).toEqual("Claimed")

    expect(screen.getByText("Etherscan").closest("a")).toHaveAttribute(
      "href",
      `https://${network.name}.etherscan.io/tx/0x0000000000000000000000000000000000000000000000000000000000000001`
    )
  })

  it("shows claimed backer reward", async () => {
    const poolTokenId = "1"
    const poolAddress = "0xfoo"

    mockPoolBackersData([poolTokenId], poolAddress, currentBlock)

    const claimableBackersOnly = new BigNumber(0).multipliedBy(GFI_DECIMALS)
    const claimableSeniorPoolMatching = new BigNumber(0).multipliedBy(GFI_DECIMALS)
    const claimedBackersOnly = new BigNumber(1.5).multipliedBy(GFI_DECIMALS)
    const claimedSeniorPoolMatching = new BigNumber(1.5).multipliedBy(GFI_DECIMALS)

    const deps = await setupClaimableBackerReward(
      goldfinchProtocol,
      seniorPool,
      [
        {
          poolTokenId,
          claimableBackersOnly,
          claimableSeniorPoolMatching,
          claimedBackersOnly,
          claimedSeniorPoolMatching,
        },
      ],
      currentBlock
    )

    renderRewards(goldfinchProtocol, deps, currentBlock)

    expect(await screen.findByText(`Backer of Pool ${poolAddress}`)).toBeVisible()
    expect(screen.getByText("3.00 GFI • Dec 29, 2021")).toBeVisible()
    expect(screen.getByTestId("action-button").textContent).toEqual("Still Locked")

    expect(screen.getByTestId("detail-unvested").textContent).toEqual("0.00")
    expect(screen.getByTestId("detail-claimable").textContent).toEqual("0.00")

    fireEvent.click(screen.getByText(`Backer of Pool ${poolAddress}`))
    expect(await screen.findByText("Transaction details")).toBeVisible()
    expect(
      await screen.findByText("Supplied $100.00 USDC beginning on Dec 29, 2021 ($50.00 USDC remaining)")
    ).toBeVisible()

    expect(await screen.findByText("Unlock status")).toBeVisible()
    expect(await screen.findByText("100.00% (3.00 GFI) unlocked")).toBeVisible()

    expect(await screen.findByText("Unlock schedule")).toBeVisible()
    expect(await screen.findByText("Immediate")).toBeVisible()

    expect(await screen.findByText("Claim status")).toBeVisible()
    expect(await screen.findByText("$6.00 (3.00 GFI) claimed of your total unlocked 3.00 GFI")).toBeVisible()

    expect(screen.queryByText("Etherscan")).not.toBeInTheDocument()
  })

  it("staking reward partially claimed appears on list", async () => {
    const deps = await setupPartiallyClaimedStakingReward(goldfinchProtocol, seniorPool, undefined, currentBlock)

    renderRewards(goldfinchProtocol, deps, currentBlock)

    expect(await screen.findByText("Staked 50K FIDU")).toBeVisible()
    expect(screen.getByText("269.00 GFI to date • Dec 29, 2020")).toBeVisible()
    expect(await screen.findByText("Claim GFI")).toBeVisible()

    expect(screen.getByTestId("detail-unvested").textContent).toEqual("265.94")
    expect(screen.getByTestId("detail-claimable").textContent).toEqual("2.24")

    fireEvent.click(screen.getByText("Staked 50K FIDU"))
    await waitFor(async () => {
      expect(await screen.findByText("Transaction details")).toBeVisible()
      expect(await screen.findByText("Unlock schedule")).toBeVisible()
      expect(await screen.findByText("Linear until 100% on Dec 29, 2022")).toBeVisible()

      expect(await screen.findByText("Claim status")).toBeVisible()
      expect(await screen.findByText("$1.64 (0.82 GFI) claimed of your total unlocked 3.06 GFI")).toBeVisible()

      expect(await screen.findByText("Current earn rate")).toBeVisible()
      expect(await screen.findByText("+453.60 GFI granted per week")).toBeVisible()

      expect(await screen.findByText("Unlock status")).toBeVisible()
      expect(await screen.findByText("1.14% (3.06 GFI) unlocked")).toBeVisible()
    })

    expect(screen.getByText("Etherscan").closest("a")).toHaveAttribute(
      "href",
      `https://${network.name}.etherscan.io/tx/0x0000000000000000000000000000000000000000000000000000000000000000`
    )
  })

  it("community reward partially claimed appears on list", async () => {
    const deps = await setupPartiallyClaimedCommunityReward(goldfinchProtocol, seniorPool, undefined, currentBlock)

    renderRewards(goldfinchProtocol, deps, currentBlock)

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

    expect(await screen.findByText("Unlock status")).toBeVisible()
    expect(await screen.findByText("1.64% (16.44 GFI) unlocked")).toBeVisible()

    expect(await screen.findByText("Unlock schedule")).toBeVisible()
    expect(await screen.findByText("Linear until 100% on Dec 8, 2022")).toBeVisible()

    expect(await screen.findByText("Claim status")).toBeVisible()
    expect(await screen.findByText("$10.96 (5.48 GFI) claimed of your total unlocked 16.44 GFI")).toBeVisible()

    expect(screen.getByText("Etherscan").closest("a")).toHaveAttribute(
      "href",
      `https://${network.name}.etherscan.io/tx/0x0000000000000000000000000000000000000000000000000000000000000001`
    )
  })

  it("backer community reward partially claimed appears on list", async () => {
    const isBacker = true
    const deps = await setupPartiallyClaimedCommunityReward(
      goldfinchProtocol,
      seniorPool,
      undefined,
      currentBlock,
      isBacker
    )

    renderRewards(goldfinchProtocol, deps, currentBlock)

    expect(await screen.findByText("Backer")).toBeVisible()
    expect(screen.getByText("1,000.00 GFI • Dec 23, 2021")).toBeVisible()
    expect(await screen.findByText("Claim GFI")).toBeVisible()

    expect(screen.getByTestId("detail-unvested").textContent).toEqual("983.56")
    expect(screen.getByTestId("detail-claimable").textContent).toEqual("10.96")

    fireEvent.click(screen.getByText("Backer"))
    expect(await screen.findByText("Transaction details")).toBeVisible()
    expect(await screen.findByText("1,000.00 GFI reward on Dec 23, 2021 for participating as a Backer")).toBeVisible()

    expect(await screen.findByText("Unlock status")).toBeVisible()
    expect(await screen.findByText("1.64% (16.44 GFI) unlocked")).toBeVisible()

    expect(await screen.findByText("Unlock schedule")).toBeVisible()
    expect(await screen.findByText("Linear until 100% on Dec 8, 2022")).toBeVisible()

    expect(await screen.findByText("Claim status")).toBeVisible()
    expect(await screen.findByText("$10.96 (5.48 GFI) claimed of your total unlocked 16.44 GFI")).toBeVisible()

    expect(screen.getByText("Etherscan").closest("a")).toHaveAttribute(
      "href",
      `https://${network.name}.etherscan.io/tx/0x0000000000000000000000000000000000000000000000000000000000000001`
    )
  })

  it("Accepted MerkleDirectDistributor reward appears on list", async () => {
    const deps = await setupDirectReward(goldfinchProtocol, seniorPool, currentBlock)

    renderRewards(goldfinchProtocol, deps, currentBlock)

    expect(await screen.findByText("Flight Academy")).toBeVisible()
    expect(screen.getByText("2,500.00 GFI • Jan 11, 2022")).toBeVisible()
    expect(screen.getByTestId("action-button").textContent).toEqual("Claimed")

    expect(screen.getAllByTestId("detail-unvested")[0]?.textContent).toEqual("0.00")
    expect(screen.getAllByTestId("detail-claimable")[0]?.textContent).toEqual("0.00")

    fireEvent.click(screen.getByText("Flight Academy"))
    expect(await screen.findByText("Transaction details")).toBeVisible()
    expect(await screen.findByText("2,500.00 GFI for participating in Flight Academy")).toBeVisible()

    expect(await screen.findByText("Unlock status")).toBeVisible()
    expect(await screen.findByText("$5,000.00 (2,500.00 GFI) unlocked")).toBeVisible()

    expect(await screen.findByText("Unlock schedule")).toBeVisible()
    expect(await screen.findByText("Immediate")).toBeVisible()

    expect(await screen.getByTestId("claim-status-label").textContent).toEqual("Claim status")
    expect(await screen.getByTestId("claim-status-value").textContent).toEqual("Claimed")

    expect(screen.getByText("Etherscan").closest("a")).toHaveAttribute(
      "href",
      `https://${network.name}.etherscan.io/tx/0x0000000000000000000000000000000000000000000000000000000000000002`
    )
  })

  it("Accepted BackerMerkleDirectDistributor reward appears on list", async () => {
    const isBacker = true
    const deps = await setupDirectReward(goldfinchProtocol, seniorPool, currentBlock, isBacker)

    renderRewards(goldfinchProtocol, deps, currentBlock)

    expect(await screen.findByText("Backer")).toBeVisible()
    expect(screen.getByText("2,500.00 GFI • Jan 11, 2022")).toBeVisible()
    expect(screen.getByTestId("action-button").textContent).toEqual("Claimed")

    expect(screen.getAllByTestId("detail-unvested")[0]?.textContent).toEqual("0.00")
    expect(screen.getAllByTestId("detail-claimable")[0]?.textContent).toEqual("0.00")

    fireEvent.click(screen.getByText("Backer"))
    expect(await screen.findByText("Transaction details")).toBeVisible()
    expect(await screen.findByText("2,500.00 GFI for participating as a Backer")).toBeVisible()

    expect(await screen.findByText("Unlock status")).toBeVisible()
    expect(await screen.findByText("$5,000.00 (2,500.00 GFI) unlocked")).toBeVisible()

    expect(await screen.findByText("Unlock schedule")).toBeVisible()
    expect(await screen.findByText("Immediate")).toBeVisible()

    expect(await screen.getByTestId("claim-status-label").textContent).toEqual("Claim status")
    expect(await screen.getByTestId("claim-status-value").textContent).toEqual("Claimed")

    expect(screen.getByText("Etherscan").closest("a")).toHaveAttribute(
      "href",
      `https://${network.name}.etherscan.io/tx/0x0000000000000000000000000000000000000000000000000000000000000002`
    )
  })

  describe("rewards transactions", () => {
    it("for MerkleDistributor airdrop, clicking button triggers sending `acceptGrant()`", async () => {
      const deps = await setupMerkleDistributorAirdropNoVesting(goldfinchProtocol, seniorPool, currentBlock, {
        distributor: true,
        backerDistributor: false,
      })
      const networkMonitor = {
        addPendingTX: () => {},
        watch: () => {},
        markTXErrored: () => {},
      } as unknown as NetworkMonitor
      const refreshCurrentBlock = jest.fn()

      renderRewards(goldfinchProtocol, deps, currentBlock, refreshCurrentBlock, networkMonitor)

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

    it("for BackerMerkleDistributor airdrop, clicking button triggers sending `acceptGrant()`", async () => {
      const deps = await setupMerkleDistributorAirdropNoVesting(goldfinchProtocol, seniorPool, currentBlock, {
        distributor: false,
        backerDistributor: true,
      })
      const networkMonitor = {
        addPendingTX: () => {},
        watch: () => {},
        markTXErrored: () => {},
      } as unknown as NetworkMonitor
      const refreshCurrentBlock = jest.fn()

      renderRewards(goldfinchProtocol, deps, currentBlock, refreshCurrentBlock, networkMonitor)

      expect(await screen.findByText("Backer")).toBeVisible()
      expect(screen.getByText("1,000.00 GFI • Jan 11, 2022")).toBeVisible()
      expect(await screen.findByText("Accept")).toBeVisible()

      web3.userWallet.eth.getGasPrice = () => {
        return Promise.resolve("100000000")
      }
      const DEPLOYMENTS = await getDeployments()
      const acceptMock = mock({
        blockchain,
        transaction: {
          to: DEPLOYMENTS.contracts.BackerMerkleDistributor.address,
          api: DEPLOYMENTS.contracts.BackerMerkleDistributor.abi,
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

      renderRewards(goldfinchProtocol, deps, currentBlock, refreshCurrentBlock, networkMonitor)

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

    it("for BackerMerkleDirectDistributor airdrop, clicking button triggers sending `acceptGrant()`", async () => {
      const isBacker = true
      const deps = await setupMerkleDirectDistributorAirdrop(goldfinchProtocol, seniorPool, currentBlock, isBacker)
      const networkMonitor = {
        addPendingTX: () => {},
        watch: () => {},
        markTXErrored: () => {},
      } as unknown as NetworkMonitor
      const refreshCurrentBlock = jest.fn()

      renderRewards(goldfinchProtocol, deps, currentBlock, refreshCurrentBlock, networkMonitor)

      expect(await screen.findByText("Backer")).toBeVisible()
      expect(await screen.getByText("2,500.00 GFI • Jan 11, 2022")).toBeVisible()
      expect(await screen.findByText("Claim GFI")).toBeVisible()

      web3.userWallet.eth.getGasPrice = () => {
        return Promise.resolve("100000000")
      }
      const DEPLOYMENTS = await getDeployments()
      const acceptMock = mock({
        blockchain,
        transaction: {
          to: DEPLOYMENTS.contracts.BackerMerkleDirectDistributor.address,
          api: DEPLOYMENTS.contracts.BackerMerkleDirectDistributor.abi,
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

      renderRewards(goldfinchProtocol, deps, currentBlock, refreshCurrentBlock, networkMonitor)

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

    it("clicking backer community rewards button triggers sending `getReward()`", async () => {
      const isBacker = true
      const deps = await setupClaimableCommunityReward(goldfinchProtocol, seniorPool, currentBlock, isBacker)
      const networkMonitor = {
        addPendingTX: () => {},
        watch: () => {},
        markTXErrored: () => {},
      } as unknown as NetworkMonitor
      const refreshCurrentBlock = jest.fn()

      renderRewards(goldfinchProtocol, deps, currentBlock, refreshCurrentBlock, networkMonitor)

      expect(await screen.findByText("Backer")).toBeVisible()
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

      renderRewards(goldfinchProtocol, deps, currentBlock, refreshCurrentBlock, networkMonitor)

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

    it("clicking backer rewards button triggers sending `withdraw()`, if user has one pool token", async () => {
      const poolTokenId = "1"
      const poolAddress = "0xfoo"

      mockPoolBackersData([poolTokenId], poolAddress, currentBlock)

      const claimableBackersOnly = new BigNumber(1.5).multipliedBy(GFI_DECIMALS)
      const claimableSeniorPoolMatching = new BigNumber(1.5).multipliedBy(GFI_DECIMALS)
      const claimedBackersOnly = new BigNumber(0).multipliedBy(GFI_DECIMALS)
      const claimedSeniorPoolMatching = new BigNumber(0).multipliedBy(GFI_DECIMALS)

      const deps = await setupClaimableBackerReward(
        goldfinchProtocol,
        seniorPool,
        [
          {
            poolTokenId,
            claimableBackersOnly,
            claimableSeniorPoolMatching,
            claimedBackersOnly,
            claimedSeniorPoolMatching,
          },
        ],
        currentBlock
      )
      const networkMonitor = {
        addPendingTX: () => {},
        watch: () => {},
        markTXErrored: () => {},
      } as unknown as NetworkMonitor
      const refreshCurrentBlock = jest.fn()

      renderRewards(goldfinchProtocol, deps, currentBlock, refreshCurrentBlock, networkMonitor)

      expect(await screen.findByText("Claim GFI")).toBeVisible()

      web3.userWallet.eth.getGasPrice = () => {
        return Promise.resolve("100000000")
      }
      const DEPLOYMENTS = await getDeployments()
      const withdrawMock = mock({
        blockchain,
        transaction: {
          to: DEPLOYMENTS.contracts.BackerRewards.address,
          api: DEPLOYMENTS.contracts.BackerRewards.abi,
          method: "withdraw",
          params: poolTokenId,
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

      expect(withdrawMock).toHaveBeenCalled()
      expect(watchAssetMock).toHaveBeenCalled()
    })
    it("clicking backer rewards button triggers sending `withdrawMultiple()`, if user has multiple pool tokens", async () => {
      const poolTokenId1 = "1"
      const poolTokenId2 = "2"
      const poolAddress = "0xfoo"

      mockPoolBackersData([poolTokenId1, poolTokenId2], poolAddress, currentBlock)

      const claimableBackersOnly = new BigNumber(1.5).multipliedBy(GFI_DECIMALS)
      const claimableSeniorPoolMatching = new BigNumber(1.5).multipliedBy(GFI_DECIMALS)
      const claimedBackersOnly = new BigNumber(0).multipliedBy(GFI_DECIMALS)
      const claimedSeniorPoolMatching = new BigNumber(0).multipliedBy(GFI_DECIMALS)

      const deps = await setupClaimableBackerReward(
        goldfinchProtocol,
        seniorPool,
        [
          {
            poolTokenId: poolTokenId1,
            claimableBackersOnly,
            claimableSeniorPoolMatching,
            claimedBackersOnly,
            claimedSeniorPoolMatching,
          },
          {
            poolTokenId: poolTokenId2,
            claimableBackersOnly,
            claimableSeniorPoolMatching,
            claimedBackersOnly,
            claimedSeniorPoolMatching,
          },
        ],
        currentBlock
      )
      const networkMonitor = {
        addPendingTX: () => {},
        watch: () => {},
        markTXErrored: () => {},
      } as unknown as NetworkMonitor
      const refreshCurrentBlock = jest.fn()

      renderRewards(goldfinchProtocol, deps, currentBlock, refreshCurrentBlock, networkMonitor)

      expect(await screen.findByText("Claim GFI")).toBeVisible()

      web3.userWallet.eth.getGasPrice = () => {
        return Promise.resolve("100000000")
      }
      const DEPLOYMENTS = await getDeployments()
      const withdrawMultipleMock = mock({
        blockchain,
        transaction: {
          to: DEPLOYMENTS.contracts.BackerRewards.address,
          api: DEPLOYMENTS.contracts.BackerRewards.abi,
          method: "withdrawMultiple",
          params: [[poolTokenId1, poolTokenId2]],
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

      expect(withdrawMultipleMock).toHaveBeenCalled()
      expect(watchAssetMock).toHaveBeenCalled()
    })
  })
})
