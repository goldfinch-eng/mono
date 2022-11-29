import {ethers} from "ethers"
import {DefenderRelaySigner, DefenderRelayProvider} from "defender-relay-client/lib/ethers"
import baseHandler from "../core/handler"

import {ERC20Splitter} from "@goldfinch-eng/protocol/typechain/ethers"
import {HandlerParams} from "../types"

import ERC20SplitterDeployment from "@goldfinch-eng/protocol/deployments/mainnet/ERC20Splitter.json"
export const ERC20_SPLITTER_ABI = ERC20SplitterDeployment.abi
export const ERC20_SPLITTER_MAINNET_ADDRESS = "0xE2da0Cf4DCEe902F74D4949145Ea2eC24F0718a4"

exports.handler = baseHandler("reserve-distributor", async (event: HandlerParams) => {
  const credentials = {...event}
  const provider = new DefenderRelayProvider(credentials)
  const signer = new DefenderRelaySigner(credentials, provider, {speed: "fast"})
  const splitter = new ethers.Contract(ERC20_SPLITTER_MAINNET_ADDRESS, ERC20_SPLITTER_ABI, signer) as ERC20Splitter
  return await main({splitter})
})

export async function main({splitter}: {splitter: ERC20Splitter}) {
  await splitter.distribute()
}
