import {ApolloClient, ApolloProvider, NormalizedCacheObject} from "@apollo/client"
import {CreditDesk} from "./@types/legacy/CreditDesk"
import {GoldfinchConfig} from "@goldfinch-eng/protocol/typechain/web3/GoldfinchConfig"
import * as Sentry from "@sentry/react"
import React, {useEffect, useState} from "react"
import {BrowserRouter as Router, Redirect, Route, Switch} from "react-router-dom"
import {ThemeProvider} from "styled-components"
import Borrow from "./components/Borrow"
import DevTools from "./components/DevTools"
import Earn from "./components/Earn"
import Footer from "./components/footer"
import NetworkIndicators from "./components/networkIndicators"
import NotFound from "./components/NotFound"
import PrivacyPolicy from "./components/privacyPolicy"
import SeniorPoolView from "./components/SeniorPool"
import SeniorPoolAgreementNonUS from "./components/SeniorPool/seniorPoolAgreementNonUS"
import SeniorPoolAgreementUS from "./components/SeniorPool/seniorPoolAgreementUS"
import Sidebar from "./components/sidebar"
import TermsOfService from "./components/termsOfService"
import TranchedPoolView from "./components/TranchedPool"
import Transactions from "./components/transactions"
import VerifyIdentity from "./components/VerifyIdentity"
import {BorrowProvider} from "./contexts/BorrowContext"
import {EarnProvider} from "./contexts/EarnContext"
import {
  BackerMerkleDirectDistributor,
  BackerMerkleDirectDistributorLoaded,
} from "./ethereum/backerMerkleDirectDistributor"
import {BackerMerkleDistributor, BackerMerkleDistributorLoaded} from "./ethereum/backerMerkleDistributor"
import {BackerRewards, BackerRewardsLoaded} from "./ethereum/backerRewards"
import {CommunityRewards, CommunityRewardsLoaded} from "./ethereum/communityRewards"
import {ERC20, Ticker} from "./ethereum/erc20"
import {GFI, GFILoaded} from "./ethereum/gfi"
import {GoldfinchConfigData, refreshGoldfinchConfigData} from "./ethereum/goldfinchConfig"
import {GoldfinchProtocol} from "./ethereum/GoldfinchProtocol"
import {MerkleDirectDistributor, MerkleDirectDistributorLoaded} from "./ethereum/merkleDirectDistributor"
import {MerkleDistributor, MerkleDistributorLoaded} from "./ethereum/merkleDistributor"
import {NetworkMonitor} from "./ethereum/networkMonitor"
import {SeniorPool, SeniorPoolLoaded, StakingRewards, StakingRewardsLoaded, Zapper, ZapperLoaded} from "./ethereum/pool"
import {
  getUserData,
  UserBackerMerkleDirectDistributor,
  UserBackerMerkleDirectDistributorLoaded,
  UserBackerMerkleDistributor,
  UserBackerMerkleDistributorLoaded,
  UserCommunityRewards,
  UserCommunityRewardsLoaded,
  UserLoaded,
  UserMerkleDirectDistributor,
  UserMerkleDirectDistributorLoaded,
  UserMerkleDistributor,
  UserMerkleDistributorLoaded,
} from "./ethereum/user"
import getApolloClient from "./graphql/client"
import {MAINNET, mapNetworkToID, SUPPORTED_NETWORKS} from "./ethereum/utils"
import {useFromSameBlock} from "./hooks/useFromSameBlock"
import {UseGraphQuerierConfig} from "./hooks/useGraphQuerier"
import {useSessionLocalStorage} from "./hooks/useSignIn"
import Rewards from "./pages/rewards"
import {defaultTheme} from "./styles/theme"
import {assertWithLoadedInfo} from "./types/loadable"
import {NetworkConfig} from "./types/network"
import {
  ABOUT_ROUTE,
  AppRoute,
  BORROW_ROUTE,
  EARN_ROUTE,
  GFI_ROUTE,
  STAKE_ROUTE,
  INDEX_ROUTE,
  PRIVACY_POLICY_ROUTE,
  SENIOR_POOL_AGREEMENT_NON_US_ROUTE,
  SENIOR_POOL_AGREEMENT_US_ROUTE,
  SENIOR_POOL_ROUTE,
  TERMS_OF_SERVICE_ROUTE,
  TRANCHED_POOL_ROUTE,
  TRANSACTIONS_ROUTE,
  VERIFY_ROUTE,
} from "./types/routes"
import {SessionData} from "./types/session"
import {CurrentTx, TxType} from "./types/transactions"
import {UserWalletWeb3Status, Web3IO} from "./types/web3"
import {assertNonNullable, BlockInfo, getBlockInfo, getCurrentBlock, switchNetworkIfRequired} from "./utils"
import getWeb3, {getUserWalletWeb3Status, SESSION_DATA_KEY} from "./web3"
import Stake from "./components/Stake"

