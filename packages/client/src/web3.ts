import {assertNonNullable, assertUnreachable} from "@goldfinch-eng/utils/src/type"
import {MetaMaskInpageProvider} from "@metamask/providers"
import {RequestArguments} from "@metamask/providers/dist/BaseProvider"
import WalletConnectProvider from "@walletconnect/web3-provider"
import {isString} from "lodash"
import Web3 from "web3"
import {
  HttpProvider as HttpProviderType,
  IpcProvider as IpcProviderType,
  provider as ProviderType,
  WebsocketProvider as WebsocketProviderType,
} from "web3-core"
import WebsocketProvider from "web3-providers-ws"
import HttpProvider from "web3-providers-http"
import {JsonRpcPayload, JsonRpcResponse, WebsocketProviderOptions} from "web3-core-helpers"
import {Web3IO, UserWalletWeb3Status} from "./types/web3"
import {AURORA, MAINNET} from "./ethereum/utils"
import {GFITokenImageURL} from "./utils"
import {isWalletConnectProvider, WalletConnectWeb3Provider, web3Modal} from "./walletConnect"
import {getERC20, Ticker} from "./ethereum/erc20"
import {GoldfinchProtocol} from "./ethereum/GoldfinchProtocol"

let web3: Web3
let web3IO: Web3IO<Web3>
let walletConnectProvider: WalletConnectProvider

declare let window: any
let localStorage = window.localStorage
let currentChain = localStorage.getItem("currentChain")
let currentAccount = localStorage.getItem("currentAccount")
let walletConnectData = localStorage.getItem("walletconnect")
const SESSION_DATA_KEY = "sessionData"

function cleanSessionAndReload() {
  localStorage.removeItem(SESSION_DATA_KEY)
  localStorage.removeItem("walletconnect")
  window.location.reload()
}

const networkNameByChainId: {[chainId: string]: string} = {
  "0x1": MAINNET,
  "0x4": "rinkeby",
  "0x4e454153": "aurora",
}

const websocketOptions: WebsocketProviderOptions = {
  // Configure the websocket connection to automatically reconnect if it drops (cf.
  // https://ethereum.stackexchange.com/a/84194). We observed Websocket connections to Infura
  // being dropped after a period of inactivity.
  reconnect: {
    auto: true,
    delay: 1000,
    maxAttempts: 5,
    onTimeout: true,
  },
}

