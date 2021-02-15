import React, { useState, useEffect } from 'react';
import BigNumber from 'bignumber.js';
import { buildCreditLine } from '../ethereum/creditLine';
import { usdcFromAtomic } from '../ethereum/erc20';
import { croppedAddress, displayDollars } from '../utils';
import useCloseOnClickOrEsc from '../hooks/useCloseOnClickOrEsc';

function BorrowHeader(props) {
  const [creditLinePreviews, setCreditLinePreviews] = useState([]);
  const [node, open, setOpen] = useCloseOnClickOrEsc();

  useEffect(() => {
    async function getCreditLinePreviews() {
      if (props.creditLines.length > 1) {
        const limits = await Promise.all(
          props.creditLines.map(buildCreditLine).map(async cl => {
            return new BigNumber(await cl.methods.limit().call());
          }),
        );
        const previews = limits
          .map((limit, i) => {
            return {
              limit: limit,
              address: props.creditLines[i],
            };
          })
          .filter(preview => preview.limit.gt(0));
        setCreditLinePreviews(previews);
      } else {
        const previews = [{ address: props.creditLines[0] }];
        setCreditLinePreviews(previews);
      }
    }
    getCreditLinePreviews();
  }, [props.creditLines]);

  function toggleCreditLineSelect() {
    if (open === '') {
      setOpen('open');
    } else {
      setOpen('');
    }
  }

  if (props.creditLines.length > 1) {
    let selectCreditLineHTML;
    if (open) {
      selectCreditLineHTML = (
        <div className={`credit-line-list ${open}`}>
          {creditLinePreviews.map(cl => {
            return (
              <div
                key={cl.address}
                className="credit-line-list-item"
                onClick={() => {
                  props.changeCreditLine(cl.address);
                  toggleCreditLineSelect();
                }}
              >
                {croppedAddress(cl.address)}
                <span className="credit-line-amount">{displayDollars(usdcFromAtomic(cl.limit))}</span>
              </div>
            );
          })}
        </div>
      );
    }
    return (
      <div>
        <span>CreditLine /</span>
        <div className="credit-line-dropdown">
          <span className="credit-line-selected" onClick={toggleCreditLineSelect}>
            {croppedAddress(props.selectedCreditLine.address)}
          </span>
          <div ref={node}>{selectCreditLineHTML}</div>
        </div>
      </div>
    );
  }

  let header = 'Loading...';
  if (props.user.loaded && props.selectedCreditLine.address) {
    header = `Credit Line / ${croppedAddress(props.selectedCreditLine.address)}`;
  } else if (props.user.loaded) {
    header = 'Credit Line';
  }
  return header;
}

export default BorrowHeader;
