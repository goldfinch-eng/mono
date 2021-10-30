import React, {useState, useEffect} from "react"
import {BrowserRouter as Router, Switch, Route, Redirect} from "react-router-dom"
import * as Sentry from "@sentry/react"
import Borrow from "./components/borrow"
import Earn from "./components/earn"
import Transactions from "./components/transactions"
import NetworkWidget from "./components/networkWidget"
import Sidebar from "./components/sidebar"
import DevTools from "./components/devTools"
import Footer from "./components/footer"
import TermsOfService from "./components/termsOfService"
import PrivacyPolicy from "./components/privacyPolicy"
import SeniorPoolAgreementNonUS from "./components/seniorPoolAgreementNonUS"
import web3, {SESSION_DATA_KEY} from "./web3"
import {ERC20, Tickers} from "./ethereum/erc20"
import {refreshGoldfinchConfigData} from "./ethereum/goldfinchConfig"
import {getUserData, defaultUser, User} from "./ethereum/user"
import {mapNetworkToID, SUPPORTED_NETWORKS} from "./ethereum/utils"
import {NetworkMonitor} from "./ethereum/networkMonitor"
import {SeniorPool, SeniorPoolLoaded} from "./ethereum/pool"
import {GoldfinchProtocol} from "./ethereum/GoldfinchProtocol"
import {GoldfinchConfig} from "@goldfinch-eng/protocol/typechain/web3/GoldfinchConfig"
import {CreditDesk} from "@goldfinch-eng/protocol/typechain/web3/CreditDesk"
import SeniorPoolView from "./components/pools/seniorPoolView"
import VerifyIdentity from "./components/verifyIdentity"
import TranchedPoolView from "./components/pools/tranchedPoolView"
import Rewards from "./pages/rewards"
import {ThemeProvider} from "styled-components"
import {defaultTheme} from "./styles/theme"
import {SessionData} from "./types/session"
import {useSessionLocalStorage} from "./hooks/useSignIn"
import {EarnProvider} from "./contexts/EarnContext"
import {BorrowProvider} from "./contexts/BorrowContext"
import {assertWithLoadedInfo} from "./types/loadable"
import {assertNonNullable, BlockInfo, getBlockInfo, getCurrentBlock} from "./utils"

export interface NetworkConfig {
  name: string
  supported: boolean
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
  currentBlock?: BlockInfo
  pool?: SeniorPoolLoaded
  creditDesk?: CreditDesk
  user: User
  usdc?: ERC20
  goldfinchConfig?: any
  network?: NetworkConfig
  goldfinchProtocol?: GoldfinchProtocol
  networkMonitor?: NetworkMonitor
  geolocationData?: GeolocationData
  setGeolocationData?: (geolocationData: GeolocationData) => void
  sessionData?: SessionData
  setSessionData?: (data: SessionData | undefined) => void
  refreshCurrentBlock?: () => Promise<void>
}

declare let window: any

const AppContext = React.createContext<GlobalState>({user: defaultUser()})

