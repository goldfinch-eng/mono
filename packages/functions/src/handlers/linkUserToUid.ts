import * as Sentry from "@sentry/serverless"
import * as admin from "firebase-admin"
import {Response} from "@sentry/serverless/dist/gcpfunction/general"
import {getDb, getUsers} from "../db"
import {genRequestHandler, getBlockchain, extractHeaderValue} from "../helpers"
import {ethers, BigNumber} from "ethers"
import {
  assertNonNullable,
  presignedMintMessage,
  presignedMintToMessage,
  UNIQUE_IDENTITY_SIGNER_MAINNET_ADDRESS,
  validateUidType,
} from "@goldfinch-eng/utils"
import firestore = admin.firestore
import type {UniqueIdentity} from "@goldfinch-eng/protocol/typechain/ethers/UniqueIdentity"
import UNIQUE_IDENTITY_DEPLOYMENT from "@goldfinch-eng/protocol/deployments/mainnet/UniqueIdentity.json"

// This is an address for which we have a valid signature, used for
// unit testing
const UNIT_TESTING_SIGNER = "0xc34461018f970d343d5a25e4Ed28C4ddE6dcCc3F"

/**
 * Throw when a user does not exist when it was expected to exist during a link KYC request.
 */
class NonExistingUserError extends Error {}

/**
 * Throw when an existing UID already exists for a user during a link KYC request.
 */
class ExistingUidRecipientAddressError extends Error {}

/**
 * Link the provided user's address to their intended UID recipient address.
 * Prevents users with existing UID's (owned on chain or linked in Firestore) from being linked to new UID's.
 * @param { { address: string, abi: any } } uniqueIdentityDeployment The UniqueIdentity contract deployment.
 * @return {HttpsFunction} Https function that handles the request
 */
export const genLinkKycWithUidDeployment = (uniqueIdentityDeployment: {address: string; abi: any}) => {
  return genRequestHandler({
    fallbackOnMissingPlaintext: false,
    requireAuth: "signatureWithAllowList",
    signatureMaxAge: 3600, // 5 minutes
    signerAllowList:
      process.env.NODE_ENV === "test"
        ? [UNIT_TESTING_SIGNER, UNIQUE_IDENTITY_SIGNER_MAINNET_ADDRESS]
        : [UNIQUE_IDENTITY_SIGNER_MAINNET_ADDRESS],
    cors: false,
    handler: async (req, res): Promise<Response> => {
      const {expiresAt, nonce} = req.body
      const uidType = BigNumber.from(req.body.uidType)
      const msgSender = req.body.msgSender?.toLowerCase()
      const explicitMintToAddress = req.body.mintToAddress?.toLowerCase()

      assertNonNullable(msgSender)
      assertNonNullable(uidType)
      assertNonNullable(expiresAt)
      assertNonNullable(nonce)
      validateUidType(uidType.toNumber())

      const blockchain = await getBlockchain("https://app.goldfinch.finance")
      const network = await blockchain.getNetwork()

      if (expiresAt < (await blockchain.getBlock("latest")).timestamp) {
        return res.status(400).send({status: "error", message: "Signature has expired"})
      }

      const uid = new ethers.Contract(
        uniqueIdentityDeployment.address,
        uniqueIdentityDeployment.abi,
        blockchain,
      ) as unknown as UniqueIdentity

      let expectedPresignedMessage
      if (explicitMintToAddress) {
        expectedPresignedMessage = presignedMintToMessage(
          msgSender,
          explicitMintToAddress,
          uidType,
          expiresAt,
          uid.address,
          nonce,
          network.chainId,
        )
      } else {
        expectedPresignedMessage = presignedMintMessage(
          msgSender,
          uidType,
          expiresAt,
          uid.address,
          nonce,
          network.chainId,
        )
      }

      const uidRecipientAddress = explicitMintToAddress || msgSender

      if (
        expectedPresignedMessage.toString() != extractHeaderValue(req, "x-goldfinch-signature-plaintext")?.toString()
      ) {
        return res.status(400).send({status: "error", message: "Presigned message does not match params."})
      }

      // Having verified the request, we can set the Sentry user context accordingly.
      Sentry.setUser({id: msgSender})

      const existingUidRecipentBalance: number = (
        await uid.balanceOf(uidRecipientAddress || msgSender, uidType)
      ).toNumber()
      const existingMsgSenderBalance: number = (await uid.balanceOf(msgSender, uidType)).toNumber()

      // Implicitly, UniqueIdentity smart contract will not allow a UID recipient to receive a UID when they already have one of this type.
      // Prevent a user from arbitrarily overwriting their UID mapping.
      if (existingUidRecipentBalance > 0) {
        return res.status(400).send({
          status: "error",
          message: `UID recipient address ${uidRecipientAddress} already owns a UID of type ${uidType}`,
        })
      }

      if (existingMsgSenderBalance > 0) {
        return res.status(400).send({
          status: "error",
          message: `User with address ${msgSender} already owns a UID of type ${uidType}`,
        })
      }

      const db = getDb(admin.firestore())
      const userRef = getUsers(admin.firestore()).doc(`${msgSender.toLowerCase()}`)
      const uidTypeId = uidType.toString()
      try {
        await db.runTransaction(async (t: firestore.Transaction) => {
          const user = await t.get(userRef)
          if (!user.exists) {
            throw new NonExistingUserError(`User with address ${msgSender} not found`)
          }

          const existingUidRecipientAddress = user.data()?.uidRecipientAuthorizations?.[uidTypeId]?.toLowerCase()
          if (existingUidRecipientAddress && existingUidRecipientAddress !== uidRecipientAddress) {
            throw new ExistingUidRecipientAddressError(
              `Address ${msgSender} has already been linked to a different UID recipient address ${existingUidRecipientAddress}`,
            )
          }

          t.update(userRef, {
            uidRecipientAuthorizations: {
              [uidTypeId]: uidRecipientAddress.toLowerCase(),
            },
            updatedAt: Date.now(),
          })
        })
      } catch (e) {
        console.error(e)
        switch (true) {
          case e instanceof NonExistingUserError:
            return res.status(404).send({status: "error", message: (e as Error)?.message})
          case e instanceof ExistingUidRecipientAddressError:
            return res.status(400).send({status: "error", message: (e as Error)?.message})
          default:
            return res.status(500).send({status: "error", message: (e as Error)?.message})
        }
      }

      return res.status(200).send({
        status: "success",
        message: `User's address ${msgSender} is linked to the ${uidRecipientAddress} UID recipient address.`,
      })
    },
  })
}

export const linkUserToUid = genLinkKycWithUidDeployment({
  address: UNIQUE_IDENTITY_DEPLOYMENT.address,
  abi: UNIQUE_IDENTITY_DEPLOYMENT.abi,
})
