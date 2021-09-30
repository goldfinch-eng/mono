const {findEnvLocal} = require("@goldfinch-eng/utils")
require("dotenv").config({path: findEnvLocal()})

const express = require("express")
const cors = require("cors")
const {relayHandler} = require("@goldfinch-eng/autotasks")

const app = express()
app.use(express.json())
app.use(cors())

const port = process.env.RELAY_SERVER_PORT

app.post("/relay", relayHandler)

app.listen(port, () => {
  console.log(`App listening at http://localhost:${port}`)
})
