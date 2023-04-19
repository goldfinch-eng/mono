import {Request, Response} from "@sentry/serverless/dist/gcpfunction/general"
import {genRequestHandler} from "../helpers"
import {getUsers} from "../db"
import * as admin from "firebase-admin"

export type DocumentExpiryStatusResponse = {
  identityExpiresAt?: number
  accreditationExpiresAt?: number
}

// A version of kycStatus that doesn't require a signature and doesn't expose any PII
export const publicKycStatus = genRequestHandler({
  requireAuth: "none",
  cors: true,
  handler: async (req: Request, res: Response): Promise<Response> => {
    const address = req.query.address as string
    if (!address) {
      return res.status(400).send({message: "Missing address from request query parameters"})
    }

    const users = getUsers(admin.firestore())
    const user = await users.doc(`${address.toLowerCase()}`).get()

    if (!user.exists) {
      return res.status(404).send({message: "Not found"})
    }

    const data = user.data()
    const parallelMarkets = data?.parallelMarkets
    // We have this check here for typescript, but if we've already validated that the user exists
    // then the data is guaranteed to be there
    if (!parallelMarkets) {
      return res.status(200).send({})
    }

    const {identityExpiresAt, accreditationExpiresAt} = parallelMarkets
    return res.status(200).send({
      ...(identityExpiresAt && {identityExpiresAt}),
      ...(accreditationExpiresAt && {accreditationExpiresAt}),
    })
  },
})
