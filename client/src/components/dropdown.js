import React from "react"
import useCloseOnClickOrEsc from "../hooks/useCloseOnClickOrEsc"
import _ from "lodash"

function Dropdown({ className, selectedClassName, selected, options, onSelect }) {
  const [node, open, setOpen] = useCloseOnClickOrEsc()

  function toggleOpen(e = null) {
    if (e) {
      e.preventDefault()
    }
    setOpen(open === "" ? "open" : "")
  }

  let selectedOption = _.find(options, opt => opt.value === selected)
  if (!selectedOption) {
    selectedOption = options[0]
  }

  return (
    <div className={`dropdown ${className}`} ref={node}>
      <a className={`dropdown-selected ${selectedClassName}`} onClick={toggleOpen}>
        <div className="dropdown-selected-content">
          {selectedOption && (selectedOption.selectedEl || selectedOption.el)}
        </div>
        <span className="dropdown-arrow"></span>
      </a>
      {open && (
        <div>
          <div className={`dropdown-list ${open}`}>
            {options.map(opt => {
              return (
                <div
                  key={opt.value}
                  className={`dropdown-list-item ${opt === selectedOption && "selected"}`}
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

export default Dropdown
