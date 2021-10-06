import fs from "fs"
import hre from "hardhat"
const {deployments} = hre
const {ethers} = hre
import {Block} from "@ethersproject/abstract-provider"
import {getDeployedContract, TRANCHES, USDCDecimals} from "./deployHelpers"
import {TranchedPool} from "../typechain/ethers"
import {getAgreements, getUsers} from "@goldfinch-eng/functions/db"

import admin from "firebase-admin"
import {assertNonNullable} from "@goldfinch-eng/utils"
import {BigNumber} from "bignumber.js"
import {BigNumberish} from "ethers"

function usdcFromAtomic(amount: BigNumberish) {
  return new BigNumber(String(amount)).div(USDCDecimals.toString()).toString(10)
}

/**
 * Pull backer data for a specific pool. This script outputs a JSON file in the current directory
 * called `backer-data.json`. This can be piped into jq to output a CSV.
 */
async function main() {
  assertNonNullable(process.env.FIREBASE_ACCOUNT_KEYS_FILE, "FIREBASE_ACCOUNT_KEYS_FILE envvar is required")
  assertNonNullable(process.env.POOL, "POOL envvar is required")

  const poolAddress = process.env.POOL

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const serviceAccount = require(process.env.FIREBASE_ACCOUNT_KEYS_FILE)
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  })

  const tranchedPool = ((await getDeployedContract(deployments, "TranchedPool")) as TranchedPool).attach(poolAddress)

  const filter = tranchedPool.filters.DepositMade(null, TRANCHES.Junior)
  const events = await tranchedPool.queryFilter(filter)

  const blocks: {[blockNumber: number]: Block} = {}

  console.log(`Processing ${events.length} backers`)
  const backerInfo = await Promise.all(
    events.map(async (e) => {
      const addr = e.args.owner
      const amount = e.args.amount

      console.log("Processing backer", addr)

      let block = blocks[e.blockNumber]
      if (!block) {
        block = await ethers.provider.getBlock(e.blockNumber)
        blocks[block.number] = block
      }

      const agreements = getAgreements(admin.firestore())
      const key = `${tranchedPool.address.toLowerCase()}-${addr.toLowerCase()}`
      const agreement = await agreements.doc(key).get()
      const fullName = agreement.data()?.fullName

      const users = getUsers(admin.firestore())
      const user = await users.doc(`${addr.toLowerCase()}`).get()

      return {
        address: addr,
        countryCode: user.data()?.countryCode,
        amount: usdcFromAtomic(amount.toString()),
        secondsSinceEpoch: block.timestamp,
        timestamp: String(new Date(block.timestamp * 1000)),
        fullName: fullName,
      }
    })
  )

  await fs.promises.writeFile("backer-data.json", JSON.stringify(backerInfo, null, 2))
  // The JSON file can now be processed into a CSV using jq:
  // cat backer-data.json | jq -r '(map(keys) | add | unique) as $cols | map(. as $row | $cols | map($row[.])) as $rows | $cols, $rows[] | @csv' > backer-data.csv
}

if (require.main === module) {
  // If this is run as a script, then call main. If it's imported (for tests), this block will not run
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
}

export default main
