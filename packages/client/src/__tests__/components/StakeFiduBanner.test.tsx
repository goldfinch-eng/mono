import "@testing-library/jest-dom"
import {fireEvent, render, screen, waitFor} from "@testing-library/react"
import BigNumber from "bignumber.js"
import {mock} from "depay-web3-mock"
import {BrowserRouter as Router} from "react-router-dom"
import sinon from "sinon"
import {AppContext} from "../../App"
import StakeFiduBanner from "../../components/stakeFiduBanner"
import {GFILoaded} from "../../ethereum/gfi"
import {GoldfinchProtocol} from "../../ethereum/GoldfinchProtocol"
import {
  CapitalProvider,
  fetchCapitalProviderData,
  mockGetWeightedAverageSharePrice,
  PoolData,
  SeniorPool,
  SeniorPoolLoaded,
  StakingRewardsLoaded,
} from "../../ethereum/pool"
import {UserLoaded} from "../../ethereum/user"
import * as utils from "../../ethereum/utils"
import {assertWithLoadedInfo} from "../../types/loadable"
import {BlockInfo} from "../../utils"
import web3 from "../../web3"
import {defaultCurrentBlock, getDeployments, network} from "../rewards/__utils__/constants"
import {mockCapitalProviderCalls, mockStakeFiduBannerCalls, resetAirdropMocks} from "../rewards/__utils__/mocks"
import {prepareBaseDeps, prepareUserRelatedDeps} from "../rewards/__utils__/scenarios"

mock({
  blockchain: "ethereum",
})

web3.setProvider((global.window as any).ethereum)

function renderStakeFiduBanner(
  pool: SeniorPoolLoaded,
  stakingRewards: StakingRewardsLoaded | undefined,
  gfi: GFILoaded | undefined,
  user: UserLoaded | undefined,
  capitalProvider: CapitalProvider | undefined,
  currentBlock: BlockInfo | undefined,
  refreshCurrentBlock?: any,
  networkMonitor?: any
) {
  const store = {
    currentBlock,
    network,
    stakingRewards,
    gfi,
    user,
    pool,
    refreshCurrentBlock,
    networkMonitor,
  }
  return render(
    <AppContext.Provider value={store}>
      <Router>
        <StakeFiduBanner capitalProvider={capitalProvider} actionComplete={() => {}} disabled={false} />
      </Router>
    </AppContext.Provider>
  )
}

