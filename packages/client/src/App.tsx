import React, {useState, useEffect} from "react"
import {BrowserRouter as Router, Switch, Route, Redirect} from "react-router-dom"
import * as Sentry from "@sentry/react"
import Borrow from "./components/borrow.js"
import Earn from "./components/earn"
import Transactions from "./components/transactions.js"
import NetworkWidget from "./components/networkWidget"
import Sidebar from "./components/sidebar"
import DevTools from "./components/devTools"
import TermsOfService from "./components/termsOfService.js"
import PrivacyPolicy from "./components/privacyPolicy.js"
import SeniorPoolAgreementNonUS from "./components/seniorPoolAgreementNonUS"
import web3 from "./web3"
import {ERC20, Tickers} from "./ethereum/erc20"
import {refreshGoldfinchConfigData} from "./ethereum/goldfinchConfig"
import {getUserData, defaultUser, User} from "./ethereum/user"
import {mapNetworkToID, SUPPORTED_NETWORKS} from "./ethereum/utils"
import {NetworkMonitor} from "./ethereum/networkMonitor"
import {SeniorPool} from "./ethereum/pool"
import {GoldfinchProtocol} from "./ethereum/GoldfinchProtocol"
import {GoldfinchConfig} from "@goldfinch-eng/protocol/typechain/web3/GoldfinchConfig"
import SeniorPoolView from "./components/pools/seniorPoolView"
import VerifyIdentity from "./components/verifyIdentity"
import TranchedPoolView from "./components/pools/tranchedPoolView"
import {SessionData} from "./types/session.js"
import {CommunityRewards, MerkleDistributor} from "./ethereum/communityRewards"
import Rewards from "./pages/rewards"

export interface NetworkConfig {
  name?: string
  supported?: any
}

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

export interface GlobalState {
  pool?: SeniorPool
  creditDesk?: any
  user: User
  usdc?: ERC20
  goldfinchConfig?: any
  network?: NetworkConfig
  goldfinchProtocol?: GoldfinchProtocol
  networkMonitor?: NetworkMonitor
  refreshUserData?: (overrideAddress?: string) => void
  geolocationData?: GeolocationData
  setGeolocationData?: (geolocationData: GeolocationData) => void
  sessionData?: SessionData
  setSessionData?: (data: SessionData | undefined) => void
  communityRewards?: CommunityRewards
  merkleDistributor?: MerkleDistributor
}

declare let window: any

const AppContext = React.createContext<GlobalState>({user: defaultUser()})

