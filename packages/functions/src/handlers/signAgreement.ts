import {Request, Response} from "@sentry/serverless/dist/gcpfunction/general"
import {getAgreements} from "../db"
import {genRequestHandler} from "../helpers"
import * as admin from "firebase-admin"

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

    if (pool === "" || fullName === "") {
      return res.status(403).send({error: "Invalid name or pool"})
    }

    const agreements = getAgreements(admin.firestore())
    const key = `${pool.toLowerCase()}-${address.toLowerCase()}`
    const agreement = await agreements.doc(key)
    await agreement.set({
      address: address,
      pool: pool,
      fullName: fullName,
      signedAt: Date.now(),
    })
    return res.status(200).send({status: "success"})
  },
})
