import React from "react"
import {LeavesCurrentBlock} from "../App"
import {UserLoaded} from "../ethereum/user"
import {NetworkConfig} from "../types/network"
import {CurrentTx, TxType} from "../types/transactions"
import {BlockInfo} from "../utils"
import NetworkWidget from "./networkWidget"
import RefreshIndicator from "./refreshIndicator"

type NetworkIndicatorsProps = {
  user: UserLoaded | undefined
  network: NetworkConfig | undefined
  currentErrors: any[]
  currentTxs: CurrentTx<TxType>[]
  connectionComplete: () => any
  rootCurrentBlock: BlockInfo | undefined
  leavesCurrentBlock: LeavesCurrentBlock
}

function NetworkIndicators(props: NetworkIndicatorsProps) {
  return (
    <div className="network-indicators">
      <div className="network-indicators-inner">
        <RefreshIndicator rootCurrentBlock={props.rootCurrentBlock} leavesCurrentBlock={props.leavesCurrentBlock} />
        <div className="network-widget-container">
          <NetworkWidget
            user={props.user}
            currentBlock={props.rootCurrentBlock}
            network={props.network}
            currentErrors={props.currentErrors}
            currentTxs={props.currentTxs}
            connectionComplete={props.connectionComplete}
          />
        </div>
      </div>
    </div>
  )
}

export default NetworkIndicators
