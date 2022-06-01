import ethers from "ethers"
import {relay} from "./relay"
import ForwarderAbi from "./Forwarder.json"
import {Relayer} from "defender-relay-client"
import {DefenderRelaySigner, DefenderRelayProvider} from "defender-relay-client/lib/ethers"
import {HandlerParams} from "../types"

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
    "0x9892245a6A6A0706bF10a59129ba9CBf0e1033e3", // Tugende
    "0xD677476BeF65Fa6B3AaB8Defeb0E5bFD69848036", // Divibank
    "0xFF27f53fdEC54f2077F80350c7011F76f84f9622", // Cauris Metamask
    "0xA8Bd929a04C1E67E5aB03C40e70E2f83238986B6", // Cauris (Use this as borrower EOA)
    "0x26b36FB2a3Fd28Df48bc1B77cDc2eCFdA3A5fF9D", // Stratos EOA
    "0xb2A3D20999975E31727890c5084CC4A9458740F0", // LendEast metamask
    "0xEF1A2cBbFE289bA586db860CfE360058ac3944E7", // Addem Capital EOA
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

async function handler(event: HandlerParams) {
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

export {handler, relay}
