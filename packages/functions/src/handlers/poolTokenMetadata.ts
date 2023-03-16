import {ethers} from "ethers"
import {assertNonNullable, INVALID_POOLS} from "@goldfinch-eng/utils"
import {Response} from "@sentry/serverless/dist/gcpfunction/general"
import {genRequestHandler} from "../helpers"
import POOL_METADATA from "@goldfinch-eng/pools/metadata/mainnet.json"
import {GraphQLClient} from "graphql-request"
import {getSdk} from "../graphql/generated/graphql"
import {BigNumber} from "bignumber.js"
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import {createSVGWindow} from "svgdom"
import {SVG, registerWindow, Container} from "@svgdotjs/svg.js"

const BASE_URLS = {
  prod: "https://us-central1-goldfinch-frontends-prod.cloudfunctions.net",
  dev: "https://us-central1-goldfinch-frontends-dev.cloudfunctions.net",
  local: "http://localhost:5001/goldfinch-frontends-dev/us-central1",
}

// these pool tokens are associated in invalid pools (see INVALID_POOLS for
// complete list). Sometimes this endpoint is queried for these tokens. The
// subgraph will fail on that query because of the invalid pool, so we fail
// fast to avoid the error.
const INVALID_POOL_TOKENS: Record<string, string> = {
  "3": "0x95715d3dcbb412900deaf91210879219ea84b4f8",
  "4": "0x0e2e11dc77bbe75b2b65b57328a8e4909f7da1eb",
  "5": "0x7bdf2679a9f3495260e64c0b9e0dfeb859bad7e0",
  "6": "0x4b2ae066681602076adbe051431da7a3200166fd",
  "12": "0xfce88c5d0ec3f0cb37a044738606738493e9b450",
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
  const metadata: TranchedPoolMetadata = POOL_METADATA[addr as keyof typeof POOL_METADATA]
  metadataStore[addr.toLowerCase()] = metadata
})

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
  | "LAST_UPDATED_AT"
type TokenAttribute = {type: AttributeType; value: string}

const isTermStarted = (termEndTime: BigNumber) => termEndTime.toNumber() !== 0

/**
 * Get attributes for a given PoolToken token ID. These attributes are used in
 * the PoolToken's metadata endpoint, as well as a dynamic SVG image.
 * @param {string} tokenId PoolToken token ID
 * @return {Array<TokenAttribute>} A list of attributes
 */
async function getTokenAttributes(tokenId: number): Promise<Array<TokenAttribute>> {
  const client = new GraphQLClient("https://api.thegraph.com/subgraphs/name/pugbyte/goldfinch")
  const sdk = getSdk(client)

  const graphQlResponse = await sdk.poolTokenMetadata({id: tokenId.toString()})
  const {poolToken} = graphQlResponse

  assertNonNullable(poolToken, `Token ID ${tokenId} not found in subgraph`)
  const {loan} = poolToken

  const poolId = loan.id.toLowerCase()
  const poolMetadata = INVALID_POOLS.has(poolId) ? {name: "invalid", borrowerName: "invalid"} : metadataStore[poolId]
  assertNonNullable(poolMetadata, `Pool ${loan.id} not found`)

  const now = new Date()
  const nowSinceEpoch = Math.floor(now.getTime() / 1000)
  const termEndTime = new BigNumber(loan.termEndTime.toString())
  const termRemainingInSeconds = termEndTime.minus(nowSinceEpoch).toNumber()
  const secondsInDay = 60 * 60 * 24
  const termRemainingInDays = Math.max(0, Math.floor(termRemainingInSeconds / secondsInDay))
  const backerApr = new BigNumber(loan.usdcApy.toString())

  const totalLoanSize = ethers.BigNumber.from(loan.principalAmount).isZero()
    ? new BigNumber(loan.fundingLimit.toString()).dividedBy(1e6)
    : new BigNumber(ethers.BigNumber.from(loan.principalAmount).toString()).dividedBy(1e6)

  const nextRepaymentDate =
    isTermStarted(termEndTime) && !ethers.BigNumber.from(loan.nextDueTime).isZero()
      ? new Date(ethers.BigNumber.from(loan.nextDueTime).toNumber() * 1000)
      : undefined

  const principalAmount = new BigNumber(poolToken.principalAmount.toString())
  const monthlyInterestPayment = principalAmount.multipliedBy(backerApr).dividedBy(12)

  const totalAmountRepaid = new BigNumber(poolToken.loan.principalAmountRepaid.toString()).plus(
    new BigNumber(poolToken.loan.interestAmountRepaid.toString()),
  )

  return [
    {
      type: "POOL_NAME",
      value: poolMetadata.name,
    },
    {
      type: "POOL_ADDRESS",
      value: loan.id,
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
      value: loan.repaymentFrequency.toString(),
    },
    {
      type: "PAYMENT_TERM",
      value: `${Math.ceil(loan.termInSeconds / secondsInDay)} days`,
    },
    {
      type: "TERM_REMAINING",
      value: isTermStarted(termEndTime) ? `${termRemainingInDays} days` : "Not started",
    },
    {
      type: "TOTAL_AMOUNT_REPAID",
      value: `$${doubleDigitFormatter.format(totalAmountRepaid.dividedBy(1e6).toNumber())}`,
    },
    {
      type: "NEXT_REPAYMENT_DATE",
      value: nextRepaymentDate?.toISOString() || "N/A",
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
    const tokenIdString = req.path.split("/").pop()
    if (!tokenIdString) {
      return res.status(400).send({status: "error", message: "Missing token ID"})
    }
    if (isNaN(Number(tokenIdString))) {
      return res.status(400).send({status: "error", message: "Token ID must be a number"})
    }
    if (INVALID_POOL_TOKENS[tokenIdString]) {
      return res.status(404).send({status: "error", message: "Requesting token for invalid pool"})
    }

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
      "LAST_UPDATED_AT",
    ]
    const attributeTypeToValue: Partial<Record<AttributeType, string>> = {}
    attributes.forEach(({type, value}) => {
      attributeTypeToValue[type] = value
    })

    const formattedAttributes = formatForImageUri(
      attributesToDisplay
        .filter((type) => {
          const valueExists = !!attributeTypeToValue[type]

          // If you're seeing this error, then `getTokenAttributes` is missing a value that
          // `attributesToDisplay` expects to display
          if (!valueExists) console.error(`Pool token image is missing a value for type ${type}`)

          return valueExists
        })
        .map((type) => ({
          type: type,
          // Typescript can't infer that `attributeTypeToValue[type]` is valid, so we have to `|| ""`
          value: attributeTypeToValue[type] || "",
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
