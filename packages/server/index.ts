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
import {uniqueIdentitySignerHandler} from "@goldfinch-eng/autotasks"

import {fundWithWhales} from "@goldfinch-eng/protocol/blockchain_scripts/helpers/fundWithWhales"
import {
  setUpForTesting,
  fundFromLocalWhale,
  getERC20s,
  addUserToGoList,
  fundUser,
  createPoolAndFundWithSenior,
} from "@goldfinch-eng/protocol/blockchain_scripts/setUpForTesting"
import {lockTranchedPool} from "@goldfinch-eng/protocol/blockchain_scripts/lockTranchedPool"
import {hardhat as hre} from "@goldfinch-eng/protocol"
import {advanceTime, mineBlock} from "@goldfinch-eng/protocol/test/testHelpers"
import {
  assertIsChainId,
  isMainnetForking,
  LOCAL_CHAIN_ID,
} from "@goldfinch-eng/protocol/blockchain_scripts/deployHelpers"
import admin, {firestore} from "firebase-admin"

import {getDb, getUsers} from "@goldfinch-eng/functions/db"

const app = express()
app.use(express.json())
app.use(cors())

const PORT = 4000

app.post("/uniqueIdentitySigner", uniqueIdentitySignerHandler)

app.post("/fundWithWhales", async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(404).send({message: "fundWithWhales only available on local and murmuration"})
  }

  try {
    const {address} = req.body
    console.log(`🐳 fundWithWhales isMainnetForking:${isMainnetForking()}`)
    if (isMainnetForking()) {
      await fundWithWhales(["USDT", "BUSD", "ETH", "USDC"], [address], 75000, {
        logger: (...args) => {
          console.log(...args)
        },
      })
    } else {
      const chainId = await hre.getChainId()
      assertIsChainId(chainId)

      if (chainId === LOCAL_CHAIN_ID) {
        const {erc20s} = await getERC20s({chainId, hre})
        await fundFromLocalWhale(address, erc20s, {
          logger: (...args) => {
            console.log(...args)
          },
        })
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

app.post("/lockTranchedPool", async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(404).send({message: "lockTranchedPool only available on local and murmuration"})
  }

  try {
    const {tranchedPoolAddress} = req.body
    await lockTranchedPool(hre, tranchedPoolAddress)
  } catch (e) {
    console.error("lockTranchedPool error", e)
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
      logger: (...args) => {
        console.log(...args)
      },
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

app.post("/advanceTimeThirtyDays", async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(404).send({message: "advanceTimeThirtyDays only available on local and murmuration"})
  }

  try {
    await advanceTime({days: 30})
    await mineBlock()
  } catch (e) {
    console.error("advanceTimeThirtyDays error", e)
    return res.status(500).send({message: "advanceTimeThirtyDays error"})
  }

  return res.status(200).send({status: "success", result: JSON.stringify({success: true})})
})

app.post("/setupCurrentUser", async (req, res) => {
  const {address} = req.body

  await addUserToGoList(address)
  await fundUser(address)

  return res.status(200).send({status: "success", result: JSON.stringify({success: true})})
})

admin.initializeApp({projectId: "goldfinch-frontends-dev"})

app.post("/drainSeniorPool", async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(404).send({message: "drainSeniorPool not available in production"})
  }

  const {usdcAmount} = req.body
  console.log("server got usdc amount")
  console.log(usdcAmount)
  const poolAddress = await createPoolAndFundWithSenior(hre, usdcAmount)

  return res.status(200).send({status: "success", result: JSON.stringify({success: true, pool: poolAddress})})
})

app.post("/kycStatus", async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(404).send({message: "kycStatus only available on local and murmuration"})
  }

  const {address, countryCode, kycStatus} = req.body
  const db = getDb(admin.firestore())
  const userRef = getUsers(admin.firestore()).doc(`${address.toLowerCase()}`)
  const residency = req.body.residency ?? (countryCode.toLowerCase() === "us" ? "us" : "non-us")

  try {
    await db.runTransaction(async (t: firestore.Transaction) => {
      const doc = await t.get(userRef)

      if (doc.exists) {
        t.update(userRef, {
          persona: {
            id: "fake",
            status: kycStatus,
          },
          countryCode: countryCode,
          kyc: {
            residency,
          },
          updatedAt: Date.now(),
        })
      } else {
        t.set(userRef, {
          address: address,
          persona: {
            id: "fake",
            status: kycStatus,
          },
          countryCode: countryCode,
          kyc: {
            residency,
          },
          updatedAt: Date.now(),
        })
      }
    })
  } catch (e) {
    console.error("kycStatus error", e)
    return res.status(500).send({status: "error", message: (e as Error)?.message})
  }

  return res.status(200).send({status: "success"})
})

app.listen(PORT, () => {
  console.log(`App listening at http://localhost:${PORT}`)
})
