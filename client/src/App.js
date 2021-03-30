import React, { useState, useEffect } from "react"
import { BrowserRouter as Router, Switch, Route, Redirect } from "react-router-dom"
import Borrow from "./components/borrow.js"
import Earn from "./components/earn.js"
import Transactions from "./components/transactions.js"
import NetworkWidget from "./components/networkWidget"
import Sidebar from "./components/sidebar"
import TermsOfService from "./components/termsOfService.js"
import web3 from "./web3"
import { fetchPoolData, getPool } from "./ethereum/pool.js"
import { getCreditDesk, fetchCreditDeskData } from "./ethereum/creditDesk.js"
import { getUSDC } from "./ethereum/erc20.js"
import { getGoldfinchConfig, refreshGoldfinchConfigData } from "./ethereum/goldfinchConfig.js"
import { getUserData, defaultUser } from "./ethereum/user.js"
import { mapNetworkToID, SUPPORTED_NETWORKS } from "./ethereum/utils"
import initSdk from "@gnosis.pm/safe-apps-sdk"
import { NetworkMonitor } from "./ethereum/networkMonitor"

const AppContext = React.createContext({})

function App() {
  const [pool, setPool] = useState({})
  const [creditDesk, setCreditDesk] = useState({})
  const [usdc, setUSDC] = useState(null)
  const [user, setUser] = useState(defaultUser())
  const [goldfinchConfig, setGoldfinchConfig] = useState({})
  const [currentTXs, setCurrentTXs] = useState([])
  const [currentErrors, setCurrentErrors] = useState([])
  const [network, setNetwork] = useState({})
  const [gnosisSafeInfo, setGnosisSafeInfo] = useState()
  const [gnosisSafeSdk, setGnosisSafeSdk] = useState()
  const [networkMonitor, setNetworkMonitor] = useState()

  useEffect(() => {
    setupWeb3()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    refreshUserData()
    // Admin function to be able to assume the role of any address
    window.setUserAddress = function(overrideAddress) {
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
    const networkConfig = { name: networkId, supported: SUPPORTED_NETWORKS[networkId] }
    setNetwork(networkConfig)
    let usdc, poolContract, goldfinchConfigContract, creditDeskContract
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

  async function refreshUserData(overrideAddress) {
    let data = defaultUser()
    const accounts = await web3.eth.getAccounts()
    let userAddress =
      overrideAddress || (gnosisSafeInfo && gnosisSafeInfo.safeAddress) || (accounts && accounts[0]) || user.address
    // Set this to the borrower contract address to test gasless transactions
    // let userAddress = '0xd3D57673BAE28880376cDF89aeFe4653A5C84A08';
    if (userAddress && usdc && creditDesk.loaded && pool.loaded) {
      data = await getUserData(userAddress, usdc, pool, creditDesk, network.name)
    }
    setUser(data)
  }

  const store = {
    pool: pool,
    creditDesk: creditDesk,
    user: user,
    usdc: usdc,
    goldfinchConfig: goldfinchConfig,
    network: network,
    gnosisSafeInfo: gnosisSafeInfo,
    gnosisSafeSdk: gnosisSafeSdk,
    networkMonitor: networkMonitor,
    refreshUserData: refreshUserData,
  }

  return (
    <AppContext.Provider value={store}>
      <Router>
        <Sidebar />
        <NetworkWidget
          user={user}
          network={network}
          setUser={setUser}
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
            <Route path="/terms">
              <TermsOfService />
            </Route>
          </Switch>
        </div>
        <footer>
          <a href="/terms">Terms</a>
        </footer>
      </Router>
    </AppContext.Provider>
  )
}

export { App, AppContext }
