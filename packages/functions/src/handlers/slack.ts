import {Request, Response} from "@sentry/serverless/dist/gcpfunction/general"
import {genRequestHandler, getBlockchain} from "../helpers"
import {WebClient} from "@slack/web-api"
import {getConfig} from "../config"
import * as functions from "firebase-functions"
import {header, links, transactionLink, callerLink, text} from "./slack/blocks"
import {Event, SlackHandler} from "./slack/types"
import {CONTRACTS} from "./slack/contracts"
import {ethers, BigNumber} from "ethers"
import SENIOR_POOL from "@goldfinch-eng/protocol/deployments/mainnet/SeniorPool.json"

const config = getConfig(functions)
const slack = new WebClient(config.slack.token)

const provider = getBlockchain("https://app.goldfinch.finance")

const handlers: Record<string, SlackHandler> = {
  fn_usdc_balance_increase: async (event: Event) => {
    const seniorPool = new ethers.Contract(SENIOR_POOL.address, SENIOR_POOL.abi, provider)
    return {
      channel: "fun-investigation",
      title: `SeniorPool USDC Balance Increased by ${CONTRACTS.USDC.toLabel(event.value)}`,
      blocks: [
        text(`Total in SeniorPool: \`${CONTRACTS.USDC.toLabel(await seniorPool.assets())}\``),
        links(transactionLink(event), callerLink(event)),
      ],
    }
  },
  fn_usdc_balance_decrease: async (event: Event) => {
    const seniorPool = new ethers.Contract(SENIOR_POOL.address, SENIOR_POOL.abi, provider)
    return {
      title: `SeniorPool USDC Balance Decreased by ${CONTRACTS.USDC.toLabel(event.value)}`,
      channel: "fun-investigation",
      blocks: [
        text(`Total in SeniorPool: \`${CONTRACTS.USDC.toLabel(await seniorPool.assets())}\``),
        links(transactionLink(event), callerLink(event)),
      ],
    }
  },
  "Test Custom Webhook": async (event: Event) => {
    const seniorPool = new ethers.Contract(SENIOR_POOL.address, SENIOR_POOL.abi, provider)
    return {
      channel: "fun-investigation",
      title: `Webhook test function triggered with value: ${CONTRACTS.USDC.toLabel(event.value)}`,
      blocks: [
        text(`Verifying chain query - Senior pool: \`${CONTRACTS.USDC.toLabel(await seniorPool.assets())}\``),
        links(transactionLink(event), callerLink(event)),
      ],
    }
  },
}

export const slackHandler = genRequestHandler({
  requireAuth: "none",
  cors: true,
  handler: async (req: Request, res: Response): Promise<Response> => {
    const event: Event = req.body
    // BigNumber doesn't serialize from the request, manually set it
    event.value = BigNumber.from(req.body.value)

    const handler = handlers[event.sentinel.name]
    if (!handler) {
      // Handlers must have the same name as the sentinel
      // The naming scheme is fn_<camel_case_descriptor>

      return res.status(400).send({status: "missing handler", message: `No handler for '${event.sentinel.name}'`})
    }

    try {
      const message = await handler(event)

      await slack.chat.postMessage({
        unfurl_media: false,
        unfurl_links: false,
        // Use title for text. Handler can choose to override this
        text: message.title,
        ...message,
        // Convert title into a block, override original blocks
        blocks: message.blocks ? [header(message.title), ...message.blocks].filter((block) => !!block) : undefined,
      })

      return res.status(200).send({status: "success"})
    } catch (e) {
      return res.status(500).send({status: "failure", error: e})
    }
  },
})
