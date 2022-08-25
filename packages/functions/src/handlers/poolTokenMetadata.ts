import {ethers} from "ethers"
import {assertNonNullable, INVALID_POOLS} from "@goldfinch-eng/utils"
import {Response} from "@sentry/serverless/dist/gcpfunction/general"
import {genRequestHandler, getBlockchain} from "../helpers"
import POOL_METADATA from "@goldfinch-eng/pools/metadata/mainnet.json"
import {GraphQLClient} from "graphql-request"
import {getSdk, PoolTokenMetadataQuery} from "../graphql/generated/graphql"
import {BigNumber} from "bignumber.js"
import type {GoldfinchConfig} from "@goldfinch-eng/protocol/typechain/ethers/GoldfinchConfig"
import GOLDFINCH_CONFIG_DEPLOYMENT from "@goldfinch-eng/protocol/deployments/mainnet/GoldfinchConfig.json"
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import {createSVGWindow} from "svgdom"
import {SVG, registerWindow, Container} from "@svgdotjs/svg.js"

// Ideally we would import from CONFIG_KEYS in @goldfinch-eng/protocol
// but importing a typescript file causes build to fail with this error:
//
//   "It appears your code is written in Typescript, which must be compiled before emulation."
//
// Hardcoding for now.
const LATENESS_GRACE_PERIOD_CONFIG_KEY = 5

const BASE_URLS = {
  prod: "https://us-central1-goldfinch-frontends-prod.cloudfunctions.net",
  dev: "https://us-central1-goldfinch-frontends-dev.cloudfunctions.net",
  local: "http://localhost:5001/goldfinch-frontends-dev/us-central1",
}

const percentageFormatter = new Intl.NumberFormat("en-US", {
  style: "percent",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const doubleDigitFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})

type TranchedPoolMetadata = typeof POOL_METADATA[keyof typeof POOL_METADATA]
interface TranchedPoolMetadataStore {
  [address: string]: TranchedPoolMetadata
}
const metadataStore: TranchedPoolMetadataStore = {}
Object.keys(POOL_METADATA).forEach((addr) => {
  if (addr === "default") {
    return
  }
  const metadata: TranchedPoolMetadata = (POOL_METADATA as any)[addr]
  metadataStore[addr.toLowerCase()] = metadata
})

/**
 * Calculate net asset value for a given pool token
 * @param {PoolTokenMetadataQuery} poolToken Query result from goldfinch subgraph
 * @return {BigNumber} NAV
 */
async function calculateNAV(poolToken: NonNullable<PoolTokenMetadataQuery["tranchedPoolToken"]>) {
  const principalAmount = new BigNumber(poolToken.principalAmount.toString())
  const principalRedeemed = new BigNumber(poolToken.principalRedeemed.toString())
  const principalRedeemable = new BigNumber(poolToken.principalRedeemable.toString())

  const nav = principalAmount.minus(principalRedeemed).minus(principalRedeemable)

  return nav
}

type AttributeType =
  | "POOL_NAME"
  | "POOL_ADDRESS"
  | "BORROWER_NAME"
  | "BACKER_POSITION_PRINCIPAL"
  | "BACKER_POSITION_NAV"
  | "MONTHLY_INTEREST_PAYMENT"
  | "USDC_INTEREST_RATE"
  | "TOTAL_LOAN_SIZE"
  | "PAYMENT_FREQUENCY"
  | "PAYMENT_TERM"
  | "TERM_REMAINING"
  | "TOTAL_AMOUNT_REPAID"
  | "NEXT_REPAYMENT_DATE"
  | "PAYMENT_STATUS"
  | "LAST_UPDATED_AT"
type TokenAttribute = {type: AttributeType; value: string}

/**
 * Get attributes for a given PoolToken token ID. These attributes are used in
 * the PoolToken's metadata endpoint, as well as a dynamic SVG image.
 * @param {string} tokenId PoolToken token ID
 * @return {Array<TokenAttribute>} A list of attributes
 */
