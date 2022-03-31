import React, {ReactNode} from "react"

interface BaseBannerProps {
  className?: string
  children: ReactNode
  icon?: JSX.Element
  variant?: string
}

function getVariantColor(variant: string | undefined): string {
  switch (variant) {
    case "warning":
      return "warning-banner"
    default:
      return "info-banner"
  }
}

function Banner(props: BaseBannerProps) {
  return (
    <div className={`background-container ${getVariantColor(props.variant)} ${props.className}`}>
      <div className="message">
        {props.icon}
        <div>{props.children}</div>
      </div>
    </div>
  )
}

export default Banner