interface GeolocationData {
  ip: string
  city: string
  region: string
  country: string
  loc: string
  org: string
  postal: string
  timezone: string
}

export type SetSessionFn = (data: SessionData | undefined) => void

export type LeavesCurrentBlock = Record<AppRoute, BlockInfo | undefined>

export interface GlobalState {
  userWalletWeb3Status?: UserWalletWeb3Status

  // This tracks the latest block that the application knows about. Think of this as a
  // global or root-level piece of state; it applies to the entire application.
  currentBlock?: BlockInfo
  // This handler is for use whenever something has happened (e.g. the user took some action)
  // to which we want to react by refreshing chain data (and values derived thereof). Refreshing
  // the application's understanding of the current block is meant to be sufficient (i.e. it's
  // the developer's responsibility to accomplish this) to trigger cascading refreshing of the
  // data depended on by the mounted components in the component tree.
  refreshCurrentBlock?: () => Promise<void>
  // This tracks the latest block that the application knows about *at the respective leaf of the
  // component tree*, that is, which corresponds to the chain data being shown to the user on a
  // given route. Tracking this separately from `currentBlock` is useful because it enables us --
  // assuming the developer has implemented the necessary usage of `refreshCurrentBlock()` to trigger
  // refreshing, and of `setLeafCurrentBlock()` when the refresh has finished as far as a given
  // route is concerned -- to display an indicator in the UI that the chain data are being refreshed,
  // if the leaf's current block is lagging behind the `currentBlock`.
  leavesCurrentBlock?: LeavesCurrentBlock
  // This setter should be called when the "last" data dependency of a view has finished refreshing,
  // as defined by a change (increase) in the current block associated with that data dependency; the
  // setter should be called with that new current block. What is meant by "last"? It's the data
  // dependency that can be thought of being the closest to a leaf node of the component tree. The
  // point is that once it's done refreshing, we know that nothing else remains to be refreshed. In
  // practice, this means we'll want to call `setLeafCurrentBlock()` once per application route.
  setLeafCurrentBlock?: (route: AppRoute, leafCurrentBlock: BlockInfo) => void
  // Given that we supplement our use of web3 data with data from The Graph, and given that *we do not
  // pin our queries to The Graph to a particular block number*, we are not able to use only the `leavesCurrentBlock`
  // data structure to track whether the data we have on some leaf is lagging behind `currentBlock`. We're not able
  // to do so, because we have no guarantee about what block number the data we receive from The Graph will be for;
  // The Graph could lag behind our web3 provider's understanding of the current block (or in theory vice versa).
  // In using The Graph in this way, we are fundamentally accepting the possibility of
  // inconsistency-with-respect-to-block-number between the data we get from The Graph and the data we get from web3.
  // We accept this possibility on the ASSUMPTION that given what we actually use the data from The Graph for in
  // the UI, such inconsistency does not pose a UX problem. It's our responsibility to satisfy this assumption.
  //
  // Given that the block number we get for The Graph data after fetch / refresh may lag behind `currentBlock` (and
  // given that refreshing The Graph data indefinitely is not an acceptable mitigation), we can't incorporate
  // the block number of our query results from The Graph into `leavesCurrentBlock`. So we use a separate data
  // structure, to track (for a leaf of the component tree) what was the value of `currentBlock` that triggered
  // the last successful refresh of The Graph data. In effect, we use this value as an identifier of our refreshes
  // of The Graph data. When the value becomes equal to `currentBlock`, we know we're done refreshing The Graph
  // data for that leaf.
  leavesCurrentBlockTriggeringLastSuccessfulGraphRefresh?: LeavesCurrentBlock
  setLeafCurrentBlockTriggeringLastSuccessfulGraphRefresh?: (
    route: AppRoute,
    currentBlockTriggeringLastSuccessfulGraphRefresh: BlockInfo
  ) => void

