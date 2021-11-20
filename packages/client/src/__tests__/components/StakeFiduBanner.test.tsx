import "@testing-library/jest-dom"
import {mock} from "depay-web3-mock"
import {BrowserRouter as Router} from "react-router-dom"
import BigNumber from "bignumber.js"
import {render, screen, fireEvent, waitFor} from "@testing-library/react"
import {AppContext} from "../../App"
import web3 from "../../web3"
import StakeFiduBanner from "../../components/stakeFiduBanner"
import {GFILoaded} from "../../ethereum/gfi"
import {
  fetchCapitalProviderData,
  SeniorPool,
  SeniorPoolLoaded,
  StakingRewardsLoaded,
  CapitalProvider,
  mockGetWeightedAverageSharePrice,
  PoolData,
} from "../../ethereum/pool"
import {User, UserLoaded} from "../../ethereum/user"
import {blockInfo, DEPLOYMENTS, network, recipient} from "../rewards/__utils__/constants"
import {GoldfinchProtocol} from "../../ethereum/GoldfinchProtocol"
import {getDefaultClasses} from "../rewards/__utils__/scenarios"
import {assertWithLoadedInfo} from "../../types/loadable"
import {
  mockCapitalProviderCalls,
  mockStakeFiduBannerCalls,
  mockUserInitializationContractCalls,
  setupMocksForAirdrop,
} from "../rewards/__utils__/mocks"
import * as utils from "../../ethereum/utils"
import {CommunityRewardsLoaded, MerkleDistributorLoaded} from "../../ethereum/communityRewards"
import {CreditDesk} from "@goldfinch-eng/protocol/typechain/web3/CreditDesk"
import {KYC} from "../../hooks/useGoldfinchClient"

mock({
  blockchain: "ethereum",
})

web3.setProvider(global.ethereum)

function renderStakeFiduBanner(
  pool: SeniorPoolLoaded,
  stakingRewards: StakingRewardsLoaded | undefined,
  gfi: GFILoaded | undefined,
  user: UserLoaded | undefined,
  capitalProvider: CapitalProvider | undefined,
  refreshCurrentBlock?: any,
  networkMonitor?: any
) {
  const store = {
    currentBlock: blockInfo,
    network,
    stakingRewards,
    gfi,
    user,
    pool,
    refreshCurrentBlock,
    networkMonitor,
  }
  const kyc: KYC = {status: "approved", countryCode: "BR"}
  return render(
    <AppContext.Provider value={store}>
      <Router>
        <StakeFiduBanner capitalProvider={capitalProvider} kyc={kyc} actionComplete={() => {}} />
      </Router>
    </AppContext.Provider>
  )
}