function App() {
  const [pool, setPool] = useState<SeniorPoolLoaded>()
  const [creditDesk, setCreditDesk] = useState<CreditDesk>()
  const [usdc, setUSDC] = useState<ERC20>()
  const [overrideAddress, setOverrideAdress] = useState<string>()
  const [user, setUser] = useState<User>(defaultUser())
  const [currentBlock, setCurrentBlock] = useState<BlockInfo>()
  const [goldfinchConfig, setGoldfinchConfig] = useState({})
  const [currentTXs, setCurrentTXs] = useState<any[]>([])
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

  const toggleRewards = process.env.REACT_APP_TOGGLE_REWARDS === "true"

  useEffect(() => {
    setupWeb3()

    // Admin function to be able to assume the role of any address
    window.setUserAddress = function (overrideAddress: string) {
      setOverrideAdress(overrideAddress)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (goldfinchProtocol && currentBlock) {
      refreshPool()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goldfinchProtocol, currentBlock])

  useEffect(() => {
    if (goldfinchProtocol && pool && creditDesk && network) {
      refreshUserData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goldfinchProtocol, usdc, pool, creditDesk, network, overrideAddress])

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
    const name = networkId
    const supported = SUPPORTED_NETWORKS[networkId] || false
    const networkConfig: NetworkConfig = {name, supported}
    setNetwork(networkConfig)
    if (networkConfig.supported) {
      const currentBlock = getBlockInfo(await getCurrentBlock())

      const protocol = new GoldfinchProtocol(networkConfig)
      await protocol.initialize()

      const usdc = await protocol.getERC20(Tickers.USDC)

      const goldfinchConfigContract = protocol.getContract<GoldfinchConfig>("GoldfinchConfig")
      const goldfinchConfigData = await refreshGoldfinchConfigData(goldfinchConfigContract, currentBlock)

      const creditDeskContract = protocol.getContract<CreditDesk>("CreditDesk")

      setCurrentBlock(currentBlock)
      setUSDC(usdc)
      setCreditDesk(creditDeskContract)
      setGoldfinchConfig(goldfinchConfigData)
      setGoldfinchProtocol(protocol)

      const monitor = new NetworkMonitor(web3, {
        setCurrentTXs,
        setCurrentErrors,
      })
      monitor.initialize(currentBlock) // initialize async, no need to block on this
      setNetworkMonitor(monitor)
    }
  }

  async function refreshPool(): Promise<void> {
    if (!(await ensureWeb3())) {
      return
    }

    assertNonNullable(goldfinchProtocol)
    assertNonNullable(currentBlock)

    const pool = new SeniorPool(goldfinchProtocol)
    await pool.initialize(currentBlock)
    assertWithLoadedInfo(pool)
    setPool(pool)
  }

  async function refreshUserData(): Promise<void> {
    if (!(await ensureWeb3())) {
      return
    }

    assertNonNullable(goldfinchProtocol)
    assertNonNullable(pool)
    assertNonNullable(creditDesk)
    assertNonNullable(network)
    assertNonNullable(currentBlock)

    let data: User = defaultUser()
    const accounts = await web3.eth.getAccounts()
    data.web3Connected = true
    const _userAddress = (accounts && accounts[0]) || user.address
    const userAddress = overrideAddress || _userAddress
    if (userAddress) {
      data.address = userAddress
    }

    data = await getUserData(userAddress, goldfinchProtocol, pool, creditDesk, network.name, currentBlock)

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

  async function refreshCurrentBlock(): Promise<void> {
    const currentBlock = getBlockInfo(await getCurrentBlock())
    setCurrentBlock(currentBlock)
  }

  const store: GlobalState = {
    currentBlock,
    pool,
    creditDesk,
    user,
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
  }

  return (
    <AppContext.Provider value={store}>
      <ThemeProvider theme={defaultTheme}>
        {network && currentBlock ? (
          <NetworkWidget
            user={user}
            currentBlock={currentBlock}
            network={network}
            currentErrors={currentErrors}
            currentTXs={currentTXs}
            connectionComplete={setupWeb3}
          />
        ) : undefined}
        <EarnProvider>
          <BorrowProvider>
            <Router>
              {(process.env.NODE_ENV === "development" || process.env.MURMURATION === "yes") && <DevTools />}
              <Sidebar />
              <div>
                <Switch>
                  <Route exact path="/">
                    <Redirect to="/earn" />
                  </Route>
                  <Route path="/about">{/* <About /> */}</Route>
                  <Route path="/earn">
                    <Earn />
                  </Route>
                  {toggleRewards && (
                    <Route path="/rewards">
                      <Rewards />
                    </Route>
                  )}
                  <Route path="/borrow">
                    <Borrow />
                  </Route>
                  <Route path="/transactions">
                    <Transactions currentTXs={currentTXs} />
                  </Route>
                  <Route path="/pools/senior">
                    <SeniorPoolView />
                  </Route>
                  <Route path="/pools/:poolAddress">
                    <TranchedPoolView />
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
            </Router>
          </BorrowProvider>
        </EarnProvider>
        <Footer />
      </ThemeProvider>
    </AppContext.Provider>
  )
}

export {App, AppContext}
export type {GeolocationData}
