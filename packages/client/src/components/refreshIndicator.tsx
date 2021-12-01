import React from "react"
import {BlockInfo} from "../utils"

interface RefreshIndicatorProps {
  rootCurrentBlock: BlockInfo | undefined
  leafCurrentBlock: BlockInfo | undefined
}

function RefreshIndicator(props: RefreshIndicatorProps) {
  const isRefreshing =
    props.rootCurrentBlock && props.leafCurrentBlock && props.rootCurrentBlock.number > props.leafCurrentBlock.number
  return (
    <div className="refresh-indicator">
      {isRefreshing ? <div style={{backgroundColor: "red"}}>refreshing...</div> : undefined}
    </div>
  )
}

export default RefreshIndicator
