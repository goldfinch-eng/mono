import fs from "fs"
import hre from "hardhat"
import axios from "axios"
const {deployments} = hre
const {ethers} = hre
import {Block} from "@ethersproject/abstract-provider"
import {getDeployedContract, TRANCHES, USDCDecimals} from "./deployHelpers"
import {TranchedPool} from "../typechain/ethers"
import {getAgreements, getUsers} from "./helpers/db"

import admin from "firebase-admin"
import {assertNonNullable} from "@goldfinch-eng/utils"
import {BigNumber} from "bignumber.js"
import {BigNumberish} from "ethers"
import _ from "lodash"
const PERSONA_BASE_URL = "https://withpersona.com/api/v1"
const PERSONA_API_KEY = process.env.PERSONA_API_KEY
if (!PERSONA_API_KEY) {
  throw new Error("Persona API key required. Set with PERSONA_API_KEY={Your Key}")
}
const PERSONA_HEADERS = {
  Accept: "application/json",
  "Persona-Version": "2021-05-14",
  Authorization: `Bearer ${PERSONA_API_KEY}`,
}

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
  assertNonNullable(process.env.ALCHEMY_API_KEY, "ALCHEMY_API_KEY is required")

  // Use AlchemyProvider directly to bypass hardhat's global timeout on provider
  const provider = new ethers.providers.AlchemyProvider("mainnet", process.env.ALCHEMY_API_KEY)

  const poolAddress = process.env.POOL

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const serviceAccount = require(process.env.FIREBASE_ACCOUNT_KEYS_FILE)
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  })

  const tranchedPool = ((await getDeployedContract(deployments, "TranchedPool")) as TranchedPool).attach(poolAddress)

  const depositFilter = tranchedPool.filters.DepositMade(null, TRANCHES.Junior)
  const withdrawFilter = tranchedPool.filters.WithdrawalMade(null, TRANCHES.Junior)
  const depositEvents = await tranchedPool.queryFilter(depositFilter)
  const withdrawEvents = await tranchedPool.queryFilter(withdrawFilter)

  type genericEvent = {
    blockNumber: number
    args: {owner: string; amount?: BigNumber; interestWithdrawn?: BigNumber; principalWithdrawn?: BigNumber}
  }
  const events = _.concat(depositEvents as unknown, withdrawEvents as unknown) as genericEvent[]

  const combined = _.map(
    _.groupBy(events, (e) => e.args.owner),
    (grouped) => {
      assertNonNullable(grouped[0])
      const result: genericEvent = {blockNumber: 0, args: {owner: grouped[0].args.owner, amount: new BigNumber(0)}}
      grouped.forEach((e) => {
        assertNonNullable(result.args.amount)
        if (e.args.amount) {
          result.args.amount = result.args.amount.plus(String(e.args.amount))
          result.blockNumber = e.blockNumber
        } else if (e.args.principalWithdrawn) {
          result.args.amount = result.args.amount.minus(String(e.args.principalWithdrawn))
        }
      })
      return result
    }
  ).filter((e) => e.args.amount?.gt(new BigNumber(0)))

  const blocks: {[blockNumber: number]: Block} = {}

  console.log(`Processing ${events.length} backers`)
  const backerInfo = await Promise.all(
    combined.map(async (e) => {
      const addr = e.args.owner
      const amount = e.args.amount
      assertNonNullable(amount)

      console.log("Processing backer", addr)

      let block = blocks[e.blockNumber]
      if (!block) {
        block = await provider.getBlock(e.blockNumber)
        blocks[block.number] = block
      }

      const agreements = getAgreements(admin.firestore())
      const key = `${tranchedPool.address.toLowerCase()}-${addr.toLowerCase()}`
      const agreement = await agreements.doc(key).get()
      const fullName = agreement.data()?.fullName
      const email = agreement.data()?.email

      const users = getUsers(admin.firestore())
      const user = await users.doc(`${addr.toLowerCase()}`).get()
      const personaInquiryId = user.data()?.persona?.id
      let emailFromPersona
      if (personaInquiryId) {
        const response = await axios.get(`${PERSONA_BASE_URL}/inquiries/${personaInquiryId}`, {
          headers: PERSONA_HEADERS,
        })
        emailFromPersona = response.data.data.attributes.emailAddress
      }

      return {
        address: addr,
        countryCode: user.data()?.countryCode,
        amount: usdcFromAtomic(amount.toString()),
        secondsSinceEpoch: block.timestamp,
        timestamp: String(new Date(block.timestamp * 1000)),
        fullName: fullName,
        emailAddress: email !== "" && email != null ? email : emailFromPersona,
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
