import {NonPayableTransactionObject} from "@goldfinch-eng/protocol/typechain/web3/types"
import getWeb3 from "../web3"
import {getDeployments, chainIdToNetworkID, FORWARDER_ADDRESSES, isMainnetForking} from "./utils"
const ForwarderAbi = require("../../../autotasks/relayer/Forwarder.json")
const {ethers} = require("ethers")

const RELAY_URLS = {
  1: "https://api.defender.openzeppelin.com/autotasks/9d2053fd-507a-473f-8b5a-b079a694723a/runs/webhook/6a51e904-1439-4c68-981b-5f22f1c0b560/MiuRjp5Lnd6fjjYARR4j4r",
  4: "https://api.defender.openzeppelin.com/autotasks/348209ac-8cfd-41a4-be60-e97eab073f29/runs/webhook/6a51e904-1439-4c68-981b-5f22f1c0b560/Ug7a1WChPSLRPtcT4PCUnQ",
  31337: "/relay", // Proxied by webpack to packages/server/index.ts
}
const MAX_GAS = 2e6

const EIP712DomainType = [
  {name: "name", type: "string"},
  {name: "version", type: "string"},
  {name: "chainId", type: "uint256"},
  {name: "verifyingContract", type: "address"},
]

const ForwardRequestType = [
  {name: "from", type: "address"},
  {name: "to", type: "address"},
  {name: "value", type: "uint256"},
  {name: "gas", type: "uint256"},
  {name: "nonce", type: "uint256"},
  {name: "data", type: "bytes"},
]

const TypedData = {
  domain: {
    name: "Defender",
    version: "1",
    chainId: null,
    verifyingContract: null,
  },
  primaryType: "ForwardRequest",
  types: {
    EIP712Domain: EIP712DomainType,
    ForwardRequest: ForwardRequestType,
  },
  message: {},
}

async function submitGaslessTransaction(
  contractAddress: string,
  unsentAction: NonPayableTransactionObject<void>
): Promise<unknown> {
  const web3 = getWeb3()
  const provider = new ethers.providers.Web3Provider(web3.userWallet.currentProvider)
  const signer = provider.getSigner()
  const from = await signer.getAddress()

  const network = await provider.getNetwork()
  let ForwarderAddress = FORWARDER_ADDRESSES[network.chainId]
  // If we're on a purely local deployment, or murmuration, use the TestForwarder.
  if (
    (network.chainId === 31337 && !isMainnetForking()) ||
    (network.chainId === 31337 && process.env.REACT_APP_MURMURATION === "yes")
  ) {
    const config = await getDeployments(chainIdToNetworkID[network.chainId])
    const deployedForwarder = config.contracts.TestForwarder
    ForwarderAddress = deployedForwarder.address
  }
  TypedData.domain.chainId = network.chainId
  TypedData.domain.verifyingContract = ForwarderAddress

  // Get nonce for current signer
  const forwarder = new ethers.Contract(ForwarderAddress, ForwarderAbi, provider)
  const nonce = await forwarder.getNonce(from).then((nonce) => nonce.toString())

  const data = (await Promise.resolve(unsentAction)).encodeABI()

  // Encode meta-tx request
  const request = {
    from,
    to: contractAddress,
    value: 0,
    gas: MAX_GAS,
    nonce,
    data,
  }
  const toSign = {...TypedData, message: request}

  // Directly call the JSON RPC interface, since ethers does not support signTypedDataV4 yet
  // See https://github.com/ethers-io/ethers.js/issues/830
  const signature = await provider.send("eth_signTypedData_v4", [from, JSON.stringify(toSign)])

  const response = await fetch(RELAY_URLS[network.chainId], {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({...request, signature}),
  }).then(
    (r) => r.json(),
    (e) => e.json()
  )

  return response
}

export {submitGaslessTransaction}
