import React, {ReactNode} from "react"

type BannerVariant = "warning"

interface BaseBannerProps {
  className?: string
  children: ReactNode
  icon?: JSX.Element
  variant?: BannerVariant
}

function getVariantColor(variant?: BannerVariant): string {
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
