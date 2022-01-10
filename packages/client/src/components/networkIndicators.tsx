import React from "react"
import {LeavesCurrentBlock} from "../App"
import {UserLoaded} from "../ethereum/user"
import {NetworkConfig} from "../types/network"
import {CurrentTx, TxType} from "../types/transactions"
import {BlockInfo} from "../utils"
import NetworkWidget from "./networkWidget"
import RefreshIndicator from "./refreshIndicator"
import Banner from "./banner"
import {iconInfo} from "./icons"

type NetworkIndicatorsProps = {
  user: UserLoaded | undefined
  network: NetworkConfig | undefined
  currentErrors: any[]
  currentTxs: CurrentTx<TxType>[]
  connectionComplete: () => any
  rootCurrentBlock: BlockInfo | undefined
  leavesCurrentBlock: LeavesCurrentBlock
  leavesCurrentBlockTriggeringLastSuccessfulGraphRefresh: LeavesCurrentBlock
  hasGraphError: boolean
}

function NetworkIndicators(props: NetworkIndicatorsProps) {
  return (
    <div>
      {props.hasGraphError && (
        <div className="content-section">
          <Banner variant="warning" icon={iconInfo} className="spaced">
            <span className="bold">WARNING:</span> Due to technical issues with the blockchain data provider, the data
            displayed below may not be up-to-date. Complete transactions with caution, or refresh and try again in a few
            minutes
          </Banner>
        </div>
      )}
      <div className="network-indicators">
        <div className="network-indicators-inner">
          <RefreshIndicator
            rootCurrentBlock={props.rootCurrentBlock}
            leavesCurrentBlock={props.leavesCurrentBlock}
            leavesCurrentBlockTriggeringLastSuccessfulGraphRefresh={
              props.leavesCurrentBlockTriggeringLastSuccessfulGraphRefresh
            }
          />
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
    </div>
  )
}

export default NetworkIndicators
