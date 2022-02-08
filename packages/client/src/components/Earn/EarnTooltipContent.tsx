import Tooltip from "../../ui/components/Tooltip"

type EarnTooltipContentProps = {
  longDescription: string
  rows: Array<{text: string; subtext?: string; value: string}>
  total: {text: string; value: string}
  footer?: React.ReactNode
}

const EarnTooltipContent = ({rows, total, footer, longDescription}: EarnTooltipContentProps) => (
  <Tooltip id="tranched-pool-apy-tooltip" delayHide={400} className="tranched-pool-detail-tooltip clickable">
    <div>
      <p className="tooltip-long-description">{longDescription}</p>
      {rows.map(({text, subtext, value}) => (
        <>
          <div className="tooltip-row">
            <p>{text}</p>
            <span>{value}</span>
          </div>
          {subtext && <div className="tooltip-small-row">{subtext}</div>}
        </>
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

export default EarnTooltipContent
