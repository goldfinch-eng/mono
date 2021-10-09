import React, {Component} from "react"

interface InfoSectionRow {
  label: string
  value: string
}

interface InfoSectionProps {
  rows: InfoSectionRow[]
}

export default class InfoSection extends Component<InfoSectionProps> {
  convertRowToItem(row, index) {
    return (
      <div className="small-info-item" key={index}>
        <div className="value">{row.value}</div>
        <div className="label">{row.label}</div>
      </div>
    )
  }

  render() {
    return <div className="info-section">{(this.props as any).rows.map(this.convertRowToItem)}</div>
  }
}
