const {findEnvLocal} = require("@goldfinch-eng/utils")
require("dotenv").config({path: findEnvLocal()})

const express = require("express")
const cors = require("cors")
const app = express()
const {relay} = require("./relayer/relay")
const hre = require("hardhat")
const {TypedDataUtils} = require("eth-sig-util")
const {bufferToHex} = require("ethereumjs-util")

const port = process.env.RELAY_SERVER_PORT
const FORWARDER_ADDRESS = process.env.FORWARDER_ADDRESS
const ALLOWED_SENDERS = (process.env.ALLOWED_SENDERS || "").split(",").filter((val) => !!val)

app.use(express.json())
app.use(cors())

async function hardhatRelay(txData) {
  const {protocol_owner} = await hre.getNamedAccounts()
  const signer = (await hre.ethers.getSigners()).find((signer) => signer.address === protocol_owner)
  console.log(`Sending: ${JSON.stringify(txData)}`)
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

const relayHandler = async (req, res) => {
  try {
    console.log(`Forwarding: ${JSON.stringify(req.body)}`)
    const context = await createContext()
    const tx = await relay(req.body, context)
    res.status(200).send({status: "success", result: JSON.stringify(tx)})
  } catch (error) {
    console.log(`Failed: ${error}`)
    res.status(500).send({status: "error", message: error.toString()})
  }
}

app.post("/relay", relayHandler)

app.listen(port, () => {
  console.log(`App listening at http://localhost:${port}`)
})
