import {Request, Response} from "@sentry/serverless/dist/gcpfunction/general"
import {getAgreements} from "../db"
import {genRequestHandler} from "../helpers"
import * as admin from "firebase-admin"
import isEmail from "validator/lib/isEmail"

// signAgreement is used to be shared with the borrowers
export const signAgreement = genRequestHandler({
  requireAuth: "none",
  cors: true,
  handler: async (req: Request, res: Response): Promise<Response> => {
    const addressHeader = req.headers["x-goldfinch-address"]
    const address = Array.isArray(addressHeader) ? addressHeader.join("") : addressHeader
    const pool = (req.body.pool || "").trim()

    if (!address) {
      return res.status(403).send({error: "Invalid address"})
    }
    const fullName = (req.body.fullName || "").trim()
    const email = (req.body.email || "").trim()

    if (pool === "") {
      return res.status(400).send({error: "Invalid pool address"})
    }

    if (fullName === "") {
      return res.status(400).send({error: "Invalid full name"})
    }

    if (!isEmail(email) || email === "") {
      return res.status(400).send({error: "Invalid email address"})
    }

    const agreements = getAgreements(admin.firestore())
    const key = `${pool.toLowerCase()}-${address.toLowerCase()}`
    const agreement = await agreements.doc(key)
    await agreement.set({
      address,
      pool,
      fullName,
      email,
      signedAt: Date.now(),
    })
    return res.status(200).send({status: "success"})
  },
})
