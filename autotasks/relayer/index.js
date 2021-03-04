const ethers = require("ethers")
const relay = require("./relay").relay
const ForwarderAbi = require("./Forwarder.json")
const {Relayer} = require("defender-relay-client")
const {DefenderRelaySigner, DefenderRelayProvider} = require("defender-relay-client/lib/ethers")

const ALLOWED_SENDERS = {
  4: "0xE7f9ED35DA54b2e4A1857487dBf42A32C4DBD4a0",
}

const ALLOWED_CONTRACTS = {
  4: "0x84Cba6A96C7B1f2301f228C730672B2cA31f0Cb5",
}

const FORWARDER_ADDRESS = {
  4: "0x956868751Cc565507B3B58E53a6f9f41B56bed74",
  1: "0xa530F85085C6FE2f866E7FdB716849714a89f4CD",
}

// This will need to be updated if the forwarder address changes or the forward request type changes.
// Check the server.js on how this is calculated
const DOMAIN_SEPARATOR = {
  1: "0x636c8d5cc60b1b87713357a2cab5a99419318b318015738880e557e4a6f16d7f",
  4: "0xd8f4a5d52f3a3cda60774fb6efa0dc496380a66839eb524f5613de676bbb265c",
}

async function handler(event) {
  // Parse webhook payload
  if (!event.request || !event.request.body) throw new Error("Missing payload")
  // console.log("Relaying", event.request)

  // Initialize Relayer provider and signer, and forwarder contract
  const credentials = {...event}
  const provider = new DefenderRelayProvider(credentials)
  const signer = new DefenderRelaySigner(credentials, provider, {speed: "fast"})
  const relayer = new Relayer(credentials)

  const network = await provider.getNetwork()
  console.log(`On Network: ${network.name} (${network.chainId})`)

  const context = {
    chainId: network.chainId,
    forwarder: new ethers.Contract(FORWARDER_ADDRESS[network.chainId], ForwarderAbi, signer),
    allowed_senders: ALLOWED_SENDERS[network.chainId],
    allowed_contracts: ALLOWED_CONTRACTS[network.chainId],
    domain_separator: DOMAIN_SEPARATOR[network.chainId],
    relayTx: async (txData) => {
      return await relayer.sendTransaction(txData)
    },
  }

  // Relay transaction!
  const tx = await relay(event.request.body, context)
  console.log(`Sent meta-tx: ${tx.hash}`)
  return {txHash: tx.hash}
}

module.exports = {
  handler,
  relay,
}
