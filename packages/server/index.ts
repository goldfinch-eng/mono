/*

Dedicated node service for handling custom backend routes that also has access to the Hardhat instance.

Hardhat: In ../server/package.json and ../autotasks/package.json we using the "--network localhost" arguments to start a Hardhat Network, and expose it as a JSON-RPC and WebSocket server
https://hardhat.org/hardhat-network/#running-stand-alone-in-order-to-support-wallets-and-other-software

New routes: be sure to update the webpack proxy
packages/client/config-overrides.js

*/
import {assertNonNullable, findEnvLocal} from "@goldfinch-eng/utils"
import dotenv from "dotenv"
dotenv.config({path: findEnvLocal()})

import express from "express"
import cors from "cors"
import {relayHandler, uniqueIdentitySignerHandler} from "@goldfinch-eng/autotasks"
import BN from "bn.js"

import {fundWithWhales} from "@goldfinch-eng/protocol/blockchain_scripts/mainnetForkingHelpers"
import {
  setUpForTesting,
  fundFromLocalWhale,
  getERC20s,
} from "@goldfinch-eng/protocol/blockchain_scripts/setUpForTesting"
import {hardhat as hre} from "@goldfinch-eng/protocol"
import {advanceTime, mineBlock} from "@goldfinch-eng/protocol/test/testHelpers"
import {
  assertIsChainId,
  isMainnetForking,
  LOCAL_CHAIN_ID,
} from "@goldfinch-eng/protocol/blockchain_scripts/deployHelpers"

const app = express()
app.use(express.json())
app.use(cors())

assertNonNullable(
  process.env.RELAY_SERVER_PORT,
  "RELAY_SERVER_PORT must be passed as an envvar when running the development server"
)
const port = process.env.RELAY_SERVER_PORT

app.post("/relay", relayHandler)
app.post("/unique-identity-signer", uniqueIdentitySignerHandler)

app.post("/fundWithWhales", async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(404).send({message: "fundWithWhales only available on local and murmuration"})
  }

  try {
    const {address} = req.body
    if (isMainnetForking()) {
      await fundWithWhales(["USDT", "BUSD", "ETH", "USDC"], [address], new BN("75000"))
    } else {
      const chainId = await hre.getChainId()
      assertIsChainId(chainId)

      if (chainId === LOCAL_CHAIN_ID) {
        const {erc20s} = await getERC20s({chainId, hre})
        await fundFromLocalWhale(address, erc20s, hre)
      } else {
        throw new Error(`Unexpected chain id: ${chainId}`)
      }
    }
  } catch (e) {
    console.error("fundWithWhales error", e)
    return res.status(500).send({message: "fundWithWhales error"})
  }

  return res.status(200).send({status: "success", result: JSON.stringify({success: true})})
})

app.post("/setupForTesting", async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(404).send({message: "setupForTesting only available on local and murmuration"})
  }

  try {
    const {address} = req.body
    await setUpForTesting(hre, {
      overrideAddress: address,
    })
  } catch (e) {
    console.error("setupForTesting error", e)
    return res.status(500).send({message: "setupForTesting error"})
  }

  return res.status(200).send({status: "success", result: JSON.stringify({success: true})})
})

app.post("/advanceTimeOneDay", async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(404).send({message: "advanceTimeOnDay only available on local and murmuration"})
  }

  try {
    await advanceTime({days: 1})
    await mineBlock()
  } catch (e) {
    console.error("advanceTimeOneDay error", e)
    return res.status(500).send({message: "advanceTimeOneDay error"})
  }

  return res.status(200).send({status: "success", result: JSON.stringify({success: true})})
})

app.listen(port, () => {
  console.log(`App listening at http://localhost:${port}`)
})
