import {isString} from "@goldfinch-eng/utils/src/type"
import React, {useContext} from "react"
import {AppContext} from "../App"
import {getEtherscanSubdomain} from "../ethereum/utils"

type EtherscanLinkProps = {
  classNames?: string
  children: React.ReactNode
} & (
  | {
      address: string
      txHash?: never
    }
  | {address?: never; txHash: string}
)

function EtherscanLink(props: EtherscanLinkProps) {
  const {network} = useContext(AppContext)
  const etherscanSubdomain = getEtherscanSubdomain(network)
  const uri = props.address ? `address/${props.address}` : `tx/${props.txHash}`

  return (
    <a
      href={isString(etherscanSubdomain) ? `https://${etherscanSubdomain}etherscan.io/${uri}` : ""}
      target="_blank"
      rel="noopener noreferrer"
      className={props.classNames}
    >
      {props.children}
    </a>
  )
}

export default EtherscanLink