describe("Stake unstaked fidu", () => {
  let sandbox = sinon.createSandbox()
  const stakeButtonCopy = "Stake all FIDU"
  let seniorPool: SeniorPoolLoaded
  let goldfinchProtocol = new GoldfinchProtocol(network)
  let gfi: GFILoaded, stakingRewards: StakingRewardsLoaded, user: UserLoaded
  const currentBlock = defaultCurrentBlock

  beforeEach(() => {
    sandbox.stub(process, "env").value({...process.env, REACT_APP_TOGGLE_REWARDS: "true"})
  })

  afterEach(() => {
    sandbox.restore()
  })

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
        poolData: {estimatedApyFromGfi: new BigNumber(0.1)} as PoolData,
        isPaused: false,
      },
    }
    assertWithLoadedInfo(_seniorPoolLoaded)
    seniorPool = _seniorPoolLoaded

    const baseDeps = await prepareBaseDeps(goldfinchProtocol, currentBlock)
    gfi = baseDeps.gfi
    stakingRewards = baseDeps.stakingRewards
    const userRelatedDeps = await prepareUserRelatedDeps({goldfinchProtocol, seniorPool, ...baseDeps}, {currentBlock})
    user = userRelatedDeps.user
  })

  afterEach(() => {
    mockGetWeightedAverageSharePrice(undefined)
    jest.clearAllMocks()
  })

  describe("senior pool eligibility", () => {
    it("sets placeholder class if not eligible", async () => {
      user.info.value.goListed = false
      await mockCapitalProviderCalls()
      const capitalProvider = await fetchCapitalProviderData(seniorPool, stakingRewards, gfi, user)
      const {container} = renderStakeFiduBanner(
        seniorPool,
        stakingRewards,
        gfi,
        user,
        capitalProvider.value,
        currentBlock
      )

      const message = await container.getElementsByClassName("placeholder")
      expect(message.length).toEqual(1)
    })

    it("does not set placeholder class if eligible", async () => {
      user.info.value.goListed = true
      await mockCapitalProviderCalls()
      const capitalProvider = await fetchCapitalProviderData(seniorPool, stakingRewards, gfi, user)
      const {container} = renderStakeFiduBanner(
        seniorPool,
        stakingRewards,
        gfi,
        user,
        capitalProvider.value,
        currentBlock
      )

      const message = await container.getElementsByClassName("placeholder")
      expect(message.length).toEqual(0)
    })
  })

  it("do not show banner when user has no unstaked fidu", async () => {
    renderStakeFiduBanner(seniorPool, stakingRewards, gfi, user, undefined, currentBlock)
    const stakeButton = screen.queryByText(stakeButtonCopy)
    expect(stakeButton).not.toBeInTheDocument()
  })

  it("shows banner when user has unstaked fidu", async () => {
    await mockCapitalProviderCalls()
    const capitalProvider = await fetchCapitalProviderData(seniorPool, stakingRewards, gfi, user)
    const {container} = renderStakeFiduBanner(
      seniorPool,
      stakingRewards,
      gfi,
      user,
      capitalProvider.value,
      currentBlock
    )

    const stakeButton = screen.queryByText(stakeButtonCopy)
    expect(stakeButton).toBeInTheDocument()

    const message = await container.getElementsByClassName("message")
    expect(message.length).toEqual(1)
    expect(message[0]?.textContent).toBe(
      "You have 50.00 FIDU ($50.02) that is not staked. Stake your FIDU to earn an estimated 10.00% APY in GFI rewards."
    )
  })

  it("shows banner when user has little unstaked fidu", async () => {
    await mockCapitalProviderCalls(undefined, "50000000000", undefined, undefined)
    const capitalProvider = await fetchCapitalProviderData(seniorPool, stakingRewards, gfi, user)
    const {container} = renderStakeFiduBanner(
      seniorPool,
      stakingRewards,
      gfi,
      user,
      capitalProvider.value,
      currentBlock
    )

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
        await mockCapitalProviderCalls()
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
          currentBlock,
          refreshCurrentBlock,
          networkMonitor
        )

        const toApproveAmount = "50000000000000000000"
        const allowanceAmount = "0"
        const notStakedFidu = "50000000000000000000"
        const {balanceMock, allowanceMock, approvalMock, stakeMock} = await mockStakeFiduBannerCalls(
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
        await mockCapitalProviderCalls()
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
          currentBlock,
          refreshCurrentBlock,
          networkMonitor
        )

        const toApproveAmount = "25000000000000000000"
        const allowanceAmount = "25000000000000000000"
        const notStakedFidu = "50000000000000000000"
        const {balanceMock, allowanceMock, approvalMock, stakeMock} = await mockStakeFiduBannerCalls(
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
        await mockCapitalProviderCalls()
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
          currentBlock,
          refreshCurrentBlock,
          networkMonitor
        )

        const toApproveAmount = "50000000000000000000"
        const allowanceAmount = "50000000000000000000"
        const notStakedFidu = "50000000000000000000"
        const {balanceMock, allowanceMock, approvalMock, stakeMock} = await mockStakeFiduBannerCalls(
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

    describe("REACT_APP_TOGGLE_REWARDS is set to false", () => {
      beforeEach(() => {
        sandbox.stub(process, "env").value({...process.env, REACT_APP_TOGGLE_REWARDS: "false"})
      })

      it("hide the stake button", async () => {
        await mockCapitalProviderCalls()
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
          currentBlock,
          refreshCurrentBlock,
          networkMonitor
        )

        expect(await screen.queryByText(stakeButtonCopy)).not.toBeInTheDocument()
      })
    })
  })
})