  gfi?: GFILoaded
  stakingRewards?: StakingRewardsLoaded
  zapper?: ZapperLoaded
  communityRewards?: CommunityRewardsLoaded
  merkleDistributor?: MerkleDistributorLoaded
  merkleDirectDistributor?: MerkleDirectDistributorLoaded
  backerMerkleDistributor?: BackerMerkleDistributorLoaded
  backerMerkleDirectDistributor?: BackerMerkleDirectDistributorLoaded
  userMerkleDistributor?: UserMerkleDistributorLoaded
  userMerkleDirectDistributor?: UserMerkleDirectDistributorLoaded
  userCommunityRewards?: UserCommunityRewardsLoaded
  userBackerMerkleDirectDistributor?: UserBackerMerkleDirectDistributorLoaded
  userBackerMerkleDistributor?: UserBackerMerkleDistributorLoaded
  backerRewards?: BackerRewardsLoaded
  pool?: SeniorPoolLoaded
  creditDesk?: Web3IO<CreditDesk>
  user?: UserLoaded
  usdc?: ERC20
  goldfinchConfig?: GoldfinchConfigData
  goldfinchProtocol?: GoldfinchProtocol

  network?: NetworkConfig
  networkMonitor?: NetworkMonitor

  geolocationData?: GeolocationData
  setGeolocationData?: (geolocationData: GeolocationData) => void

  sessionData?: SessionData
  setSessionData?: SetSessionFn
  hasGraphError?: boolean
  setHasGraphError?: (value: boolean) => void
}

declare let window: any

const AppContext = React.createContext<GlobalState>({})

const earnProviderGraphQuerierConfig: UseGraphQuerierConfig = {
  route: EARN_ROUTE,
  setAsLeaf: true,
}

