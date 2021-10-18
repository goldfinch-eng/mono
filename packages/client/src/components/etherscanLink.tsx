import React, {useContext} from "react"
import {AppContext} from "../App"

interface EtherscanLinkProps {
  tranchedPoolAddress: string
  classNames?: string
  children: React.ReactNode
}

function EtherscanLink(props: EtherscanLinkProps) {
  const {network} = useContext(AppContext)
  const etherscanSubdomain = network?.name === "mainnet" ? "" : `${network?.name}.`

  return (
    <a
      href={`https://${etherscanSubdomain}etherscan.io/address/${props.tranchedPoolAddress}`}
      target="_blank"
      rel="noopener noreferrer"
      className={props.classNames}
    >
      {props.children}
    </a>
  )
}

export default EtherscanLink
