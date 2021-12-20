import React, {ReactNode} from "react"

interface BaseBannerProps {
  classNames?: string
  children: ReactNode
  icon?: JSX.Element
  variant?: string
  noSpacing?: boolean
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
    <div className={`background-container ${getVariantColor(props.variant)} ${props.noSpacing ? "no-margin" : ""}`}>
      <div className="message">
        {props.icon}
        <p>{props.children}</p>
      </div>
    </div>
  )
}

export default Banner
