import "@testing-library/jest-dom"
import {mock} from "depay-web3-mock"
import {BigNumber} from "bignumber.js"
import {BrowserRouter as Router} from "react-router-dom"
import {render, screen, fireEvent, act} from "@testing-library/react"
import {AppContext} from "../../App"
import web3 from "../../web3"
import StakeFiduBanner from "../../components/stakeFiduBanner"
import {GFILoaded} from "../../ethereum/gfi"
import {fetchCapitalProviderData, SeniorPool, SeniorPoolLoaded, StakingRewardsLoaded} from "../../ethereum/pool"
import {User, UserLoaded} from "../../ethereum/user"
import {blockchain, blockInfo, DEPLOYMENTS, erc20ABI, fiduABI, network, recipient} from "../rewards/__utils__/constants"
import {GoldfinchProtocol} from "../../ethereum/GoldfinchProtocol"
import {getDefaultClasses} from "../rewards/__utils__/scenarios"
import {assertWithLoadedInfo} from "../../types/loadable"
import {mockUserInitializationContractCalls, setupMocksForAirdrop} from "../rewards/__utils__/mocks"
import * as utils from "../../ethereum/utils"
import * as poolModule from "../../ethereum/pool"
import {Context} from "react-responsive"

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

function renderStakeFiduBanner(
  pool: SeniorPoolLoaded,
  stakingRewards: StakingRewardsLoaded | undefined,
  gfi: GFILoaded | undefined,
  user: UserLoaded | undefined,
  capitalProvider
) {
  const store = {
    currentBlock: blockInfo,
    network,
    stakingRewards,
    gfi,
    user,
    pool,
  }
  const kyc = {status: "approved", countryCode: "BR"}
  return render(
    <AppContext.Provider value={store}>
      <Router>
        <StakeFiduBanner capitalProvider={capitalProvider} kyc={kyc} actionComplete={() => {}} />
      </Router>
    </AppContext.Provider>
  )
}

