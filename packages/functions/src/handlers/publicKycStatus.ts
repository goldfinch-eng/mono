import * as Sentry from "@sentry/serverless"
import {Request, Response} from "@sentry/serverless/dist/gcpfunction/general"
import {genRequestHandler} from "../helpers"
import {getUsers} from "../db/db"

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

    Sentry.setUser({id: address.toLowerCase(), address})

    const users = getUsers()
    const user = await users.doc(`${address.toLowerCase()}`).get()

    if (!user.exists) {
      return res.status(404).send({message: "Not found"})
    }

    const userData = user.data()

    if (!userData) {
      return res.status(404).send({message: "Not found"})
    }

    if (userData.kycProvider === "parallelMarkets") {
      const {identityExpiresAt, accreditationExpiresAt} = userData.parallelMarkets
      return res.status(200).send({
        ...(identityExpiresAt && {identityExpiresAt}),
        ...(accreditationExpiresAt && {accreditationExpiresAt}),
      })
    } else {
      return res.status(200).send({})
    }
  },
})
