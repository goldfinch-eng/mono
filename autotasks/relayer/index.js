const ethers = require("ethers")
const relay = require("./relay").relay
const ForwarderAbi = require("./Forwarder.json")
const {Relayer} = require("defender-relay-client")
const {DefenderRelaySigner, DefenderRelayProvider} = require("defender-relay-client/lib/ethers")

const ALLOWED_SENDERS = {
  4: ["0xE7f9ED35DA54b2e4A1857487dBf42A32C4DBD4a0", "0x3FeB1094eE48DB0B9aC25b82A3A34ABe16208590"],
  1: [
    "0xBAc2781706D0aA32Fb5928c9a5191A13959Dc4AE", // Blake
    "0x8652854C25bd553d522d118AC2bee6FFA3Cce317", // Luis (Quickcheck)
    "0x0333119c9688Eb0c7805454cf5e101b883FD1BFa", // Mike
    "0x3FeB1094eE48DB0B9aC25b82A3A34ABe16208590", // Sanjay
    "0xeF3fAA47e1b0515f640c588a0bc3D268d5aa29B9", // Mark
    "0x139C9c156D049dd002b04A6471D3DE0AD1eAb256", // Andrew
    "0x1F666ca6CeE68F6AfdD3eC0670A40a54F88c8E64", // Obinna
    "0x4bBD638eb377ea00b84fAc2aA24A769a1516eCb6", // Almavest
    "0xbD04f16cdd0e7E1ed8E4382AAb3f0F7B17672DdC", // Aspire
    "0x69f7A8242ecBDac84b05FD80DA9631E5d659F690", // Sam
    "0xd4ad17f7F7f62915A1F225BB1CB88d2492F89769", // Ian
  ],
}

const ALLOWED_CONTRACTS = {
  4: ["0x84Cba6A96C7B1f2301f228C730672B2cA31f0Cb5", "0xC926fb67A27d3A8f1964fD9a14b3ACa8b295DC7D"],
  1: [
    "0xB7cEaCEB71267C21eF09076F68A3Fd3775fED4DF", // Blake
    "0x927E1e532d25958c1C8CD4908ab8D1b27D3978e8", // Luis (Quickcheck)
    "0xCcf4A39C3485D156EAdA0315Ac0554Cc4e488a89", // Mike
    "0x3100720AEeFED70Cf0A840C8a0dd3c75Eec232F9", // Sanjay
    "0x06483d98798dfFC23FABCc3ecd5a789e089e8CE2", // Mark
    "0x998659b29Dd4Acda770c9ad8f0d495EaaA833b76", // Andrew
    "0xEb734fa493bA766BAFcc6d89F0d52434CcF9187D", // Obinna
    "0x0136173C1dD2AC3aCAE9ae6469Da78Dd66849DcF", // Almavest
    "0x61544699Ae36fE72e3Efa5045E55A9c7e607E950", // Aspire
    "0x9331Fb2d7EdB11C6dDa0d625B59eB7dDb506A355", // Sam
    "0x65F9a32D80E8763756E8b0eb78E63cD334498230", // Ian
  ],
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
