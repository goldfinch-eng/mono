import React from "react"
import CircularProgress from "@mui/material/CircularProgress"
import Box from "@mui/material/Box"
import {BlockInfo} from "../utils"
import colors from "../styles/theme/colors"

const styles = {
  box: {display: "flex"},
  circular: {color: colors.blue},
}

interface RefreshIndicatorProps {
  rootCurrentBlock: BlockInfo | undefined
  leafCurrentBlock: BlockInfo | undefined
}

function RefreshIndicator(props: RefreshIndicatorProps) {
  const isRefreshing =
    props.rootCurrentBlock && props.leafCurrentBlock && props.rootCurrentBlock.number > props.leafCurrentBlock.number
  return (
    <div className="refresh-indicator">
      {isRefreshing ? (
        <Box sx={styles.box}>
          <CircularProgress size="26px" sx={styles.circular} />
        </Box>
      ) : undefined}
    </div>
  )
}

export default RefreshIndicator
