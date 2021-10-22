import React from "react"
import {iconImmunefi, iconNexusMutual} from "./icons"

function Footer() {
  return (
    <footer>
      <a className="outbound-link" target="a_blank" href="https://immunefi.com/bounty/goldfinch/">
        {iconImmunefi} Bug bounty
      </a>
      <a
        className="outbound-link"
        target="a_blank"
        href="https://app.nexusmutual.io/cover/buy/get-quote?address=0x8481a6EbAf5c7DABc3F7e09e44A89531fd31F822"
      >
        {iconNexusMutual} Get cover
      </a>
      <div className="section-separator"></div>
      <a href="/terms">Terms</a>
      <span className="divider">•</span>
      <a href="/privacy">Privacy</a>
    </footer>
  )
}

export default Footer
