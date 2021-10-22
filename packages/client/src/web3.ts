import Web3 from "web3"

// This setup style would connect to metamask in browser if necessary.
// const web3 = new Web3(Web3.givenProvider || "ws://localhost:8545");
let web3: Web3
declare let window: any
let localStorage = window.localStorage
let currentChain = localStorage.getItem("currentChain")
let currentAccount = localStorage.getItem("currentAccount")
export const SESSION_DATA_KEY = "sessionData"

function cleanSessionAndReload() {
  localStorage.removeItem(SESSION_DATA_KEY)
  window.location.reload()
}

function withTracing(provider) {
  let requestFn = provider.request.bind(provider)
  provider.request = (args) => {
    console.trace("request", args)
    return requestFn(args)
  }
  return provider
}

if (typeof window.ethereum !== "undefined") {
  let provider = process.env.REACT_APP_TRACE_WEB3 ? withTracing(window.ethereum) : window.ethereum
  web3 = new Web3(provider)

  window.ethereum.autoRefreshOnNetworkChange = false
  window.ethereum.on("chainChanged", (chainId) => {
    if (currentChain !== chainId) {
      cleanSessionAndReload()
      localStorage.setItem("currentChain", chainId)
    }
  })
  window.ethereum.on("accountsChanged", (accounts) => {
    if (accounts[0] && currentAccount !== accounts[0]) {
      localStorage.removeItem(SESSION_DATA_KEY)
      if (Boolean(currentAccount)) {
        // If the currentAccount is null or undefined the user is connecting to metamask
        // and not changing accounts therefore a reload should be avoided to show the sign in
        window.location.reload()
      }
      localStorage.setItem("currentAccount", accounts[0])
    }
    if (accounts.length === 0) {
      cleanSessionAndReload()
    }
  })
} else {
  // For local network testing.
  web3 = new Web3("http://127.0.0.1:8545")
}

export default web3
