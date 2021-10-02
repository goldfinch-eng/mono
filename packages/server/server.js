const {findEnvLocal} = require("@goldfinch-eng/utils")
require("dotenv").config({path: findEnvLocal()})

const express = require("express")
const cors = require("cors")
const {relayHandler} = require("@goldfinch-eng/autotasks")
const BN = require("bn.js")

const {fundWithWhales} = require("@goldfinch-eng/protocol/blockchain_scripts/mainnetForkingHelpers")

const app = express()
app.use(express.json())
app.use(cors())

const port = process.env.RELAY_SERVER_PORT

app.post("/relay", relayHandler)

app.post("/fundWithWhales", async (req, res) => {
  const {address} = req.body
  await fundWithWhales(["USDT", "BUSD", "ETH", "USDC"], [address], new BN("75000"))
  res.status(200).send({status: "success", result: JSON.stringify({})})
})

app.listen(port, () => {
  console.log(`App listening at http://localhost:${port}`)
})
