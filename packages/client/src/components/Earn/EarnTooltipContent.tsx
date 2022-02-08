import Tooltip from "../../ui/components/Tooltip"
import {useMediaQuery} from "react-responsive"
import {WIDTH_TYPES} from "../styleConstants"

type EarnTooltipContentProps = {
  id?: string
  longDescription: string
  rows: Array<{text: string; subtext?: string; value: string}>
  total: {text: string; value: string}
  footer?: React.ReactNode
}

const EarnTooltipContent = ({id, rows, total, footer, longDescription}: EarnTooltipContentProps) => {
  const isTabletOrMobile = useMediaQuery({
    query: `(max-width: ${WIDTH_TYPES.screenM})`,
  })
  return (
    <Tooltip
      id={id || "apy-tooltip"}
      delayHide={isTabletOrMobile ? 50 : 400}
      className="apy-detail-tooltip clickable"
      place="left"
    >
      <div>
        <p className="tooltip-long-description">{longDescription}</p>
        {rows.map(({text, subtext, value}) => (
          <div key={text}>
            <div className="tooltip-row">
              <p>{text}</p>
              <span>{value}</span>
            </div>
            {subtext && <div className="tooltip-small-row">{subtext}</div>}
          </div>
        ))}
        <div className="tooltip-divider"></div>
        <div className="tooltip-row">
          <p>{total.text}</p>
          <span>{total.value}</span>
        </div>
        {footer && <div className="tooltip-footer">{footer}</div>}
      </div>
    </Tooltip>
  )
}

export default EarnTooltipContent