async function getTokenAttributes(tokenId: number): Promise<Array<TokenAttribute>> {
  const client = new GraphQLClient("https://api.thegraph.com/subgraphs/name/goldfinch-eng/goldfinch-v2")
  const sdk = getSdk(client)

  const provider = getBlockchain("https://app.goldfinch.finance")
  const goldfinchConfig = new ethers.Contract(
    GOLDFINCH_CONFIG_DEPLOYMENT.address,
    GOLDFINCH_CONFIG_DEPLOYMENT.abi,
    provider,
  ) as unknown as GoldfinchConfig
  const latenessGracePeriodInDays = await goldfinchConfig.getNumber(LATENESS_GRACE_PERIOD_CONFIG_KEY)

  const graphQlResponse = await sdk.poolTokenMetadata({id: tokenId.toString()})
  const {tranchedPoolToken} = graphQlResponse

  assertNonNullable(tranchedPoolToken, `Token ID ${tokenId} not found in subgraph`)
  const {tranchedPool} = tranchedPoolToken

  const poolId = tranchedPool.id.toLowerCase()
  const poolMetadata = INVALID_POOLS.has(poolId) ? {name: "invalid", borrowerName: "invalid"} : metadataStore[poolId]
  assertNonNullable(poolMetadata, `Pool ${tranchedPool.id} not found`)

  const now = new Date()
  const nowSinceEpoch = Math.floor(now.getTime() / 1000)
  const termEndTime = new BigNumber(tranchedPool.creditLine.termEndTime.toString())
  const termRemainingInSeconds = termEndTime.minus(nowSinceEpoch).toNumber()
  const secondsInDay = 60 * 60 * 24
  const termRemainingInDays = Math.max(0, Math.floor(termRemainingInSeconds / secondsInDay))
  const backerApr = new BigNumber(tranchedPool.estimatedJuniorApy.toString())

  const totalLoanSize = new BigNumber(tranchedPool.creditLine.limit.toString()).dividedBy(1e6)

  const nextRepaymentDate = new Date(ethers.BigNumber.from(tranchedPool.creditLine.nextDueTime).toNumber() * 1000)

  const principalAmount = new BigNumber(tranchedPoolToken.principalAmount.toString())
  const nav = await calculateNAV(tranchedPoolToken)
  const monthlyInterestPayment = principalAmount.multipliedBy(backerApr).dividedBy(12)

  const totalAmountRepaid = new BigNumber(tranchedPoolToken.tranchedPool.principalAmountRepaid.toString()).plus(
    new BigNumber(tranchedPoolToken.tranchedPool.interestAmountRepaid.toString()),
  )

  const lastFullPaymentTimeInSeconds = new BigNumber(tranchedPool.creditLine.lastFullPaymentTime.toString()).toNumber()
  const latenessGracePeriodInSeconds = new BigNumber(latenessGracePeriodInDays.toString()).toNumber() * secondsInDay
  const isLate = nowSinceEpoch > lastFullPaymentTimeInSeconds + latenessGracePeriodInSeconds
  const paymentStatus = isLate ? "Late" : "Current"

  return [
    {
      type: "POOL_NAME",
      value: poolMetadata.name,
    },
    {
      type: "POOL_ADDRESS",
      value: tranchedPool.id,
    },
    {
      type: "BORROWER_NAME",
      value: poolMetadata.borrowerName,
    },
    {
      type: "BACKER_POSITION_PRINCIPAL",
      value: `$${doubleDigitFormatter.format(principalAmount.dividedBy(1e6).toNumber())}`,
    },
    {
      type: "BACKER_POSITION_NAV",
      value: `$${doubleDigitFormatter.format(nav.dividedBy(1e6).toNumber())}`,
    },
    {
      type: "MONTHLY_INTEREST_PAYMENT",
      value: `$${doubleDigitFormatter.format(monthlyInterestPayment.dividedBy(1e6).toNumber())}`,
    },
    {
      type: "USDC_INTEREST_RATE",
      value: `${percentageFormatter.format(backerApr.toNumber())}`,
    },
    {
      type: "TOTAL_LOAN_SIZE",
      value: `$${doubleDigitFormatter.format(totalLoanSize.toNumber())}`,
    },
    {
      type: "PAYMENT_FREQUENCY",
      value: `${new BigNumber(tranchedPool.creditLine.paymentPeriodInDays.toString()).toNumber()} days`,
    },
    {
      type: "PAYMENT_TERM",
      value: `${new BigNumber(tranchedPool.creditLine.termInDays.toString()).toNumber()} days`,
    },
    {
      type: "TERM_REMAINING",
      value: termEndTime.toNumber() === 0 ? "Not started" : `${termRemainingInDays} days`,
    },
    {
      type: "TOTAL_AMOUNT_REPAID",
      value: `$${doubleDigitFormatter.format(totalAmountRepaid.dividedBy(1e6).toNumber())}`,
    },
    {
      type: "NEXT_REPAYMENT_DATE",
      value: nextRepaymentDate.toISOString(),
    },
    {
      type: "PAYMENT_STATUS",
      value: paymentStatus,
    },
    {
      type: "LAST_UPDATED_AT",
      value: now.toISOString(),
    },
  ]
}

