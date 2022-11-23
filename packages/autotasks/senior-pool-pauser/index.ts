import {ethers} from "ethers"
import {Relayer} from "defender-relay-client"
import {DefenderRelaySigner, DefenderRelayProvider} from "defender-relay-client/lib/ethers"
import {Contract} from "@ethersproject/contracts"

const CONFIG = {
  mainnet: "0x8481a6EbAf5c7DABc3F7e09e44A89531fd31F822",
}

// Entrypoint for the Autotask
exports.handler = async function (credentials) {
  const relayer = new Relayer(credentials)
  const provider = new DefenderRelayProvider(credentials)
  const signer = new DefenderRelaySigner(credentials, provider, {speed: "fast"})
  const relayerInfo = await relayer.getRelayer()
  console.log(`Assessing using ${relayerInfo.name} on ${relayerInfo.network} `)
  const pauseAbi = [
    {
      inputs: [],
      name: "pause",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function",
    },
    {
      inputs: [],
      name: "unpause",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function",
    },
    {
      inputs: [],
      name: "paused",
      outputs: [
        {
          internalType: "bool",
          name: "",
          type: "bool",
        },
      ],
      stateMutability: "view",
      type: "function",
    },
  ]
  const seniorPool = new ethers.Contract(CONFIG[relayerInfo.network], pauseAbi, signer)
  await togglePause(seniorPool)
}

export async function togglePause(contract: Contract): Promise<void> {
  if (await contract.paused()) {
    await contract.unpause()
  } else {
    await contract.pause()
  }
}

// To run locally (this code will not be executed in Autotasks)
// Invoke with: API_KEY=<key> API_SECRET=<secret> node autotasks/assessor/dist/index.js
if (require.main === module) {
  const {API_KEY: apiKey, API_SECRET: apiSecret} = process.env
  exports
    .handler({apiKey, apiSecret})
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
}
