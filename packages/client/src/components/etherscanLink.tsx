import {isString} from "@goldfinch-eng/utils/src/type"
import React, {useContext} from "react"
import {AppContext} from "../App"
import {getEtherscanSubdomain} from "../ethereum/utils"

interface EtherscanLinkProps {
  address: string
  classNames?: string
  children: React.ReactNode
}

function EtherscanLink(props: EtherscanLinkProps) {
  const {network} = useContext(AppContext)
  const etherscanSubdomain = getEtherscanSubdomain(network)

  return (
    <a
      href={isString(etherscanSubdomain) ? `https://${etherscanSubdomain}etherscan.io/address/${props.address}` : ""}
      target="_blank"
      rel="noopener noreferrer"
      className={props.classNames}
    >
      {props.children}
    </a>
  )
}

export default EtherscanLink
