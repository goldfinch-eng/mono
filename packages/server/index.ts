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
import setUpForTesting from "@goldfinch-eng/protocol/deploy/setUpForTesting"
import {hardhat as hre} from "@goldfinch-eng/protocol"

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
    await fundWithWhales(["USDT", "BUSD", "ETH", "USDC"], [address], new BN("75000"))
  } catch (e) {
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
    return res.status(500).send({message: "setupForTesting error"})
  }

  return res.status(200).send({status: "success", result: JSON.stringify({success: true})})
})

app.listen(port, () => {
  console.log(`App listening at http://localhost:${port}`)
})
