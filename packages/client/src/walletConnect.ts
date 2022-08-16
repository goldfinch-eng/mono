import WalletConnectProvider from "@walletconnect/web3-provider"
import {ethers} from "ethers"
import {JsonRpcPayload, JsonRpcResponse} from "web3-core-helpers"
import {AbstractProvider} from "web3-core/types"
import Web3Modal from "web3modal"
import {chainIdToNetworkID, SupportedChainId} from "./ethereum/utils"

export declare class WalletConnectWeb3Provider extends WalletConnectProvider implements AbstractProvider {
  sendAsync(payload: JsonRpcPayload, callback: (error: Error | null, result?: JsonRpcResponse) => void): void
}

const getWebSocketURL = (networkId: SupportedChainId): string => {
  if (networkId === SupportedChainId.LOCAL) {
    return "ws://127.0.0.1:8545"
  } else {
    if (process.env.REACT_APP_INFURA_PROJECT_ID) {
      return `wss://${chainIdToNetworkID[networkId]}.infura.io/ws/v3/${process.env.REACT_APP_INFURA_PROJECT_ID}`
    } else if (process.env.REACT_APP_ALCHEMY_API_KEY && networkId === SupportedChainId.MAINNET) {
      return `wss://eth-mainnet.alchemyapi.io/v2/${process.env.REACT_APP_ALCHEMY_API_KEY}`
    } else {
      throw new Error("Websocket for non-local chain requires Infura project id.")
    }
  }
}

const getProviderOptions = (): {infuraId?: string; rpc?: {[chainId: number]: string}} => {
  if (process.env.REACT_APP_INFURA_PROJECT_ID) {
    return {infuraId: process.env.REACT_APP_INFURA_PROJECT_ID}
  } else if (process.env.REACT_APP_ALCHEMY_API_KEY) {
    return {
      rpc: {1: `https://eth-mainnet.alchemyapi.io/v2/${process.env.REACT_APP_ALCHEMY_API_KEY}`},
    }
  }

  // To test on your local network, disable the infuraID to activate this rpc
  // configuration, we recommend tunneling (like ngrok) so that way your
  // local rpc server is visible to walletconnect bridge server.
  return {rpc: {1287: "https://rpc.api.moonbase.moonbeam.network/"}}
}

const providerOptions = {
  walletconnect: {
    package: WalletConnectProvider,
    options: getProviderOptions(),
  },
}

export const web3Modal = new Web3Modal({
  cacheProvider: true,
  providerOptions,
  disableInjectedProvider: true,
})

export const isWalletConnectProvider = (obj: unknown): obj is WalletConnectProvider => {
  return obj instanceof Object && obj.hasOwnProperty("wc") && !!(obj as {wc: Object}).wc
}

export const signMessage = async (provider: ethers.providers.Web3Provider, userAddress: string, message: string) => {
  return await provider.send("personal_sign", [
    ethers.utils.hexlify(ethers.utils.toUtf8Bytes(message)),
    userAddress.toLowerCase(),
  ])
}

export const subscribe = async (
  networkId: SupportedChainId,
  subscribeParams: {tag: string; params: unknown[]; processFunction: (result: unknown) => void}
) => {
  const provider = new ethers.providers.WebSocketProvider(getWebSocketURL(networkId))
  provider._subscribe(subscribeParams.tag, subscribeParams.params, subscribeParams.processFunction)
}

const walletConnect = {
  web3Modal,
  signMessage,
  subscribe,
  isWCProvider: isWalletConnectProvider,
}

export default walletConnect