/**
 * Format a list of TokenAttribute for the token metadata URI
 * @param {Array<TokenAttribute>} attributes array of TokenAttribute
 * @return {Array<{trait_type: string, value: string}>} array of attributes in the opensea metadata standard format
 */
function formatForMetadataUri(attributes: Array<TokenAttribute>) {
  const formatMap: Record<AttributeType, string> = {
    POOL_NAME: "Pool Name",
    POOL_ADDRESS: "Pool Address",
    BORROWER_NAME: "Borrower Name",
    BACKER_POSITION_PRINCIPAL: "Backer Position Principal",
    BACKER_POSITION_NAV: "Backer Position NAV",
    MONTHLY_INTEREST_PAYMENT: "Backer Position Monthly Interest Payment",
    USDC_INTEREST_RATE: "USDC Interest Rate",
    TOTAL_LOAN_SIZE: "Total Loan Size",
    PAYMENT_FREQUENCY: "Payment Frequency",
    PAYMENT_TERM: "Payment Term",
    TERM_REMAINING: "Term Remaining",
    TOTAL_AMOUNT_REPAID: "Total Amount Repaid",
    NEXT_REPAYMENT_DATE: "Next Repayment Date",
    PAYMENT_STATUS: "Payment Status",
    LAST_UPDATED_AT: "Last Updated At",
  }

  return attributes.map(({type, value}) => ({
    trait_type: formatMap[type],
    value,
  }))
}

/**
 * Format a list of TokenAttribute for use in SVG image
 * @param {Array<TokenAttribute>} attributes array of TokenAttribute
 * @return {Array<{trait_type: string, value: string}>} Formatted attributes
 */
function formatForImageUri(attributes: Array<TokenAttribute>) {
  const formatMap: Record<AttributeType, string> = {
    POOL_NAME: "Pool",
    POOL_ADDRESS: "Pool Address",
    BORROWER_NAME: "Borrower",
    BACKER_POSITION_PRINCIPAL: "Principal",
    BACKER_POSITION_NAV: "NAV",
    MONTHLY_INTEREST_PAYMENT: "Monthly Interest Payment",
    USDC_INTEREST_RATE: "USDC Interest Rate",
    TOTAL_LOAN_SIZE: "Total Loan Size",
    PAYMENT_FREQUENCY: "Payment Frequency",
    PAYMENT_TERM: "Payment Term",
    TERM_REMAINING: "Term Remaining",
    TOTAL_AMOUNT_REPAID: "Total Amount Repaid",
    NEXT_REPAYMENT_DATE: "Next Repayment Date",
    PAYMENT_STATUS: "Payment Status",
    LAST_UPDATED_AT: "Updated At",
  }

  return attributes.map(({type, value}) => ({
    type: formatMap[type],
    value,
  }))
}

