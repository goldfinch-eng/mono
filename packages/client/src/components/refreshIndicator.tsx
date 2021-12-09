import React from "react"
import CircularProgress from "@mui/material/CircularProgress"
import Box from "@mui/material/Box"
import {BlockInfo} from "../utils"
import colors from "../styles/theme/colors"

const styles = {
  box: {display: "flex"},
  circularProgress: {color: colors.blue},
}

interface RefreshIndicatorProps {
  rootCurrentBlock: BlockInfo | undefined
  leafCurrentBlock: BlockInfo | undefined
}

export function getIsRefreshing(
  rootCurrentBlock: BlockInfo | undefined,
  leafCurrentBlock: BlockInfo | undefined
): boolean {
  return !!rootCurrentBlock && !!leafCurrentBlock && rootCurrentBlock.number > leafCurrentBlock.number
}

function RefreshIndicator(props: RefreshIndicatorProps) {
  const isRefreshing = getIsRefreshing(props.rootCurrentBlock, props.leafCurrentBlock)
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
