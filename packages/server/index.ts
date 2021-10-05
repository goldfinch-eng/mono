import {findEnvLocal} from "@goldfinch-eng/utils"
import dotenv from "dotenv"
dotenv.config({path: findEnvLocal()})

import express from "express"
import cors from "cors"
import {relayHandler} from "@goldfinch-eng/autotasks"
import BN from "bn.js"

import {fundWithWhales} from "@goldfinch-eng/protocol/blockchain_scripts/mainnetForkingHelpers"

const app = express()
app.use(express.json())
app.use(cors())

const port = process.env.RELAY_SERVER_PORT

app.post("/relay", relayHandler)

app.post("/fundWithWhales", async (req, res) => {
  if (process.env.NODE_ENV !== "development" && process.env.MURMURATION !== "yes") {
    return res.status(404).send({message: "fundWithWhales only available on local and murmuration"})
  }

  const {address} = req.body
  await fundWithWhales(["USDT", "BUSD", "ETH", "USDC"], [address], new BN("75000"))
  res.status(200).send({status: "success", result: JSON.stringify({success: true})})
})

app.listen(port, () => {
  console.log(`App listening at http://localhost:${port}`)
})
