import {findEnvLocal, assertNonNullable} from "@goldfinch-eng/utils"
import dotenv from "dotenv"
dotenv.config({path: findEnvLocal()})

import {relay} from "./relayer/relay"
import * as uniqueIdentitySigner from "./unique-identity-signer"
import {hardhat as hre} from "@goldfinch-eng/protocol"
import {TypedDataUtils} from "eth-sig-util"
import {bufferToHex} from "ethereumjs-util"
import {UniqueIdentity} from "@goldfinch-eng/protocol/typechain/ethers"

assertNonNullable(
  process.env.FORWARDER_ADDRESS,
  "FORWARDER_ADDRESS must be passed as an envvar when running the development server"
)

const FORWARDER_ADDRESS = process.env.FORWARDER_ADDRESS
const ALLOWED_SENDERS = (process.env.ALLOWED_SENDERS || "").split(",").filter((val) => !!val)

async function hardhatRelay(txData) {
  const {protocol_owner} = await hre.getNamedAccounts()
  const signer = (await hre.ethers.getSigners()).find((signer) => signer.address === protocol_owner)
  console.log(`Sending: ${JSON.stringify(txData)}`)
  assertNonNullable(signer)
  const result = await signer.sendTransaction({to: txData.to, data: txData.data})
  console.log(`Result: ${JSON.stringify(result)}`)
  return result
}

function calculateDomainSeparator(chainId, forwarderAddress) {
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
      chainId: chainId,
      verifyingContract: forwarderAddress,
    },
    primaryType: "ForwardRequest",
    types: {
      EIP712Domain: EIP712DomainType,
      ForwardRequest: ForwardRequestType,
    },
    message: {},
  }
  return bufferToHex(TypedDataUtils.hashStruct("EIP712Domain", TypedData.domain, TypedData.types))
}

async function createContext() {
  const {ethers, deployments} = hre
  const {getOrNull} = deployments

  const deployed = await getOrNull("TestForwarder")
  assertNonNullable(deployed)
  assertNonNullable(FORWARDER_ADDRESS)
  const forwarder = await ethers.getContractAt(deployed.abi, FORWARDER_ADDRESS)
  const chainId = await hre.getChainId()
  return {
    chainId: chainId,
    forwarder: forwarder,
    allowed_senders: ALLOWED_SENDERS,
    relayTx: hardhatRelay,
    domain_separator: calculateDomainSeparator(chainId, forwarder.address),
  }
}

export async function relayHandler(req, res) {
  try {
    console.log(`Forwarding: ${JSON.stringify(req.body)}`)
    const context = await createContext()
    const tx = await relay(req.body, context)
    res.status(200).send({status: "success", result: JSON.stringify(tx)})
  } catch (error: any) {
    console.log(`Failed: ${error}`)
    res.status(500).send({status: "error", message: error.toString()})
  }
}

export async function uniqueIdentitySignerHandler(req, res) {
  try {
    console.log(`Forwarding: ${JSON.stringify(req.body)}`)

    // Set up params / dependencies for handler logic
    const deployment = await hre.deployments.get("UniqueIdentity")
    const uniqueIdentity = (await hre.ethers.getContractAt(deployment.abi, deployment.address)) as UniqueIdentity
    const signer = uniqueIdentity.signer
    assertNonNullable(signer.provider, "Signer provider is null")
    const network = await signer.provider.getNetwork()

    // Run handler
    const result = await uniqueIdentitySigner.main({headers: req.headers, signer, network, uniqueIdentity})
    res.status(200).send({status: "success", result: JSON.stringify(result)})
  } catch (error: any) {
    console.log(`Failed: ${error}`)
    res.status(500).send({status: "error", message: error.toString()})
  }
}
