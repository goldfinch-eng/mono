import {assertNonNullable} from "@goldfinch-eng/utils"
import {Response} from "@sentry/serverless/dist/gcpfunction/general"
import {genRequestHandler} from "../helpers"
import {GraphQLClient} from "graphql-request"
import {getSdk} from "../graphql/generated/graphql"
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import {createSVGWindow} from "svgdom"
import {SVG, registerWindow, Container} from "@svgdotjs/svg.js"
import BigNumber from "bignumber.js"

const BASE_URLS = {
  prod: "https://us-central1-goldfinch-frontends-prod.cloudfunctions.net",
  dev: "https://us-central1-goldfinch-frontends-dev.cloudfunctions.net",
  local: "http://localhost:5001/goldfinch-frontends-dev/us-central1",
}

type AttributeType = "ID" | "INITIAL_AMOUNT" | "AMOUNT" | "POSITION_TYPE" | "TOTAL_REWARDS_CLAIMED"
type TokenAttribute = {type: AttributeType; value: string}

export const FIDU_DECIMAL_PLACES = 18
export const FIDU_DECIMALS = new BigNumber(String(10 ** FIDU_DECIMAL_PLACES))

const doubleDigitFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})

/**
 * Get attributes for a given StakingRewards token ID. These attributes are used in
 * the StakingRewardsToken's metadata endpoint, as well as a dynamic SVG image
 * @param {string} tokenId StakingRewardsToken token ID
 * @return {Array<TokenAttribute>} A list of attributes
 */
async function getTokenAttributes(tokenId: number): Promise<Array<TokenAttribute>> {
  const client = new GraphQLClient("https://api.thegraph.com/subgraphs/name/pugbyte/goldfinch")
  const sdk = getSdk(client)

  const graphQlResponse = await sdk.stakingRewardsTokenMetadata({id: tokenId.toString()})
  const {seniorPoolStakedPosition} = graphQlResponse
  assertNonNullable(seniorPoolStakedPosition, `Token ID ${tokenId} not found in subgraph`)

  return [
    {
      type: "ID",
      value: seniorPoolStakedPosition.id,
    },
    {
      type: "INITIAL_AMOUNT",
      value: `${doubleDigitFormatter.format(
        new BigNumber(seniorPoolStakedPosition.initialAmount.toString()).div(1e18).toNumber(),
      )}`,
    },
    {
      type: "AMOUNT",
      value: `${doubleDigitFormatter.format(
        new BigNumber(seniorPoolStakedPosition.amount.toString()).div(1e18).toNumber(),
      )}`,
    },
    {
      type: "POSITION_TYPE",
      value: seniorPoolStakedPosition.positionType,
    },
    {
      type: "TOTAL_REWARDS_CLAIMED",
      value: `${seniorPoolStakedPosition.totalRewardsClaimed}`,
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
    ID: "ID",
    INITIAL_AMOUNT: "Initial Amount",
    AMOUNT: "Amount",
    POSITION_TYPE: "Position Type",
    TOTAL_REWARDS_CLAIMED: "Total Rewards Claimed",
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
    ID: "Goldfinch Staked Token ID",
    INITIAL_AMOUNT: "Initial Amount",
    AMOUNT: "Amount",
    POSITION_TYPE: "Position Type",
    TOTAL_REWARDS_CLAIMED: "Total Rewards Claimed",
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
  return `${imageBaseUrl}/stakingRewardsTokenImage/${tokenId}`
}

/**
 * Returns metadata in the opensea metadata standard for a given StakingRewardsToken.
 * This endpoint has routing, so a valid request would be `/stakingRewardsTokenMetadata/<token-id>`.
 */
export const stakingRewardsTokenMetadata = genRequestHandler({
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
 * Returns a dynamic SVG image for a given StakingRewardsToken.
 * This endpoint has routing, so a valid request would be `/stakingRewardsTokenImage/<token-id>`.
 */
export const stakingRewardsTokenImage = genRequestHandler({
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
    draw.rect(720, 720).fill({color: "#EBB700"})
    const nested = draw

    const attributesToDisplay: Array<AttributeType> = [
      "ID",
      "INITIAL_AMOUNT",
      "AMOUNT",
      "POSITION_TYPE",
      "TOTAL_REWARDS_CLAIMED",
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
          if (!valueExists) console.error(`Staking Rewards token image is missing a value for type ${type}`)

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
          t.tspan(`${type}: ${value}`).newLine()
        })
      })
      .font({family: "sans-serif", size: 33})
      .fill("#483E5E")
      .leading(1.45)
      .dx(16)

    res.set("Content-Type", "image/svg+xml")
    return res.status(200).send(draw.svg())
  },
})
