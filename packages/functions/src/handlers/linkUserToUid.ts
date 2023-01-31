import * as Sentry from "@sentry/serverless"
import * as admin from "firebase-admin"
import {Response} from "@sentry/serverless/dist/gcpfunction/general"
import {getDb, getUsers} from "../db"
import {genRequestHandler, getBlockchain, extractHeaderValue} from "../helpers"
import {ethers, BigNumber} from "ethers"
import {
  assertNonNullable,
  assertNumber,
  isApprovedNonUSEntity,
  isApprovedUSAccreditedEntity,
  isApprovedUSAccreditedIndividual,
  presignedMintMessage,
  presignedMintToMessage,
  UNIQUE_IDENTITY_SIGNER_MAINNET_ADDRESS,
  validateUidType,
} from "@goldfinch-eng/utils"
import firestore = admin.firestore
import type {UniqueIdentity} from "@goldfinch-eng/protocol/typechain/ethers/contracts/protocol/core/UniqueIdentity"
import UNIQUE_IDENTITY_MAINNET_DEPLOYMENT from "@goldfinch-eng/protocol/deployments/mainnet/UniqueIdentity.json"
import {KycProvider} from "../types"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let deployedDevABIs: any
try {
  deployedDevABIs = require("@goldfinch-eng/protocol/deployments/all_dev.json")
  // eslint-disable-next-line no-empty
} catch (_) {}

const getUniqueIdentityDeployment = (chainId: number) => {
  if (chainId === 1) {
    return UNIQUE_IDENTITY_MAINNET_DEPLOYMENT
  } else {
    return deployedDevABIs?.[chainId]?.[0]?.contracts?.["UniqueIdentity"]
  }
}

/**
 * Throw when a user does not exist when it was expected to exist during a link KYC request.
 */
class NonExistingUserError extends Error {}

/**
 * Throw when an existing UID already exists for a user during a link KYC request.
 */
class ExistingUidRecipientAddressError extends Error {}

const UNIT_TESTING_SIGNER = "0xc34461018f970d343d5a25e4Ed28C4ddE6dcCc3F"
const MURMURATION_AND_DEV_SIGNER = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266"
let ALLOWED_SIGNERS: string[]
if (process.env.NODE_ENV == "test") {
  ALLOWED_SIGNERS = [UNIT_TESTING_SIGNER, UNIQUE_IDENTITY_SIGNER_MAINNET_ADDRESS]
} else if (process.env.MURMURATION === "yes" || process.env.LOCAL === "yes") {
  ALLOWED_SIGNERS = [UNIQUE_IDENTITY_SIGNER_MAINNET_ADDRESS, MURMURATION_AND_DEV_SIGNER]
} else {
  ALLOWED_SIGNERS = [UNIQUE_IDENTITY_SIGNER_MAINNET_ADDRESS]
}

/**
 * Link the provided user's address to their intended UID recipient address.
 * The returned presigned message can be used immediately mint a new UID of the specified type.
 * We want to prevent individual, KYC'ed users from minting multiple UID's of the same type.
 * For this reason, we must prevents users with existing UID's or unexpired UID presigned messages from being linked to new UID's.
 * @param { { address: string, abi: any }? } injectedUidDeployment The specified UniqueIdentity contract deployment, try to determine automatically from the chain ID otherwise.
 * @return {HttpsFunction} Https function that handles the request
 */
export const genLinkKycWithUidDeployment = (injectedUidDeployment?: {
  address: string
  abi: ethers.ContractInterface
}) => {
  return genRequestHandler({
    fallbackOnMissingPlaintext: false,
    requireAuth: "signatureWithAllowList",
    signatureMaxAge: 3600, // 5 minutes
    signerAllowList: ALLOWED_SIGNERS,
    cors: false,
    handler: async (req, res): Promise<Response> => {
      const {expiresAt, nonce} = req.body
      const uidType = BigNumber.from(req.body.uidType)
      const msgSender = req.body.msgSender?.toLowerCase()
      const explicitMintToAddress = req.body.mintToAddress?.toLowerCase()

      const blockchain = await getBlockchain("https://app.goldfinch.finance")
      const network = await blockchain.getNetwork()

      const uidDeployment = injectedUidDeployment ?? getUniqueIdentityDeployment(network.chainId)

      assertNonNullable(uidDeployment)
      assertNonNullable(msgSender)
      assertNonNullable(uidType)
      assertNonNullable(expiresAt)
      assertNonNullable(nonce)
      assertNumber(expiresAt)
      validateUidType(uidType.toNumber())

      const currentBlockchainTime = (await blockchain.getBlock("latest")).timestamp

      if (expiresAt < currentBlockchainTime) {
        return res.status(400).send({status: "error", message: "Signature has expired"})
      }

      const uid = new ethers.Contract(uidDeployment.address, uidDeployment.abi, blockchain) as unknown as UniqueIdentity

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

      const isUsAccredited = isApprovedUSAccreditedEntity(msgSender) || isApprovedUSAccreditedIndividual(msgSender)
      const isParallelMarketsUser = isApprovedNonUSEntity(msgSender) || isUsAccredited
      try {
        await db.runTransaction(async (t: firestore.Transaction) => {
          const user = await t.get(userRef)
          let userExists: boolean = user.exists
          // Parallel Markets users will usually not exist in Firestore at this point in the KYC process (barring manual intervention or error cases)
          // ^ This would be resolved as part of GFI-266
          // Users w/o a defined kycProvider are legacy Persona users who should be backfilled.
          if (isParallelMarketsUser) {
            const userData: {address: string; kycProvider: string; countryCode?: string} = {
              address: msgSender,
              kycProvider: KycProvider.ParallelMarkets.valueOf(),
            }
            if (isUsAccredited) {
              userData.countryCode = "US"
            }
            user.exists ? t.update(userRef, userData) : t.set(userRef, userData)
            userExists = true
          }

          if (!userExists) {
            throw new NonExistingUserError(`User with address ${msgSender} not found`)
          }

          const existingUidRecipientAddress = user.data()?.uidRecipientAuthorizations?.[uidTypeId]?.toLowerCase()
          const lastUidSignatureExpiry = user.data()?.lastUidSignatureExpiresAt
          const lastUidSignatureExpired = !lastUidSignatureExpiry || lastUidSignatureExpiry < currentBlockchainTime

          if (
            existingUidRecipientAddress &&
            existingUidRecipientAddress !== uidRecipientAddress &&
            !lastUidSignatureExpired
          ) {
            throw new ExistingUidRecipientAddressError(
              `Address ${msgSender} has already been linked to a different UID recipient address ${existingUidRecipientAddress}. Can link a different UID recipient address when the original signature expires.`,
            )
          }

          t.update(userRef, {
            uidRecipientAuthorizations: {
              [uidTypeId]: uidRecipientAddress.toLowerCase(),
            },
            lastUidSignatureExpiresAt: expiresAt,
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

export const linkUserToUid = genLinkKycWithUidDeployment()
