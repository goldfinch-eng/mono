import React, { useState, useEffect } from 'react';
import BigNumber from 'bignumber.js';
import { buildCreditLine } from '../ethereum/creditLine';
import { usdcFromAtomic } from '../ethereum/erc20';
import { croppedAddress, displayDollars } from '../utils';
import useCloseOnClickOrEsc from '../hooks/useCloseOnClickOrEsc';
import Dropdown from './dropdown';

function BorrowHeader(props) {
  const [creditLinePreviews, setCreditLinePreviews] = useState([]);

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

  if (props.creditLines.length > 1) {
    const options = creditLinePreviews.map(cl => {
      return {
        value: cl.address,
        selectedEl: <>{croppedAddress(cl.address)}</>,
        el: (
          <>
            {croppedAddress(cl.address)}
            <span className="dropdown-amount">{displayDollars(usdcFromAtomic(cl.limit))}</span>
          </>
        ),
      };
    });

    return (
      <div>
        <span>Credit Line /</span>

        <Dropdown
          selected={props.selectedCreditLine.address}
          options={options}
          onSelect={address => {
            props.changeCreditLine(address);
          }}
        />
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