describe("Stake unstaked fidu", () => {
  const stakeButtonCopy = "Stake all FIDU"
  let seniorPool: SeniorPoolLoaded
  let goldfinchProtocol = new GoldfinchProtocol(network)
  let gfi: GFILoaded,
    stakingRewards: StakingRewardsLoaded,
    communityRewards: CommunityRewardsLoaded,
    merkleDistributor: MerkleDistributorLoaded,
    user: UserLoaded

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
        poolData: {estimatedApyFromGfi: new BigNumber(0.1)} as PoolData,
        isPaused: false,
      },
    }
    assertWithLoadedInfo(_seniorPoolLoaded)
    seniorPool = _seniorPoolLoaded

    const results = await getDefaultClasses(goldfinchProtocol)
    gfi = results.gfi
    stakingRewards = results.stakingRewards
    communityRewards = results.communityRewards
    merkleDistributor = results.merkleDistributor

    const _user = new User(recipient, network.name, undefined as unknown as CreditDesk, goldfinchProtocol, undefined)
    mockUserInitializationContractCalls(_user, stakingRewards, gfi, communityRewards, merkleDistributor, {})
    await _user.initialize(seniorPool, stakingRewards, gfi, communityRewards, merkleDistributor, blockInfo)
    assertWithLoadedInfo(_user)
    user = _user
  })

  afterEach(() => {
    mockGetWeightedAverageSharePrice(undefined)
    jest.clearAllMocks()
  })

  it("do not show banner when user has no unstaked fidu", async () => {
    renderStakeFiduBanner(seniorPool, stakingRewards, gfi, user, undefined)
    const stakeButton = screen.queryByText(stakeButtonCopy)
    expect(stakeButton).not.toBeInTheDocument()
  })

  it("shows banner when user has unstaked fidu", async () => {
    mockCapitalProviderCalls("1000456616980000000", "50000000000000000000", "0", "1")
    const capitalProvider = await fetchCapitalProviderData(seniorPool, stakingRewards, gfi, user)
    const {container} = renderStakeFiduBanner(seniorPool, stakingRewards, gfi, user, capitalProvider.value)

    const stakeButton = screen.queryByText(stakeButtonCopy)
    expect(stakeButton).toBeInTheDocument()

    const message = await container.getElementsByClassName("message")
    expect(message.length).toEqual(1)
    expect(message[0]?.textContent).toBe(
      "You have 50.00 FIDU ($50.02) that is not staked. Stake your FIDU to earn an estimated 10.00% APY in GFI rewards."
    )
  })

  it("shows banner when user has little unstaked fidu", async () => {
    mockCapitalProviderCalls("1000456616980000000", "50000000000", "0", "1")
    const capitalProvider = await fetchCapitalProviderData(seniorPool, stakingRewards, gfi, user)
    const {container} = renderStakeFiduBanner(seniorPool, stakingRewards, gfi, user, capitalProvider.value)

    const stakeButton = screen.queryByText(stakeButtonCopy)
    expect(stakeButton).toBeInTheDocument()

    const message = await container.getElementsByClassName("message")
    expect(message.length).toEqual(1)
    expect(message[0]?.textContent).toBe(
      "You have <0.01 FIDU (<$0.01) that is not staked. Stake your FIDU to earn an estimated 10.00% APY in GFI rewards."
    )
  })

  describe("staking transaction(s)", () => {
    describe("with 0 FIDU already approved for transfer by StakingRewards", () => {
      it("clicking button triggers sending `approve()` then `stake()` transactions", async () => {
        mockCapitalProviderCalls("1000456616980000000", "50000000000000000000", "0", "1")
        const capitalProvider = await fetchCapitalProviderData(seniorPool, stakingRewards, gfi, user)
        const networkMonitor = {
          addPendingTX: () => {},
          watch: () => {},
          markTXErrored: () => {},
        }
        const refreshCurrentBlock = jest.fn()
        renderStakeFiduBanner(
          seniorPool,
          stakingRewards,
          gfi,
          user,
          capitalProvider.value,
          refreshCurrentBlock,
          networkMonitor
        )

        const toApproveAmount = "50000000000000000000"
        const allowanceAmount = "0"
        const notStakedFidu = "50000000000000000000"
        const {balanceMock, allowanceMock, approvalMock, stakeMock} = mockStakeFiduBannerCalls(
          toApproveAmount,
          allowanceAmount,
          notStakedFidu
        )

        fireEvent.click(await screen.getByText(stakeButtonCopy))
        await waitFor(async () => {
          expect(await screen.getByText("Submitting...")).toBeInTheDocument()
        })

        expect(balanceMock).toHaveBeenCalled()
        expect(allowanceMock).toHaveBeenCalled()
        expect(approvalMock).toHaveBeenCalled()
        expect(stakeMock).toHaveBeenCalled()
      })
    })

    describe("with some FIDU already approved for transfer by StakingRewards", () => {
      it("clicking button triggers sending `approve()` then `stake()` transactions", async () => {
        mockCapitalProviderCalls("1000456616980000000", "50000000000000000000", "0", "1")
        const capitalProvider = await fetchCapitalProviderData(seniorPool, stakingRewards, gfi, user)
        const networkMonitor = {
          addPendingTX: () => {},
          watch: () => {},
          markTXErrored: () => {},
        }
        const refreshCurrentBlock = jest.fn()
        renderStakeFiduBanner(
          seniorPool,
          stakingRewards,
          gfi,
          user,
          capitalProvider.value,
          refreshCurrentBlock,
          networkMonitor
        )

        const toApproveAmount = "25000000000000000000"
        const allowanceAmount = "25000000000000000000"
        const notStakedFidu = "50000000000000000000"
        const {balanceMock, allowanceMock, approvalMock, stakeMock} = mockStakeFiduBannerCalls(
          toApproveAmount,
          allowanceAmount,
          notStakedFidu
        )
        fireEvent.click(await screen.getByText(stakeButtonCopy))
        await waitFor(async () => {
          expect(await screen.getByText("Submitting...")).toBeInTheDocument()
        })

        expect(balanceMock).toHaveBeenCalled()
        expect(allowanceMock).toHaveBeenCalled()
        expect(approvalMock).toHaveBeenCalled()
        expect(stakeMock).toHaveBeenCalled()
      })
    })

    describe("with all FIDU already approved for transfer by StakingRewards", () => {
      it("clicking button triggers sending `stake()` transactions", async () => {
        mockCapitalProviderCalls("1000456616980000000", "50000000000000000000", "0", "1")
        const capitalProvider = await fetchCapitalProviderData(seniorPool, stakingRewards, gfi, user)
        const networkMonitor = {
          addPendingTX: () => {},
          watch: () => {},
          markTXErrored: () => {},
        }
        const refreshCurrentBlock = jest.fn()
        renderStakeFiduBanner(
          seniorPool,
          stakingRewards,
          gfi,
          user,
          capitalProvider.value,
          refreshCurrentBlock,
          networkMonitor
        )

        const toApproveAmount = "50000000000000000000"
        const allowanceAmount = "50000000000000000000"
        const notStakedFidu = "50000000000000000000"
        const {balanceMock, allowanceMock, approvalMock, stakeMock} = mockStakeFiduBannerCalls(
          toApproveAmount,
          allowanceAmount,
          notStakedFidu
        )

        fireEvent.click(await screen.getByText(stakeButtonCopy))
        await waitFor(async () => {
          expect(await screen.getByText("Submitting...")).toBeInTheDocument()
        })

        expect(balanceMock).toHaveBeenCalled()
        expect(allowanceMock).toHaveBeenCalled()
        expect(approvalMock).not.toHaveBeenCalled()
        expect(stakeMock).toHaveBeenCalled()
      })
    })
  })
})