function App() {
  const [userWalletWeb3Status, setUserWalletWeb3Status] = useState<UserWalletWeb3Status>()
  const [_gfi, setGfi] = useState<GFILoaded>()
  const [_stakingRewards, setStakingRewards] = useState<StakingRewardsLoaded>()
  const [_zapper, setZapper] = useState<ZapperLoaded>()
  const [_communityRewards, setCommunityRewards] = useState<CommunityRewardsLoaded>()
  const [_merkleDistributor, setMerkleDistributor] = useState<MerkleDistributorLoaded>()
  const [_merkleDirectDistributor, setMerkleDirectDistributor] = useState<MerkleDirectDistributorLoaded>()
  const [_backerRewards, setBackerRewards] = useState<BackerRewardsLoaded>()
  const [_backerMerkleDistributor, setBackerMerkleDistributor] = useState<BackerMerkleDistributorLoaded>()
  const [_backerMerkleDirectDistributor, setBackerMerkleDirectDistributor] =
    useState<BackerMerkleDirectDistributorLoaded>()
  const [pool, setPool] = useState<SeniorPoolLoaded>()
  const [creditDesk, setCreditDesk] = useState<Web3IO<CreditDesk>>()
  const [userMerkleDistributor, setUserMerkleDistributor] = useState<UserMerkleDistributorLoaded>()
  const [userMerkleDirectDistributor, setUserMerkleDirectDistributor] = useState<UserMerkleDirectDistributorLoaded>()
  const [userBackerMerkleDistributor, setUserBackerMerkleDistributor] = useState<UserBackerMerkleDistributorLoaded>()
  const [userBackerMerkleDirectDistributor, setUserBackerMerkleDirectDistributor] =
    useState<UserBackerMerkleDirectDistributorLoaded>()
  const [userCommunityRewards, setUserCommunityRewards] = useState<UserCommunityRewardsLoaded>()
  const [usdc, setUSDC] = useState<ERC20>()
  const [overrideAddress, setOverrideAdress] = useState<string>()
  const [user, setUser] = useState<UserLoaded>()
  const [currentBlock, setCurrentBlock] = useState<BlockInfo>()
  const [leavesCurrentBlock, setLeavesCurrentBlock] = useState<LeavesCurrentBlock>({
    [INDEX_ROUTE]: undefined,
    [EARN_ROUTE]: undefined,
    [STAKE_ROUTE]: undefined,
    [ABOUT_ROUTE]: undefined,
    [GFI_ROUTE]: undefined,
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
  const [
    leavesCurrentBlockTriggeringLastSuccessfulGraphRefresh,
    setLeavesCurrentBlockTriggeringLastSuccessfulGraphRefresh,
  ] = useState<LeavesCurrentBlock>({
    [INDEX_ROUTE]: undefined,
    [EARN_ROUTE]: undefined,
    [STAKE_ROUTE]: undefined,
    [ABOUT_ROUTE]: undefined,
    [GFI_ROUTE]: undefined,
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
  const [goldfinchConfig, setGoldfinchConfig] = useState<GoldfinchConfigData>()
  const [currentTxs, setCurrentTxs] = useState<CurrentTx<TxType>[]>([])
  const [currentErrors, setCurrentErrors] = useState<any[]>([])
  const [network, setNetwork] = useState<NetworkConfig>()
  const [networkMonitor, setNetworkMonitor] = useState<NetworkMonitor>()
  const [goldfinchProtocol, setGoldfinchProtocol] = useState<GoldfinchProtocol>()
  const [geolocationData, setGeolocationData] = useState<GeolocationData>()
  const {localStorageValue: sessionData, setLocalStorageValue: setSessionData} = useSessionLocalStorage(
    SESSION_DATA_KEY,
    {},
    currentBlock?.timestamp
  )
  const consistent = useFromSameBlock(
    {setAsLeaf: false},
    currentBlock,
    _gfi,
    _stakingRewards,
    _communityRewards,
    _merkleDistributor,
    _merkleDirectDistributor,
    _backerMerkleDistributor,
    _backerMerkleDirectDistributor,
    _backerRewards,
    _zapper
  )
  const gfi = consistent?.[0]
  const stakingRewards = consistent?.[1]
  const communityRewards = consistent?.[2]
  const merkleDistributor = consistent?.[3]
  const merkleDirectDistributor = consistent?.[4]
  const backerMerkleDistributor = consistent?.[5]
  const backerMerkleDirectDistributor = consistent?.[6]
  const backerRewards = consistent?.[7]
  const zapper = consistent?.[8]

  // To ensure `gfi`, `stakingRewards`, `communityRewards`, `merkleDistributor`,
  // `merkleDirectDistributor`, `backerMerkleDistributor`, `backerMerkleDirectDistributor`
  // `backerRewards`, and `pool` are from the same block, we'd use `useFromSameBlock()`
  // again here. But holding off on that due to the decision to abandon
  // https://github.com/warbler-labs/mono/pull/140.

  const [apolloClient, setApolloClient] = useState<ApolloClient<NormalizedCacheObject>>(getApolloClient(undefined))
  const [hasGraphError, setHasGraphError] = useState<boolean>(false)

  useEffect(() => {
    setupUserWalletWeb3()

    // Admin function to be able to assume the role of any address
    window.setUserAddress = function (overrideAddress: string) {
      setOverrideAdress(overrideAddress)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    setApolloClient(getApolloClient(network))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [network])

  useEffect(() => {
    if (goldfinchProtocol && currentBlock) {
      refreshGfiAndRewards()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goldfinchProtocol, currentBlock])

  useEffect(() => {
    if (goldfinchProtocol && stakingRewards && gfi && currentBlock) {
      refreshPool()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stakingRewards, gfi])

  useEffect(() => {
    if (
      goldfinchProtocol &&
      communityRewards &&
      merkleDistributor &&
      merkleDirectDistributor &&
      backerMerkleDistributor &&
      backerMerkleDirectDistributor &&
      userWalletWeb3Status &&
      userWalletWeb3Status.type === "connected" &&
      currentBlock
    ) {
      refreshUserMerkleAndCommunityRewardsInfo(userWalletWeb3Status.address, overrideAddress)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    communityRewards,
    merkleDistributor,
    merkleDirectDistributor,
    backerMerkleDistributor,
    backerMerkleDirectDistributor,
    userWalletWeb3Status?.address,
    overrideAddress,
  ])

  useEffect(() => {
    if (
      goldfinchProtocol &&
      pool &&
      creditDesk &&
      network &&
      stakingRewards &&
      zapper &&
      gfi &&
      communityRewards &&
      merkleDistributor &&
      merkleDirectDistributor &&
      backerMerkleDistributor &&
      backerMerkleDirectDistributor &&
      userWalletWeb3Status &&
      userWalletWeb3Status.type === "connected" &&
      currentBlock
    ) {
      refreshUserData(userWalletWeb3Status.address, overrideAddress)
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usdc, pool, userWalletWeb3Status?.address, overrideAddress])

  // To ensure the data dependencies of `user` *and* `user` itself are from the same block,
  // we'd use `useFromSameBlock()` again here. But holding off on that due to the decision to abandon
  // https://github.com/warbler-labs/mono/pull/140.

  async function setupUserWalletWeb3() {
    const _userWalletWeb3Status = await getUserWalletWeb3Status()
    setUserWalletWeb3Status(_userWalletWeb3Status)
    if (_userWalletWeb3Status.type === "no_web3") {
      // Initialize the chain state the app needs even when the user has no wallet.

      const currentBlock = getBlockInfo(await getCurrentBlock())

      const networkConfig: NetworkConfig = {name: MAINNET, supported: true}
      const protocol = new GoldfinchProtocol(networkConfig)
      await protocol.initialize()

      setCurrentBlock(currentBlock)
      setGoldfinchProtocol(protocol)

      return
    }

    const networkId = mapNetworkToID[_userWalletWeb3Status.networkName] || _userWalletWeb3Status.networkName
    const name = networkId
    const supported = SUPPORTED_NETWORKS[networkId] || false
    const networkConfig: NetworkConfig = {name, supported}
    setNetwork(networkConfig)

    switchNetworkIfRequired(networkConfig)

    if (networkConfig.supported) {
      const web3 = getWeb3()
      const currentBlock = getBlockInfo(await getCurrentBlock())

      const protocol = new GoldfinchProtocol(networkConfig)
      await protocol.initialize()

      const usdc = await protocol.getERC20(Ticker.USDC)

      const goldfinchConfigContract = protocol.getContract<GoldfinchConfig>("GoldfinchConfig")
      const goldfinchConfigData = await refreshGoldfinchConfigData(goldfinchConfigContract, currentBlock)

      const creditDeskContract = protocol.getContract<CreditDesk>("CreditDesk", undefined, true)

      setCurrentBlock(currentBlock)
      setUSDC(usdc)
      setCreditDesk(creditDeskContract)
      setGoldfinchConfig(goldfinchConfigData)
      setGoldfinchProtocol(protocol)

      const monitor = new NetworkMonitor(web3.userWallet, {
        setCurrentTxs,
        setCurrentErrors,
      })
      monitor.initialize(currentBlock) // initialize async, no need to block on this
      setNetworkMonitor(monitor)
    }
  }

  async function refreshGfiAndRewards(): Promise<void> {
    assertNonNullable(goldfinchProtocol)
    assertNonNullable(currentBlock)

    const gfi = new GFI(goldfinchProtocol)
    const stakingRewards = new StakingRewards(goldfinchProtocol)
    const communityRewards = new CommunityRewards(goldfinchProtocol)
    const merkleDistributor = new MerkleDistributor(goldfinchProtocol)
    const merkleDirectDistributor = new MerkleDirectDistributor(goldfinchProtocol)
    const backerMerkleDistributor = new BackerMerkleDistributor(goldfinchProtocol)
    const backerMerkleDirectDistributor = new BackerMerkleDirectDistributor(goldfinchProtocol)
    const backerRewards = new BackerRewards(goldfinchProtocol)
    const zapper = new Zapper(goldfinchProtocol)

    await Promise.all([
      gfi.initialize(currentBlock),
      stakingRewards.initialize(currentBlock),
      communityRewards.initialize(currentBlock),
      merkleDistributor.initialize(currentBlock),
      merkleDirectDistributor.initialize(currentBlock),
      backerMerkleDistributor.initialize(currentBlock),
      backerMerkleDirectDistributor.initialize(currentBlock),
      backerRewards.initialize(currentBlock),
      zapper.initialize(currentBlock),
    ])

    assertWithLoadedInfo(gfi)
    assertWithLoadedInfo(stakingRewards)
    assertWithLoadedInfo(communityRewards)
    assertWithLoadedInfo(merkleDistributor)
    assertWithLoadedInfo(merkleDirectDistributor)
    assertWithLoadedInfo(backerMerkleDistributor)
    assertWithLoadedInfo(backerMerkleDirectDistributor)
    assertWithLoadedInfo(backerRewards)
    assertWithLoadedInfo(zapper)

    setGfi(gfi)
    setStakingRewards(stakingRewards)
    setCommunityRewards(communityRewards)
    setMerkleDistributor(merkleDistributor)
    setMerkleDirectDistributor(merkleDirectDistributor)
    setBackerMerkleDistributor(backerMerkleDistributor)
    setBackerMerkleDirectDistributor(backerMerkleDirectDistributor)
    setBackerRewards(backerRewards)
    setZapper(zapper)
  }

  async function refreshPool(): Promise<void> {
    assertNonNullable(goldfinchProtocol)
    assertNonNullable(currentBlock)
    assertNonNullable(stakingRewards)
    assertNonNullable(gfi)

    const pool = new SeniorPool(goldfinchProtocol)
    await pool.initialize(stakingRewards, gfi, currentBlock)
    assertWithLoadedInfo(pool)

    setPool(pool)
  }

  async function refreshUserMerkleAndCommunityRewardsInfo(
    userAddress: string,
    overrideAddress: string | undefined
  ): Promise<void> {
    assertNonNullable(goldfinchProtocol)
    assertNonNullable(currentBlock)
    assertNonNullable(communityRewards)
    assertNonNullable(merkleDistributor)
    assertNonNullable(merkleDirectDistributor)
    assertNonNullable(backerMerkleDistributor)
    assertNonNullable(backerMerkleDirectDistributor)

    const address = overrideAddress || userAddress

    const userMerkleDistributor = new UserMerkleDistributor(address, goldfinchProtocol)
    const userMerkleDirectDistributor = new UserMerkleDirectDistributor(address, goldfinchProtocol)
    const userBackerMerkleDistributor = new UserBackerMerkleDistributor(address, goldfinchProtocol)
    const userBackerMerkleDirectDistributor = new UserBackerMerkleDirectDistributor(address, goldfinchProtocol)
    await Promise.all([
      userMerkleDistributor.initialize(merkleDistributor, communityRewards, currentBlock),
      userMerkleDirectDistributor.initialize(merkleDirectDistributor, currentBlock),
      userBackerMerkleDistributor.initialize(backerMerkleDistributor, communityRewards, currentBlock),
      userBackerMerkleDirectDistributor.initialize(backerMerkleDirectDistributor, currentBlock),
    ])
    assertWithLoadedInfo(userMerkleDistributor)
    assertWithLoadedInfo(userMerkleDirectDistributor)
    assertWithLoadedInfo(userBackerMerkleDistributor)
    assertWithLoadedInfo(userBackerMerkleDirectDistributor)

    const userCommunityRewards = new UserCommunityRewards(address, goldfinchProtocol)
    await userCommunityRewards.initialize(
      communityRewards,
      merkleDistributor,
      backerMerkleDistributor,
      userMerkleDistributor,
      userBackerMerkleDistributor,
      currentBlock
    )
    assertWithLoadedInfo(userCommunityRewards)

    setUserMerkleDistributor(userMerkleDistributor)
    setUserMerkleDirectDistributor(userMerkleDirectDistributor)
    setUserCommunityRewards(userCommunityRewards)
    setUserBackerMerkleDistributor(userBackerMerkleDistributor)
    setUserBackerMerkleDirectDistributor(userBackerMerkleDirectDistributor)
  }

  async function refreshUserData(userAddress: string, overrideAddress: string | undefined): Promise<void> {
    assertNonNullable(goldfinchProtocol)
    assertNonNullable(pool)
    assertNonNullable(creditDesk)
    assertNonNullable(network)
    assertNonNullable(currentBlock)
    assertNonNullable(stakingRewards)
    assertNonNullable(gfi)
    assertNonNullable(communityRewards)
    assertNonNullable(merkleDistributor)
    assertNonNullable(merkleDirectDistributor)
    assertNonNullable(backerMerkleDistributor)
    assertNonNullable(backerMerkleDirectDistributor)

    const address = overrideAddress || userAddress
    const user = await getUserData(
      address,
      goldfinchProtocol,
      pool,
      creditDesk,
      network.name,
      stakingRewards,
      gfi,
      communityRewards,
      merkleDistributor,
      merkleDirectDistributor,
      backerMerkleDistributor,
      backerMerkleDirectDistributor,
      currentBlock
    )
    Sentry.setUser({
      // NOTE: The info we use here to identify / define the user for the purpose of
      // error tracking with Sentry MUST be kept consistent with (i.e. not exceed
      // the bounds set by) what our Terms of Service, Privacy Policy, and marketing
      // copy state about the identifying information that Goldfinch stores.
      id: user.address,
      address: user.address,
      isOverrideOf: overrideAddress ? userAddress : undefined,
    })

    setUser(user)
  }

  async function refreshCurrentBlock(): Promise<void> {
    const currentBlock = getBlockInfo(await getCurrentBlock())
    setCurrentBlock(currentBlock)
  }

  function setLeafCurrentBlock(route: AppRoute, newLeafCurrentBlock: BlockInfo) {
    setLeavesCurrentBlock(
      // NOTE: We must use the functional approach to updating state here (cf.
      // https://reactjs.org/docs/hooks-reference.html#functional-updates), because
      // otherwise `setLeavesCurrentBlock` returned by `useState` will not necessarily
      // merge the new state object into the existing state object (instead it may
      // replace the object entirely -- which is problematic for two synchronous calls
      // of `setLeafCurrentBlock()`, as they're liable to clobber each other).
      (prevState) => {
        const existing = prevState[route]
        if (!existing || existing.number < newLeafCurrentBlock.number) {
          return {...prevState, [route]: newLeafCurrentBlock}
        }
        return prevState
      }
    )
  }

  function setLeafCurrentBlockTriggeringLastSuccessfulGraphRefresh(
    route: AppRoute,
    newCurrentBlockTriggeringLastSuccessfulGraphRefresh: BlockInfo
  ) {
    setLeavesCurrentBlockTriggeringLastSuccessfulGraphRefresh((prevState) => {
      const existing = prevState[route]
      if (!existing || existing.number < newCurrentBlockTriggeringLastSuccessfulGraphRefresh.number) {
        return {
          ...prevState,
          [route]: newCurrentBlockTriggeringLastSuccessfulGraphRefresh,
        }
      }
      return prevState
    })
  }

  const store: GlobalState = {
    userWalletWeb3Status,
    currentBlock,
    leavesCurrentBlock,
    leavesCurrentBlockTriggeringLastSuccessfulGraphRefresh,
    stakingRewards,
    gfi,
    communityRewards,
    merkleDistributor,
    merkleDirectDistributor,
    backerMerkleDistributor,
    backerMerkleDirectDistributor,
    backerRewards,
    zapper,
    pool,
    creditDesk,
    user,
    userMerkleDistributor,
    userMerkleDirectDistributor,
    userCommunityRewards,
    userBackerMerkleDirectDistributor,
    userBackerMerkleDistributor,
    usdc,
    goldfinchConfig,
    network,
    networkMonitor,
    goldfinchProtocol,
    geolocationData,
    setGeolocationData,
    sessionData,
    setSessionData,
    refreshCurrentBlock,
    setLeafCurrentBlock,
    setLeafCurrentBlockTriggeringLastSuccessfulGraphRefresh,
    hasGraphError,
    setHasGraphError,
  }

  return (
    <ApolloProvider client={apolloClient}>
      <AppContext.Provider value={store}>
        <ThemeProvider theme={defaultTheme}>
          <Router>
            <EarnProvider graphQuerierConfig={earnProviderGraphQuerierConfig}>
              <BorrowProvider>
                <NetworkIndicators
                  user={user}
                  network={network}
                  currentErrors={currentErrors}
                  currentTxs={currentTxs}
                  connectionComplete={setupUserWalletWeb3}
                  rootCurrentBlock={currentBlock}
                  leavesCurrentBlock={leavesCurrentBlock}
                  leavesCurrentBlockTriggeringLastSuccessfulGraphRefresh={
                    leavesCurrentBlockTriggeringLastSuccessfulGraphRefresh
                  }
                  hasGraphError={hasGraphError}
                />
                {(process.env.NODE_ENV === "development" || process.env.MURMURATION === "yes") && <DevTools />}
                <Sidebar />
                <div>
                  <Switch>
                    <Route exact path={INDEX_ROUTE}>
                      <Redirect to={EARN_ROUTE} />
                    </Route>
                    <Route path={ABOUT_ROUTE}>{/* <About /> */}</Route>
                    <Route path={EARN_ROUTE}>
                      <Earn />
                    </Route>
                    <Route path={STAKE_ROUTE}>
                      <Stake />
                    </Route>
                    <Route path={GFI_ROUTE}>
                      <Rewards />
                    </Route>
                    <Route path={BORROW_ROUTE}>
                      <Borrow />
                    </Route>
                    <Route path={TRANSACTIONS_ROUTE}>
                      <Transactions currentTxs={currentTxs} />
                    </Route>
                    <Route path={SENIOR_POOL_ROUTE}>
                      <SeniorPoolView />
                    </Route>
                    <Route path={TRANCHED_POOL_ROUTE}>
                      <TranchedPoolView />
                    </Route>
                    <Route path={VERIFY_ROUTE}>
                      <VerifyIdentity />
                    </Route>
                    <Route path={TERMS_OF_SERVICE_ROUTE}>
                      <TermsOfService />
                    </Route>
                    <Route path={PRIVACY_POLICY_ROUTE}>
                      <PrivacyPolicy />
                    </Route>
                    <Route path={SENIOR_POOL_AGREEMENT_NON_US_ROUTE}>
                      <SeniorPoolAgreementNonUS />
                    </Route>
                    <Route path={SENIOR_POOL_AGREEMENT_US_ROUTE}>
                      <SeniorPoolAgreementUS />
                    </Route>
                    <Route path="*">
                      <NotFound />
                    </Route>
                  </Switch>
                </div>
              </BorrowProvider>
            </EarnProvider>
          </Router>
          <Footer />
        </ThemeProvider>
      </AppContext.Provider>
    </ApolloProvider>
  )
}

export {App, AppContext}
export type {GeolocationData}
