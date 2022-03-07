import React, {Component} from "react"

interface InfoSectionRow {
  label: string
  value: string
}

interface InfoSectionProps {
  rows: InfoSectionRow[]
  classNames?: string
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
    return <div className={`info-section ${this.props.classNames}`}>{this.props.rows.map(this.convertRowToItem)}</div>
  }
}