function App() {
  const [pool, setPool] = useState<SeniorPool>()
  const [creditDesk, setCreditDesk] = useState<any>({})
  const [usdc, setUSDC] = useState<ERC20>()
  const [user, setUser] = useState<User>(defaultUser())
  const [goldfinchConfig, setGoldfinchConfig] = useState({})
  const [currentTXs, setCurrentTXs] = useState<any[]>([])
  const [currentErrors, setCurrentErrors] = useState<any[]>([])
  const [network, setNetwork] = useState<NetworkConfig>({})
  const [networkMonitor, setNetworkMonitor] = useState<NetworkMonitor>()
  const [goldfinchProtocol, setGoldfinchProtocol] = useState<GoldfinchProtocol>()
  const [geolocationData, setGeolocationData] = useState<GeolocationData>()
  const [sessionData, setSessionData] = useState<SessionData>()
  const [merkleDistributor, setMerkleDistributor] = useState<MerkleDistributor>()
  const [communityRewards, setCommunityRewards] = useState<CommunityRewards>()

  const toggleRewards = process.env.REACT_APP_TOGGLE_REWARDS === "true"

  useEffect(() => {
    setupWeb3()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    refreshUserData()
    // Admin function to be able to assume the role of any address
    window.setUserAddress = function (overrideAddress: string) {
      refreshUserData(overrideAddress)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usdc, pool, creditDesk, network, goldfinchProtocol])

  async function ensureWeb3() {
    if (!window.ethereum) {
      return false
    }
    try {
      // Sometimes it's possible that we can't communicate with the provider, in which case
      // treat as if we don't have web3
      await web3.eth.net.getNetworkType()
    } catch (e) {
      return false
    }
    return true
  }

  async function setupWeb3() {
    if (!(await ensureWeb3())) {
      return
    }

    const networkName = await web3.eth.net.getNetworkType()
    const networkId = mapNetworkToID[networkName] || networkName
    const networkConfig: NetworkConfig = {name: networkId, supported: SUPPORTED_NETWORKS[networkId]}
    setNetwork(networkConfig)
    if (networkConfig.supported) {
      const protocol = new GoldfinchProtocol(networkConfig)
      await protocol.initialize()

      const usdc = await protocol.getERC20(Tickers.USDC)

      const pool = new SeniorPool(protocol)
      await pool.initialize()

      const goldfinchConfigContract = protocol.getContract<GoldfinchConfig>("GoldfinchConfig")
      const creditDeskContract = protocol.getContract("CreditDesk")
      setUSDC(usdc)
      setPool(pool)
      setCreditDesk(creditDeskContract)
      setGoldfinchConfig(await refreshGoldfinchConfigData(goldfinchConfigContract))
      setGoldfinchProtocol(protocol)

      const communityRewards = new CommunityRewards(protocol)
      communityRewards.initialize() // initialize async, no need to block on this
      setCommunityRewards(communityRewards)
      const merkleDistributor = new MerkleDistributor(protocol)
      merkleDistributor.initialize() // initialize async, no need to block on this
      setMerkleDistributor(merkleDistributor)

      const monitor = new NetworkMonitor(web3, {
        setCurrentTXs,
        setCurrentErrors,
      })
      monitor.initialize() // initialize async, no need to block on this
      setNetworkMonitor(monitor)
    }
  }

  async function refreshUserData(overrideAddress?: string) {
    if (!(await ensureWeb3())) {
      return
    }

    let data: User = defaultUser()
    const accounts = await web3.eth.getAccounts()
    data.web3Connected = true
    const _userAddress = (accounts && accounts[0]) || user.address
    const userAddress = overrideAddress || _userAddress
    if (userAddress) {
      data.address = userAddress
    }
    if (userAddress && goldfinchProtocol && creditDesk.loaded && pool?.loaded) {
      data = await getUserData(userAddress, goldfinchProtocol, pool, creditDesk, network.name)
    }

    Sentry.setUser({
      // NOTE: The info we use here to identify / define the user for the purpose of
      // error tracking with Sentry MUST be kept consistent with (i.e. not exceed
      // the bounds set by) what our Terms of Service, Privacy Policy, and marketing
      // copy state about the identifying information that Goldfinch stores.
      id: data.address,
      address: data.address,
      isOverrideOf: overrideAddress ? _userAddress : undefined,
    })

    setUser(data)
  }

  const store: GlobalState = {
    pool,
    creditDesk,
    user,
    usdc,
    goldfinchConfig,
    network,
    networkMonitor,
    refreshUserData,
    goldfinchProtocol,
    geolocationData,
    setGeolocationData,
    sessionData,
    setSessionData,
    communityRewards,
    merkleDistributor,
  }

  return (
    <AppContext.Provider value={store}>
      <Router>
        {(process.env.NODE_ENV === "development" || process.env.MURMURATION === "yes") && <DevTools />}
        <Sidebar />
        <NetworkWidget
          user={user}
          network={network}
          currentErrors={currentErrors}
          currentTXs={currentTXs}
          connectionComplete={setupWeb3}
        />
        <div>
          <Switch>
            <Route exact path="/">
              <Redirect to="/earn" />
            </Route>
            <Route path="/about">{/* <About /> */}</Route>
            <Route path="/borrow">
              <Borrow />
            </Route>
            <Route path="/pools/senior">
              <SeniorPoolView />
            </Route>
            <Route path="/pools/:poolAddress">
              <TranchedPoolView />
            </Route>
            <Route path="/earn">
              <Earn />
            </Route>
            {toggleRewards && (
              <Route path="/rewards">
                <Rewards />
              </Route>
            )}
            <Route path="/transactions">
              <Transactions currentTXs={currentTXs} />
            </Route>
            <Route path="/verify">
              <VerifyIdentity />
            </Route>
            <Route path="/terms">
              <TermsOfService />
            </Route>
            <Route path="/privacy">
              <PrivacyPolicy />
            </Route>
            <Route path="/senior-pool-agreement-non-us">
              <SeniorPoolAgreementNonUS />
            </Route>
          </Switch>
        </div>
        <footer>
          <a href="/terms">Terms</a>
          <span className="divider">•</span>
          <a href="/privacy">Privacy</a>
        </footer>
      </Router>
    </AppContext.Provider>
  )
}

export {App, AppContext}
export type {GeolocationData}
