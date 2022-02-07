import ReactTooltip, {TooltipProps as ReactTooltipProps} from "react-tooltip"

type TooltipProps = {
  children: React.ReactNode
  id: string
  className?: string
} & ReactTooltipProps

const Tooltip = ({children, className, id, ...props}: TooltipProps) => (
  <ReactTooltip className={className} id={id} effect="solid" arrowColor="transparent" delayShow={50} {...props}>
    {children}
  </ReactTooltip>
)

export default Tooltip
