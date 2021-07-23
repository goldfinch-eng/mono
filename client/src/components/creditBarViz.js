import React from "react"

function CreditBarViz(props) {
  const totalForBar = props.leftAmount.plus(props.rightAmount)
  const leftBarStyle = {width: `${props.leftAmount.multipliedBy(100).dividedBy(totalForBar)}%`}
  const rightBarStyle = {width: `${props.rightAmount.multipliedBy(100).dividedBy(totalForBar)}%`}
  return (
    <div className="bar-viz">
      <div className="full-bar">
        <div className="bar-left" style={leftBarStyle} />
        <div className="bar-right" style={rightBarStyle} />
      </div>
      <div className="left-label">
        <div className="amount">{props.leftAmountDisplay}</div>
        <div className="description">{props.leftAmountDescription}</div>
      </div>
      <div className="right-label">
        <div className="amount">{props.rightAmountDisplay}</div>
        <div className="description">{props.rightAmountDescription}</div>
      </div>
    </div>
  )
}

export default CreditBarViz