describe("Stake unstaked fidu", () => {
  let seniorPool
  let goldfinchProtocol = new GoldfinchProtocol(network)

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
        poolData: {},
        isPaused: false,
      },
    }
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it("do not show banner when user has no unstaked fidu", async () => {
    const {gfi, stakingRewards, communityRewards, merkleDistributor} = await getDefaultClasses(goldfinchProtocol)
    const user = new User(recipient, network.name, undefined, goldfinchProtocol, undefined)
    mockUserInitializationContractCalls(user, stakingRewards, gfi, communityRewards, merkleDistributor, {})
    await user.initialize(seniorPool, stakingRewards, gfi, communityRewards, merkleDistributor, blockInfo)

    assertWithLoadedInfo(user)
    assertWithLoadedInfo(seniorPool)
    renderStakeFiduBanner(seniorPool, stakingRewards, gfi, user, undefined)

    const stakeButton = screen.queryByText("Stake all FIDU")
    expect(stakeButton).not.toBeInTheDocument()
  })

  it("shows banner when user has unstaked fidu", async () => {
    const {gfi, stakingRewards, communityRewards, merkleDistributor} = await getDefaultClasses(goldfinchProtocol)
    const user = new User(recipient, network.name, undefined, goldfinchProtocol, undefined)
    mockUserInitializationContractCalls(user, stakingRewards, gfi, communityRewards, merkleDistributor, {})
    await user.initialize(seniorPool, stakingRewards, gfi, communityRewards, merkleDistributor, blockInfo)

    assertWithLoadedInfo(user)
    assertWithLoadedInfo(seniorPool)

    mockCapitalProviderCalls("1000456616980000000", "50000000000000000000", "0", "1")

    const capitalProvider = await fetchCapitalProviderData(seniorPool, stakingRewards, gfi, user)
    const {container} = renderStakeFiduBanner(seniorPool, stakingRewards, gfi, user, capitalProvider.value)

    const stakeButton = screen.queryByText("Stake all FIDU")
    expect(stakeButton).toBeInTheDocument()

    const message = await container.getElementsByClassName("message")
    expect(message[0]?.textContent).toBe(
      "You have 50.00 FIDU ($50.02) that is not staked. Stake your FIDU to earn an estimated --.--% APY in GFI rewards."
    )
  })

  it("shows banner when user has little unstaked fidu", async () => {
    const {gfi, stakingRewards, communityRewards, merkleDistributor} = await getDefaultClasses(goldfinchProtocol)
    const user = new User(recipient, network.name, undefined, goldfinchProtocol, undefined)
    mockUserInitializationContractCalls(user, stakingRewards, gfi, communityRewards, merkleDistributor, {})
    await user.initialize(seniorPool, stakingRewards, gfi, communityRewards, merkleDistributor, blockInfo)

    assertWithLoadedInfo(user)
    assertWithLoadedInfo(seniorPool)

    mockCapitalProviderCalls("1000456616980000000", "50000000000", "0", "1")

    const capitalProvider = await fetchCapitalProviderData(seniorPool, stakingRewards, gfi, user)
    const {container} = renderStakeFiduBanner(seniorPool, stakingRewards, gfi, user, capitalProvider.value)

    const stakeButton = screen.queryByText("Stake all FIDU")
    expect(stakeButton).toBeInTheDocument()

    const message = await container.getElementsByClassName("message")
    expect(message[0]?.textContent).toBe(
      "You have <0.01 FIDU (<$0.01) that is not staked. Stake your FIDU to earn an estimated --.--% APY in GFI rewards."
    )
  })

  describe("staking transaction(s)", () => {
    describe("with 0 FIDU already approved for transfer by StakingRewards", () => {
      it("clicking button triggers sending `approve()` then `stake()` transactions", async () => {
        const {gfi, stakingRewards, communityRewards, merkleDistributor} = await getDefaultClasses(goldfinchProtocol)
        const user = new User(recipient, network.name, undefined, goldfinchProtocol, undefined)
        mockUserInitializationContractCalls(user, stakingRewards, gfi, communityRewards, merkleDistributor, {})
        await user.initialize(seniorPool, stakingRewards, gfi, communityRewards, merkleDistributor, blockInfo)

        assertWithLoadedInfo(user)
        assertWithLoadedInfo(seniorPool)

        mockCapitalProviderCalls("1000456616980000000", "50000000000000000000", "0", "1")

        const capitalProvider = await fetchCapitalProviderData(seniorPool, stakingRewards, gfi, user)
        renderStakeFiduBanner(seniorPool, stakingRewards, gfi, user, capitalProvider.value)

        web3.eth.getGasPrice = jest.fn()

        mock({
          blockchain,
          call: {
            to: "0x0000000000000000000000000000000000000004",
            api: fiduABI,
            method: "balanceOf",
            params: recipient,
            return: "0",
          },
        })
        mock({
          blockchain,
          call: {
            to: "0x0000000000000000000000000000000000000004",
            api: fiduABI,
            method: "allowance",
            params: [recipient, stakingRewards.address],
            return: "0",
          },
        })

        await act(async () => {
          fireEvent.click(await screen.getByText("Stake all FIDU"))
          expect(await screen.getByText("Submitting...")).toBeInTheDocument()

          // TODO[PR] Expect that `approve()` and `stake()` are being called correctly.
        })
      })
    })
    describe("with some FIDU already approved for transfer by StakingRewards", () => {
      it("clicking button triggers sending `approve()` then `stake()` transactions", async () => {
        // TODO[PR] Expect that `approve()` and `stake()` are being called correctly.
      })
    })
    describe("with all FIDU already approved for transfer by StakingRewards", () => {
      it("clicking button triggers sending `stake()` transactions", async () => {
        // TODO[PR] Expect that `approve()` was not called, and `stake()` was called correctly.
      })
    })
  })
})
