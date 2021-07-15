import Web3 from "web3"
// This setup style would connect to metamask in browser if necessary.
// const web3 = new Web3(Web3.givenProvider || "ws://localhost:8545");
let web3: Web3
declare let window: any
let localStorage = window.localStorage
let currentChain = localStorage.getItem("currentChain")
let currentAccount = localStorage.getItem("currentAccount")
if (typeof window.ethereum !== "undefined") {
  web3 = new Web3(window.ethereum)

  window.ethereum.autoRefreshOnNetworkChange = false
  window.ethereum.on("chainChanged", (chainId) => {
    if (currentChain !== chainId) {
      window.location.reload()
      localStorage.setItem("currentChain", chainId)
    }
  })
  window.ethereum.on("accountsChanged", (accounts) => {
    if (currentAccount && accounts[0] && currentAccount !== accounts[0]) {
      window.location.reload()
      localStorage.setItem("currentAccount", accounts[0])
    }
  })
} else {
  // For local network testing.
  web3 = new Web3("http://127.0.0.1:8545")
}

export default web3
