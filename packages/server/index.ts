/*

Dedicated node service for handling custom backend routes that also has access to the Hardhat instance.

Hardhat: In ../server/package.json and ../autotasks/package.json we using the "--network localhost" arguments to start a Hardhat Network, and expose it as a JSON-RPC and WebSocket server
https://hardhat.org/hardhat-network/#running-stand-alone-in-order-to-support-wallets-and-other-software

New routes: be sure to update the webpack proxy
packages/client/config-overrides.js

*/
import {findEnvLocal} from "@goldfinch-eng/utils"
import dotenv from "dotenv"
dotenv.config({path: findEnvLocal()})

import express from "express"
import cors from "cors"
import {relayHandler} from "@goldfinch-eng/autotasks"
import BN from "bn.js"
import hre from "hardhat"
import "hardhat-deploy"

import {fundWithWhales} from "@goldfinch-eng/protocol/blockchain_scripts/mainnetForkingHelpers"
import setUpForTesting from "@goldfinch-eng/protocol/deploy/setUpForTesting"

const app = express()
app.use(express.json())
app.use(cors())

const port = process.env.RELAY_SERVER_PORT

app.post("/relay", relayHandler)

app.post("/fundWithWhales", async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(404).send({message: "fundWithWhales only available on local and murmuration"})
  }

  const {address} = req.body
  await fundWithWhales(["USDT", "BUSD", "ETH", "USDC"], [address], new BN("75000"))
  res.status(200).send({status: "success", result: JSON.stringify({success: true})})
})

app.post("/setupForTesting", async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(404).send({message: "setupForTesting only available on local and murmuration"})
  }
  const {address} = req.body
  const {getNamedAccounts, deployments, getChainId} = hre

  try {
    await setUpForTesting({getNamedAccounts, deployments, getChainId}, {overrideAddress: address})
  } catch (e) {
    return res.status(404).send({message: "setupForTesting error"})
  }

  res.status(200).send({status: "success", result: JSON.stringify({success: true})})
})

app.listen(port, () => {
  console.log(`App listening at http://localhost:${port}`)
})
