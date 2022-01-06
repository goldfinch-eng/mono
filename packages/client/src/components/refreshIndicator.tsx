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
  leavesRootBlockOfLastGraphRefresh: LeavesCurrentBlock
  leavesCurrentBlock: LeavesCurrentBlock
}

export function getIsRefreshing(
  rootCurrentBlock: BlockInfo | undefined,
  leafCurrentBlock: BlockInfo | undefined,
  rootBlockOfLastGraphRefresh: BlockInfo | undefined
): boolean {
  return (
    !!rootCurrentBlock &&
    !!leafCurrentBlock &&
    !!rootBlockOfLastGraphRefresh &&
    (rootCurrentBlock.number > leafCurrentBlock.number || rootCurrentBlock.number > rootBlockOfLastGraphRefresh.number)
  )
}

function RefreshIndicator(props: RefreshIndicatorProps) {
  const currentRoute = useCurrentRoute()
  let leafCurrentBlock: BlockInfo | undefined, rootBlockOfLastGraphRefresh: BlockInfo | undefined
  if (currentRoute) {
    leafCurrentBlock = props.leavesCurrentBlock[currentRoute]
    rootBlockOfLastGraphRefresh = props.leavesRootBlockOfLastGraphRefresh[currentRoute]
  } else {
    console.error("Failed to identify current route for leaf current block.")
  }
  const isRefreshing = getIsRefreshing(props.rootCurrentBlock, leafCurrentBlock, rootBlockOfLastGraphRefresh)
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