function subscribeProvider(provider: WebsocketProviderType | IpcProviderType | WalletConnectProvider): void {
  provider.on("chainChanged", (chainId) => {
    if (currentChain !== chainId) {
      cleanSessionAndReload()
      localStorage.setItem("currentChain", chainId)
    }
  })
  provider.on("accountsChanged", (accounts) => {
    if (accounts[0] && currentAccount !== accounts[0]) {
      localStorage.removeItem(SESSION_DATA_KEY)
      if (isString(currentAccount) && currentAccount) {
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

async function onWalletConnect(): Promise<void> {
  try {
    walletConnectProvider = await web3Modal.connect()
  } catch (error) {
    console.log("Could not get a wallet connection", error)
    return
  }

  if (walletConnectProvider?.accounts[0]) {
    localStorage.setItem("currentAccount", walletConnectProvider.accounts[0])
  }

  web3 = genWalletConnectUserWalletWeb3(walletConnectProvider)
  web3IO = {readOnly: web3, userWallet: web3}

  subscribeProvider(walletConnectProvider)

  walletConnectProvider.on("close", async () => {
    localStorage.removeItem("currentAccount")
    await web3Modal.clearCachedProvider()
    cleanSessionAndReload()
  })
}

async function closeWalletConnect(): Promise<void> {
  if (web3 && isWalletConnectProvider(web3.currentProvider)) {
    await web3.currentProvider.close()
  }
}

const isMetaMaskInpageProvider = (obj: unknown): obj is MetaMaskInpageProvider => {
  // The check here isn't very strong (cf. https://docs.metamask.io/guide/ethereum-provider.html#ethereum-ismetamask),
  // but it's sufficient for our purposes. If the object says it's Metamask, we'll treat it
  // like it is.
  return obj instanceof Object && obj.hasOwnProperty("isMetaMask") && (obj as {isMetaMask: boolean}).isMetaMask
}

const isUnknownProvider = (obj: unknown): boolean => {
  return !isMetaMaskInpageProvider(web3?.currentProvider) && !isWalletConnectProvider(web3.currentProvider)
}

function genWalletConnectUserWalletWeb3(walletConnectProvider: WalletConnectProvider): Web3 {
  if (!web3 || !isWalletConnectProvider(web3.currentProvider)) {
    web3 = new Web3(walletConnectProvider as WalletConnectWeb3Provider)
  }
  return web3
}

function genUserWalletWeb3(metamaskProvider: MetaMaskInpageProvider): Web3 {
  const wrapped: WrappedProvider = {type: "metamask", provider: metamaskProvider}
  const provider =
    process.env.REACT_APP_TRACE_WEB3 === "yes" ? withTracing("userWallet", wrapped).provider : wrapped.provider
  return new Web3(provider as ProviderType)
}

async function getUserWalletWeb3Status(): Promise<UserWalletWeb3Status> {
  if (!window.ethereum && !walletConnectProvider) {
    return {type: "no_web3", networkName: undefined, address: undefined}
  }
  let networkName: string
  try {
    // Sometimes it's possible that we can't communicate with the provider through which
    // we want to send transactions, in which case treat as if we don't have web3.
    networkName = await web3.eth.net.getNetworkType()
    if (!networkName) {
      throw new Error("Falsy network type.")
    }
  } catch (e) {
    return {type: "no_web3", networkName: undefined, address: undefined}
  }
  const accounts = await web3.eth.getAccounts()
  const address = accounts[0]
  if (address) {
    return {type: "connected", networkName, address}
  }
  return {type: "has_web3", networkName, address: undefined}
}

type Web3ProviderConfig = {
  websocketUrl: string
  httpUrl: string
  name: "Infura" | "Alchemy"
}

const getWeb3ProviderConfig = (networkName: string): Web3ProviderConfig | undefined =>
  process.env.REACT_APP_INFURA_PROJECT_ID
    ? {
        websocketUrl: `wss://${networkName}.infura.io/ws/v3/${process.env.REACT_APP_INFURA_PROJECT_ID}`,
        httpUrl: `https://${networkName}.infura.io/v3/${process.env.REACT_APP_INFURA_PROJECT_ID}`,
        name: "Infura",
      }
    : process.env.REACT_APP_ALCHEMY_API_KEY && networkName === MAINNET
    ? {
        websocketUrl: `wss://eth-mainnet.alchemyapi.io/v2/${process.env.REACT_APP_ALCHEMY_API_KEY}`,
        httpUrl: `https://eth-mainnet.alchemyapi.io/v2/${process.env.REACT_APP_ALCHEMY_API_KEY}`,
        name: "Alchemy",
      }
    : networkName === AURORA
    ? {
        websocketUrl: "wss://testnet.aurora.dev",
        httpUrl: "https://testnet.aurora.dev",
        name: "Alchemy",
      }
    : undefined

function genReadOnlyWeb3(metamaskProvider: MetaMaskInpageProvider): Web3 {
  const chainId = metamaskProvider.chainId
  let wrapped: WrappedProvider = {type: "metamask", provider: metamaskProvider}
  if (chainId && chainId in networkNameByChainId) {
    const networkName = networkNameByChainId[chainId]
    assertNonNullable(networkName)
    const providerConfig = getWeb3ProviderConfig(networkName)
    if (providerConfig) {
      wrapped =
        process.env.REACT_APP_WEB3_HTTP === "yes"
          ? {
              type: "http",
              // @ts-expect-error
              provider: new HttpProvider(providerConfig.httpUrl),
            }
          : {
              type: "websocket",
              // @ts-expect-error cf. https://ethereum.stackexchange.com/a/96436
              provider: new WebsocketProvider(providerConfig.websocketUrl, websocketOptions),
            }
      console.log(`Using custom ${providerConfig.name} provider with ${wrapped.type} connection.`)
    }
  } else {
    console.warn(`Unexpected chain id: ${chainId}. Falling back to Metamask's default provider.`)
  }
  const provider =
    process.env.REACT_APP_TRACE_WEB3 === "yes" ? withTracing("readOnly", wrapped).provider : wrapped.provider
  return new Web3(provider as ProviderType)
}

function getWeb3(): Web3IO<Web3> {
  if (walletConnectProvider || walletConnectData) {
    const walletConnect = async (): Promise<void> => {
      return onWalletConnect()
    }
    if (!web3 || !isWalletConnectProvider(web3.currentProvider)) {
      // Restores user's active session on reload if WC session data exists
      walletConnect()
    }
  } else if (window.ethereum) {
    let _provider: ProviderType = window.ethereum
    if (window.ethereum.overrideIsMetaMask) {
      // Multiple wallet extensions fight to inject the provider on window.ethereum, for the specific
      // case of Coinbase wallet (CW) it hijacks `window.ethereum` and adds `overrideIsMetaMask: true`
      // The following code makes metamask the default connection choice, if the user doesn't have metamask
      // and is using another wallet we'll still try to use it as the provider
      const metamaskDefaultProvider = window.ethereum.providers.find((provider) => provider.isMetaMask)
      if (metamaskDefaultProvider) {
        _provider = metamaskDefaultProvider
        window.ethereum.setSelectedProvider(metamaskDefaultProvider)
      }
    }

    if (isMetaMaskInpageProvider(_provider)) {
      if (!web3 || !isMetaMaskInpageProvider(web3?.currentProvider)) {
        web3 = genUserWalletWeb3(_provider)
        web3IO = {readOnly: genReadOnlyWeb3(_provider), userWallet: web3}
      }
    } else {
      if (!web3 || !isUnknownProvider(web3.currentProvider)) {
        // This isn't an error per se; some other wallet / browser extension besides Metamask could
        // define `window.ethereum`. We'll try to use it as the provider.
        console.log(`\`window.ethereum\` failed type-guard for MetaMaskInpageProvider: ${_provider}`)
        web3 = new Web3(_provider as ProviderType)
        web3IO = {readOnly: web3, userWallet: web3}
      }
    }
  } else {
    if (process.env.NODE_ENV === "production") {
      const networkName = "mainnet"
      const providerConfig = getWeb3ProviderConfig(networkName)
      if (providerConfig) {
        const provider =
          process.env.REACT_APP_WEB3_HTTP === "yes"
            ? // @ts-expect-error cf. https://ethereum.stackexchange.com/a/96436
              new HttpProvider(providerConfig.httpUrl)
            : // @ts-expect-error cf. https://ethereum.stackexchange.com/a/96436
              new WebsocketProvider(providerConfig.websocketUrl, websocketOptions)
        const sharedWeb3 = new Web3(provider)
        return {
          readOnly: sharedWeb3,
          userWallet: sharedWeb3,
        }
      } else {
        console.error("Failed to define web3 provider urls.")
      }
    }
    // For local network testing.
    web3 = new Web3("http://127.0.0.1:8545")
    web3IO = {readOnly: web3, userWallet: web3}
  }
  return web3IO
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

async function requestUserAddGfiTokenToWallet(address: string): Promise<boolean> {
  return await (web3.currentProvider as any)
    .request({
      method: "wallet_watchAsset",
      params: {
        type: "ERC20",
        options: {
          address: address,
          symbol: "GFI",
          decimals: 18,
          image: GFITokenImageURL(),
        },
      },
    })
    .then((success: boolean) => {
      if (!success) {
        throw new Error("Failed to add GFI token to wallet.")
      }
    })
    .catch(console.error)
}

async function requestUserAddERC20TokenToWallet(
  ticker: Ticker,
  goldfinchProtocol: GoldfinchProtocol
): Promise<boolean> {
  const erc20 = await getERC20(ticker, goldfinchProtocol)

  return await (web3.currentProvider as any)
    .request({
      method: "wallet_watchAsset",
      params: {
        type: "ERC20",
        options: {
          address: erc20.address,
          symbol: erc20.ticker,
          decimals: erc20.decimals,
          image: erc20.icon,
        },
      },
    })
    .then((success: boolean) => {
      if (!success) {
        throw new Error(`Failed to add ${erc20.ticker} token to wallet.`)
      }
    })
    .catch(console.error)
}

if (window.ethereum) {
  window.ethereum.autoRefreshOnNetworkChange = false
  subscribeProvider(window.ethereum)
}

export {
  onWalletConnect,
  closeWalletConnect,
  getUserWalletWeb3Status,
  isMetaMaskInpageProvider,
  requestUserAddGfiTokenToWallet,
  requestUserAddERC20TokenToWallet,
  SESSION_DATA_KEY,
}

export default getWeb3
