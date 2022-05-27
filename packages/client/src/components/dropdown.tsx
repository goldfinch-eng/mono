import React from "react"
import useCloseOnClickOrEsc from "../hooks/useCloseOnClickOrEsc"
import _ from "lodash"

interface DropdownOption {
  value: any
  selectedEl?: JSX.Element
  el: JSX.Element
}

interface DropdownProps {
  className?: string
  selectedClassName?: string
  selected?: any
  options: DropdownOption[]
  onSelect?(value: any): void
  highlightSelected?: boolean
  arrow?: JSX.Element
}

function Dropdown({
  className,
  selectedClassName,
  selected,
  options,
  onSelect = () => {},
  highlightSelected = true,
  arrow = <span className="dropdown-arrow"></span>,
}: DropdownProps) {
  const {node, open, setOpen} = useCloseOnClickOrEsc<HTMLDivElement>()

  function toggleOpen(e?: React.UIEvent) {
    if (e) {
      e.preventDefault()
    }
    setOpen(open === "" ? "open" : "")
  }

  let selectedOption = _.find(options, (opt) => opt.value === selected)
  if (!selectedOption) {
    selectedOption = options[0]
  }

  return (
    <div className={`dropdown ${className}`} ref={node}>
      <button className={`dropdown-selected ${selectedClassName}`} onClick={toggleOpen}>
        <div className="dropdown-selected-content">
          {selectedOption && (selectedOption.selectedEl || selectedOption.el)}
        </div>
        {arrow}
      </button>
      {open && (
        <div>
          <div className={`dropdown-list ${open}`}>
            {options.map((opt) => {
              return (
                <div
                  key={opt.value}
                  className={`dropdown-list-item ${opt === selectedOption && highlightSelected && "selected"}`}
                  onClick={() => {
                    toggleOpen()
                    onSelect(opt.value)
                  }}
                >
                  {opt.el}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export type {DropdownOption}
export default Dropdown
