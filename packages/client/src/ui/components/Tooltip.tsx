import ReactTooltip from "react-tooltip"

type TooltipProps = {
  children: React.ReactNode
  id: string
  className?: string
}

const Tooltip = ({children, className, id}: TooltipProps) => (
  <ReactTooltip className={className} id={id} effect="solid" arrowColor="transparent" delayShow={50}>
    {children}
  </ReactTooltip>
)

export default Tooltip
