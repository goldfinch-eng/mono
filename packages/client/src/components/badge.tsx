import React from "react"

interface BadgeProps {
  variant: string
  fixedWidth: boolean
  text: string
}

function Badge(props: BadgeProps) {
  return (
    <div className={`badge-container ${props.variant} ${props.fixedWidth && "fixed-width"}`}>
      <div className="badge-content">{props.text}</div>
    </div>
  )
}

export default Badge
