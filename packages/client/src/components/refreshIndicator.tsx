import React from "react"
import CircularProgress from "@mui/material/CircularProgress"
import Box from "@mui/material/Box"
import {BlockInfo} from "../utils"
import colors from "../styles/theme/colors"
import {useCurrentRoute} from "../hooks/useCurrentRoute"
import {LeavesCurrentBlock} from "../App"

const styles = {
  box: {display: "flex"},
  circularProgress: {color: colors.blue},
}

interface RefreshIndicatorProps {
  rootCurrentBlock: BlockInfo | undefined
  leavesCurrentBlock: LeavesCurrentBlock
  leavesCurrentBlockTriggeringLastSuccessfulGraphRefresh: LeavesCurrentBlock
}

export function getIsRefreshing(
  rootCurrentBlock: BlockInfo | undefined,
  leafCurrentBlock: BlockInfo | undefined,
  leafCurrentBlockTriggeringLastSuccessfulGraphRefresh: BlockInfo | undefined
): boolean {
  const baseIsRefreshing = !!rootCurrentBlock && !!leafCurrentBlock && rootCurrentBlock.number > leafCurrentBlock.number
  const graphIsRefreshing =
    !!rootCurrentBlock &&
    !!leafCurrentBlockTriggeringLastSuccessfulGraphRefresh &&
    rootCurrentBlock.number > leafCurrentBlockTriggeringLastSuccessfulGraphRefresh.number
  return baseIsRefreshing || graphIsRefreshing
}

function RefreshIndicator(props: RefreshIndicatorProps) {
  const currentRoute = useCurrentRoute()
  let leafCurrentBlock: BlockInfo | undefined
  let leafCurrentBlockTriggeringLastSuccessfulGraphRefresh: BlockInfo | undefined
  if (currentRoute) {
    leafCurrentBlock = props.leavesCurrentBlock[currentRoute]
    leafCurrentBlockTriggeringLastSuccessfulGraphRefresh =
      props.leavesCurrentBlockTriggeringLastSuccessfulGraphRefresh[currentRoute]
  } else {
    console.error("Failed to identify current route for leaf current block.")
  }
  const isRefreshing = getIsRefreshing(
    props.rootCurrentBlock,
    leafCurrentBlock,
    leafCurrentBlockTriggeringLastSuccessfulGraphRefresh
  )
  return (
    <div className="refresh-indicator">
      {isRefreshing ? (
        <Box sx={styles.box}>
          <CircularProgress size="26px" sx={styles.circularProgress} />
        </Box>
      ) : undefined}
    </div>
  )
}

export default RefreshIndicator