/**
 * Construct the URL that serves a given token's SVG image
 * @param {number} tokenId Token ID
 * @return {string} Fully qualified image URL
 */
function imageUrl({tokenId}: {tokenId: number}): string {
  let imageBaseUrl: string
  if (process.env.GCLOUD_PROJECT === "goldfinch-frontends-prod") {
    imageBaseUrl = BASE_URLS.prod
  } else if (process.env.GCLOUD_PROJECT === "goldfinch-frontends-dev" && process.env.FUNCTIONS_EMULATOR === "true") {
    imageBaseUrl = BASE_URLS.local
  } else if (process.env.GCLOUD_PROJECT === "goldfinch-frontends-dev") {
    imageBaseUrl = BASE_URLS.dev
  } else {
    throw new Error("Unknown runtime environment")
  }
  return `${imageBaseUrl}/poolTokenImage/${tokenId}`
}

/**
 * Returns metadata in the opensea metadata standard for a given PoolToken.
 * This endpoint has routing, so a valid request would be `/poolTokenMetadata/<token-id>`.
 */
export const poolTokenMetadata = genRequestHandler({
  requireAuth: "none",
  cors: false,
  handler: async (req, res): Promise<Response> => {
    const pathComponents = req.path.split("/")
    const tokenIdString = pathComponents[pathComponents.length - 1]
    assertNonNullable(tokenIdString, "Token ID not found")
    const tokenId = parseInt(tokenIdString)

    const image = imageUrl({tokenId})

    const attributes = await getTokenAttributes(tokenId)

    const tokenMetadata = {
      name: tokenIdString,
      image,
      external_url: "https://app.goldfinch.finance",
      attributes: formatForMetadataUri(attributes),
    }

    return res.status(200).send(tokenMetadata)
  },
})

/**
 * Returns a dynamic SVG image for a given PoolToken.
 * This endpoint has routing, so a valid request would be `/poolTokenImage/<token-id>`.
 */
export const poolTokenImage = genRequestHandler({
  requireAuth: "none",
  cors: false,
  handler: async (req, res): Promise<Response> => {
    const pathComponents = req.path.split("/")
    const tokenIdString = pathComponents[pathComponents.length - 1]
    assertNonNullable(tokenIdString, "Token ID not found")
    const tokenId = parseInt(tokenIdString)

    const attributes = await getTokenAttributes(tokenId)

    const window = createSVGWindow()
    const document = window.document
    registerWindow(window, document)

    // eslint-disable-next-line new-cap
    const container = SVG(document.documentElement) as Container
    const draw = container.size(720, 720)
    draw.rect(720, 720).fill({color: "#483E5E"})
    const nested = draw

    const attributesToDisplay: Array<AttributeType> = [
      "POOL_NAME",
      "BORROWER_NAME",
      "BACKER_POSITION_PRINCIPAL",
      "USDC_INTEREST_RATE",
      "MONTHLY_INTEREST_PAYMENT",
      "PAYMENT_FREQUENCY",
      "TERM_REMAINING",
      "TOTAL_LOAN_SIZE",
      "TOTAL_AMOUNT_REPAID",
      "PAYMENT_STATUS",
      "LAST_UPDATED_AT",
    ]
    const attributeTypeToValue: {[traitType: string]: any} = {}
    attributes.forEach(({type, value}) => {
      attributeTypeToValue[type] = value
    })

    const formattedAttributes = formatForImageUri(
      attributesToDisplay.map((type) => ({
        type: type,
        value: attributeTypeToValue[type],
      })),
    )

    nested
      .text((t) => {
        t.tspan("\n")
        formattedAttributes.forEach(({type, value}) => {
          if (type === "Pool") {
            t.tspan(`${value}`).newLine()
          } else {
            t.tspan(`${type}: ${value}`).newLine()
          }
        })
      })
      .font({family: "sans-serif", size: 33})
      .fill("#FFFFFF")
      .leading(1.45)
      .dx(16)

    res.set("Content-Type", "image/svg+xml")
    return res.status(200).send(draw.svg())
  },
})
