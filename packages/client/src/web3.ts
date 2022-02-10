import {assertNonNullable, assertUnreachable} from "@goldfinch-eng/utils/src/type"
import {MetaMaskInpageProvider} from "@metamask/providers"
import {RequestArguments} from "@metamask/providers/dist/BaseProvider"
import Web3 from "web3"
import {
  provider as ProviderType,
  WebsocketProvider as WebsocketProviderType,
  HttpProvider as HttpProviderType,
} from "web3-core"
import WebsocketProvider from "web3-providers-ws"
import HttpProvider from "web3-providers-http"
import {JsonRpcPayload, JsonRpcResponse} from "web3-core-helpers"
import {Web3IO, UserWalletWeb3Status} from "./types/web3"

declare let window: any
let localStorage = window.localStorage
let currentChain = localStorage.getItem("currentChain")
let currentAccount = localStorage.getItem("currentAccount")
const SESSION_DATA_KEY = "sessionData"

function cleanSessionAndReload() {
  localStorage.removeItem(SESSION_DATA_KEY)
  window.location.reload()
}

const networkNameByChainId: {[chainId: string]: string} = {
  "0x1": "mainnet",
  "0x4": "rinkeby",
}

const isMetaMaskInpageProvider = (obj: unknown): obj is MetaMaskInpageProvider => {
  // The check here isn't very strong (cf. https://docs.metamask.io/guide/ethereum-provider.html#ethereum-ismetamask),
  // but it's sufficient for our purposes. If the object says it's Metamask, we'll treat it
  // like it is.
  return obj instanceof Object && obj.hasOwnProperty("isMetaMask") && (obj as {isMetaMask: boolean}).isMetaMask
}

function genUserWalletWeb3(metamaskProvider: MetaMaskInpageProvider): Web3 {
  const wrapped: WrappedProvider = {type: "metamask", provider: metamaskProvider}
  const provider =
    process.env.REACT_APP_TRACE_WEB3 === "yes" ? withTracing("userWallet", wrapped).provider : wrapped.provider
  return new Web3(provider as ProviderType)
}

async function getUserWalletWeb3Status(): Promise<UserWalletWeb3Status> {
  if (!window.ethereum && !web3) {
    return {type: "no_web3", networkName: undefined, address: undefined}
  }
  let networkName: string
  try {
    // Sometimes it's possible that we can't communicate with the provider through which
    // we want to send transactions, in which case treat as if we don't have web3.
    networkName = await web3.userWallet.eth.net.getNetworkType()
    if (!networkName) {
      throw new Error("Falsy network type.")
    }
  } catch (e) {
    return {type: "no_web3", networkName: undefined, address: undefined}
  }
  const accounts = await web3.userWallet.eth.getAccounts()
  const address = accounts[0]
  if (address) {
    return {type: "connected", networkName, address}
  } else {
    return {type: "has_web3", networkName, address: undefined}
  }
}

function genReadOnlyWeb3(metamaskProvider: MetaMaskInpageProvider): Web3 {
  const chainId = metamaskProvider.chainId
  let wrapped: WrappedProvider = {type: "metamask", provider: metamaskProvider}
  if (process.env.REACT_APP_INFURA_PROJECT_ID) {
    if (chainId && chainId in networkNameByChainId) {
      const networkName = networkNameByChainId[chainId]
      assertNonNullable(networkName)
      wrapped =
        process.env.REACT_APP_INFURA_HTTP === "yes"
          ? {
              type: "http",
              // @ts-expect-error
              provider: new HttpProvider(
                `https://${networkName}.infura.io/v3/${process.env.REACT_APP_INFURA_PROJECT_ID}`
              ),
            }
          : {
              type: "websocket",
              // @ts-expect-error cf. https://ethereum.stackexchange.com/a/96436
              provider: new WebsocketProvider(
                `wss://${networkName}.infura.io/ws/v3/${process.env.REACT_APP_INFURA_PROJECT_ID}`
              ),
            }
      console.log(`Using custom Infura provider with ${wrapped.type} connection.`)
    } else {
      console.warn(`Unexpected chain id: ${chainId}. Falling back to Metamask's default provider.`)
    }
  }
  const provider =
    process.env.REACT_APP_TRACE_WEB3 === "yes" ? withTracing("readOnly", wrapped).provider : wrapped.provider
  return new Web3(provider as ProviderType)
}

function genWeb3(): Web3IO<Web3> {
  if (window.ethereum) {
    if (isMetaMaskInpageProvider(window.ethereum)) {
      return {readOnly: genReadOnlyWeb3(window.ethereum), userWallet: genUserWalletWeb3(window.ethereum)}
    } else {
      // This isn't an error per se; some other wallet / browser extension besides Metamask could
      // define `window.ethereum`. We'll try to use it as the provider.
      console.log(`\`window.ethereum\` failed type-guard for MetaMaskInpageProvider: ${window.ethereum}`)
      const sharedWeb3 = new Web3(window.ethereum as ProviderType)
      return {readOnly: sharedWeb3, userWallet: sharedWeb3}
    }
  } else {
    if (process.env.NODE_ENV !== "production") {
      console.log("REACT_APP_INFURA_HTTP", process.env.REACT_APP_INFURA_HTTP)
      console.log("REACT_APP_INFURA_PROJECT_ID", process.env.REACT_APP_INFURA_PROJECT_ID)
      const networkName = "mainnet"
      const provider =
        process.env.REACT_APP_INFURA_HTTP === "yes"
          ? // @ts-expect-error cf. https://ethereum.stackexchange.com/a/96436
            new HttpProvider(`https://${networkName}.infura.io/v3/${process.env.REACT_APP_INFURA_PROJECT_ID}`)
          : // @ts-expect-error cf. https://ethereum.stackexchange.com/a/96436
            new WebsocketProvider(`wss://${networkName}.infura.io/ws/v3/${process.env.REACT_APP_INFURA_PROJECT_ID}`)
      const sharedWeb3 = new Web3(provider)
      return {
        readOnly: sharedWeb3,
        userWallet: sharedWeb3,
      }
    }
    // For local network testing.
    const sharedWeb3 = new Web3("http://127.0.0.1:8545")
    return {readOnly: sharedWeb3, userWallet: sharedWeb3}
  }
}

type WrappedProvider =
  | {
      type: "metamask"
      provider: MetaMaskInpageProvider
    }
  | {
      type: "websocket"
      provider: WebsocketProviderType
    }
  | {
      type: "http"
      provider: HttpProviderType
    }

function withTracing<T extends WrappedProvider>(context: string, wrapped: T): T {
  const startTime = Date.now()
  let count = 0
  let currentTime = startTime

  switch (wrapped.type) {
    case "metamask":
      const requestFn = wrapped.provider.request.bind(wrapped.provider)
      wrapped.provider.request = (args: RequestArguments) => {
        count++
        currentTime = Date.now()
        console.log(context, "query", count, (currentTime - startTime) / 1000)
        return requestFn(args)
      }
      return wrapped
    case "http":
    case "websocket":
      const sendFn = wrapped.provider.send.bind(wrapped.provider)
      wrapped.provider.send = (
        payload: JsonRpcPayload,
        callback: (error: Error | null, result?: JsonRpcResponse) => void
      ): void => {
        count++
        currentTime = Date.now()
        console.log(context, "query", count, (currentTime - startTime) / 1000)
        return sendFn(payload, callback)
      }
      return wrapped
    default:
      assertUnreachable(wrapped)
  }
}

if (window.ethereum) {
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
}

const web3 = genWeb3()

export default web3

export {getUserWalletWeb3Status, SESSION_DATA_KEY}
