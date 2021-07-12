import React, { useState, useEffect } from "react"
import { BrowserRouter as Router, Switch, Route, Redirect } from "react-router-dom"
import * as Sentry from '@sentry/react'
import Borrow from "./components/borrow.js"
import Earn from "./components/earn"
import Transactions from "./components/transactions.js"
import NetworkWidget from "./components/networkWidget"
import Sidebar from "./components/sidebar"
import TermsOfService from "./components/termsOfService.js"
import PrivacyPolicy from "./components/privacyPolicy.js"
import web3 from "./web3"
import { fetchPoolData, getPool } from "./ethereum/pool.js"
import { getCreditDesk, fetchCreditDeskData } from "./ethereum/creditDesk.js"
import { ERC20, getUSDC } from "./ethereum/erc20"
import { getGoldfinchConfig, refreshGoldfinchConfigData } from "./ethereum/goldfinchConfig"
import { getUserData, defaultUser, User, DefaultUser } from "./ethereum/user"
import { mapNetworkToID, SUPPORTED_NETWORKS } from "./ethereum/utils"
import initSdk, { SafeInfo, SdkInstance } from "@gnosis.pm/safe-apps-sdk"
import { NetworkMonitor } from "./ethereum/networkMonitor"
import VerifyIdentity from "./components/verifyIdentity"

interface NetworkConfig {
  name?: string
  supported?: any
}

interface GlobalState {
  pool?: any
  creditDesk?: any
  user: User
  usdc?: ERC20
  goldfinchConfig?: any
  network?: NetworkConfig
  gnosisSafeInfo?: SafeInfo
  gnosisSafeSdk?: SdkInstance
  networkMonitor?: NetworkMonitor
  refreshUserData?: (overrideAddress?: string) => void
}

declare let window: any;

const AppContext = React.createContext<GlobalState>({user: defaultUser()})

function App() {
  const [pool, setPool] = useState<any>({})
  const [creditDesk, setCreditDesk] = useState<any>({})
  const [usdc, setUSDC] = useState<ERC20>()
  const [user, setUser] = useState<User>(defaultUser())
  const [goldfinchConfig, setGoldfinchConfig] = useState({})
  const [currentTXs, setCurrentTXs] = useState([])
  const [currentErrors, setCurrentErrors] = useState([])
  const [network, setNetwork] = useState<NetworkConfig>({})
  const [gnosisSafeInfo, setGnosisSafeInfo] = useState<SafeInfo>()
  const [gnosisSafeSdk, setGnosisSafeSdk] = useState<SdkInstance>()
  const [networkMonitor, setNetworkMonitor] = useState<NetworkMonitor>()

  useEffect(() => {
    setupWeb3()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    refreshUserData()
    // Admin function to be able to assume the role of any address
    window.setUserAddress = function(overrideAddress: string) {
      refreshUserData(overrideAddress)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gnosisSafeInfo, usdc, pool, creditDesk, network])

  async function setupWeb3() {
    if (!window.ethereum) {
      return
    }

    // Initialize gnosis safe
    const safeSdk = initSdk()
    safeSdk.addListeners({
      onSafeInfo: setGnosisSafeInfo,
      onTransactionConfirmation: () => {},
    })
    setGnosisSafeSdk(safeSdk)

    const networkName = await web3.eth.net.getNetworkType()
    const networkId = mapNetworkToID[networkName] || networkName
    const networkConfig: NetworkConfig = { name: networkId, supported: SUPPORTED_NETWORKS[networkId] }
    setNetwork(networkConfig)
    let usdc: ERC20, poolContract: any, goldfinchConfigContract: any, creditDeskContract: any
    if (networkConfig.supported) {
      usdc = await getUSDC(networkId)
      poolContract = await getPool(networkId)
      goldfinchConfigContract = await getGoldfinchConfig(networkId)
      creditDeskContract = await getCreditDesk(networkId)
      poolContract.gf = await fetchPoolData(poolContract, usdc.contract)
      creditDeskContract.gf = await fetchCreditDeskData(creditDeskContract)
      setUSDC(usdc)
      setPool(poolContract)
      setCreditDesk(creditDeskContract)
      setGoldfinchConfig(await refreshGoldfinchConfigData(goldfinchConfigContract))
      const monitor = new NetworkMonitor(web3, {
        setCurrentTXs,
        setCurrentErrors,
      })
      monitor.initialize() // initialize async, no need to block on this
      setNetworkMonitor(monitor)
    }

    return () => safeSdk.removeListeners()
  }

  async function refreshUserData(overrideAddress?: string) {
    let data: User = defaultUser()
    const accounts = await web3.eth.getAccounts()
    data.web3Connected = true
    const _userAddress = (gnosisSafeInfo && gnosisSafeInfo.safeAddress) || (accounts && accounts[0]) || user.address
    const userAddress = overrideAddress || _userAddress
    if (userAddress) {
      data.address = userAddress
    }
    if (userAddress && usdc && creditDesk.loaded && pool.loaded) {
      data = await getUserData(userAddress, usdc, pool, creditDesk, network.name)
    }

    Sentry.setUser({
      // NOTE: The info we use here to identify / define the user for the purpose of
      // error tracking with Sentry MUST be kept consistent with (i.e. not exceed
      // the bounds set by) what our Terms of Service, Privacy Policy, and marketing
      // copy states about the identifying information that Goldfinch stores.
      id: data.address, address: data.address, isOverrideOf: overrideAddress ? _userAddress : undefined
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
    gnosisSafeInfo,
    gnosisSafeSdk,
    networkMonitor,
    refreshUserData,
  }

  throw new Error("testing that Sentry logs this, including with release info")

  return (
    <AppContext.Provider value={store}>
      <Router>
        <Sidebar />
        <NetworkWidget
          user={user}
          network={network}
          currentErrors={currentErrors}
          currentTXs={currentTXs}
          gnosisSafeInfo={gnosisSafeInfo}
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
            <Route path="/earn">
              <Earn />
            </Route>
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

export { App, AppContext }
