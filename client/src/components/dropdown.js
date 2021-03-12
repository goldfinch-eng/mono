import React, { useState } from 'react';
import useCloseOnClickOrEsc from '../hooks/useCloseOnClickOrEsc';
import _ from 'lodash';

function Dropdown({ selected, options, onSelect }) {
  const [node, open, setOpen] = useCloseOnClickOrEsc();

  function toggleOpen() {
    setOpen(open === '' ? 'open' : '');
  }

  let selectedOption = _.find(options, opt => opt.value === selected);
  if (!selectedOption) {
    selectedOption = options[0];
  }

  return (
    <div className={'dropdown'} ref={node}>
      <div className="dropdown-selected" onClick={toggleOpen}>
        {selectedOption.selectedEl || selectedOption.el}
      </div>
      {open && (
        <div>
          <div className={`dropdown-list ${open}`}>
            {options.map(opt => {
              return (
                <div
                  key={opt.value}
                  className={`dropdown-list-item ${opt === selectedOption && 'selected'}`}
                  onClick={() => {
                    toggleOpen();
                    onSelect(opt.value);
                  }}
                >
                  {opt.el}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default Dropdown;
