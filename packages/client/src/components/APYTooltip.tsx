import Tooltip from "../ui/components/Tooltip"
import {useMediaQuery} from "react-responsive"
import {WIDTH_TYPES} from "./styleConstants"

type APYTooltipProps = {
  id?: string
  longDescription: string
  rows: Array<{text: string; subtext?: string; value: string}>
  total: {text: string; value: string}
  footer?: React.ReactNode
  classNames?: string
}

const APYTooltip = ({id, longDescription, rows, total, footer, classNames}: APYTooltipProps) => {
  const isTabletOrMobile = useMediaQuery({
    query: `(max-width: ${WIDTH_TYPES.screenM})`,
  })
  return (
    <Tooltip
      id={id || "apy-tooltip"}
      delayHide={isTabletOrMobile ? 50 : 400}
      className={classNames || "tooltip-container"}
      place="left"
    >
      <div>
        <p className="tooltip-long-description">{longDescription}</p>
        {rows.map(({text, subtext, value}) => (
          <div key={text}>
            <div className="tooltip-row">
              <p data-testid="tooltip-row-label">{text}</p>
              <span data-testid="tooltip-row-value">{value}</span>
            </div>
            {subtext && <div className="tooltip-small-row">{subtext}</div>}
          </div>
        ))}
        <div className="tooltip-divider"></div>
        <div className="tooltip-row">
          <p>{total.text}</p>
          <span data-testid="tooltip-total-apy">{total.value}</span>
        </div>
        {footer && <div className="tooltip-footer">{footer}</div>}
      </div>
    </Tooltip>
  )
}

export default APYTooltip
