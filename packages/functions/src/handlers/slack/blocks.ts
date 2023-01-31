import {Event} from "./types"

export const header = (text: string) => ({
  type: "header",
  text: {
    type: "plain_text",
    text: text,
    emoji: true,
  },
})

export const text = (text: string) => ({
  type: "context",
  elements: [
    {
      type: "mrkdwn",
      text,
    },
  ],
})

export const links = (...links: {text: string; url: string}[]) => ({
  type: "context",
  elements: [
    {
      type: "mrkdwn",
      text: links
        .map(({text, url}) => `<${url}|${text}>`)
        .reduce((current, link) => (current.length === 0 ? link : `${current} | ${link}`), ""),
    },
  ],
})

export const transactionLink = (event: Event) => ({
  text: "Transaction",
  url: `https://etherscan.io/tx/${event.transaction.transactionHash}`,
})

export const callerLink = (event: Event) => ({
  text: "Caller",
  url: `https://etherscan.io/address/${event.transaction.from}`,
})
