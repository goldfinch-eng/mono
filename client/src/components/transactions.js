import React, { useContext } from 'react';
import _ from 'lodash';
import ConnectionNotice from './connectionNotice.js';
import { AppContext } from '../App.js';
import { displayDollars } from '../utils';
import { iconCircleUpLg, iconCircleDownLg, iconCircleCheckLg, iconOutArrow } from './icons.js';

function Transactions(props) {
  const { user, network } = useContext(AppContext);

  function transactionRow(tx) {
    const etherscanSubdomain = network.name === 'mainnet' ? '' : `${network}.`;

    let typeCssClass = '';
    let icon = iconCircleCheckLg;
    let amountPrefix = '';
    if (['Deposit', 'Payment'].includes(tx.type)) {
      typeCssClass = 'inflow';
      icon = iconCircleUpLg;
      amountPrefix = '+';
    } else if (['Withdrawal', 'Drawdown'].includes(tx.type)) {
      typeCssClass = 'outflow';
      icon = iconCircleDownLg;
      amountPrefix = '-';
    }

    let statusCssClass = '';
    let typeLabel = tx.type;
    let txDate = tx.date;
    if (tx.status === 'error') {
      statusCssClass = 'error';
      typeLabel = typeLabel + ' (failed)';
    } else if (tx.status === 'pending') {
      statusCssClass = 'pending';
      txDate = 'Processing...';
      icon = (
        <div className="status-icon">
          <div className="indicator"></div>
          <div className="spinner">
            <div className="double-bounce1"></div>
            <div className="double-bounce2"></div>
          </div>
        </div>
      );
    }

    return (
      <tr key={tx.id} className={`transaction-row ${typeCssClass} ${statusCssClass}`}>
        <td className="transaction-type">
          {icon}
          {typeLabel}
        </td>
        <td className="transaction-amount">
          {amountPrefix}
          {displayDollars(tx.amount)}
        </td>
        <td className="transaction-date">{txDate}</td>
        <td className="transaction-link">
          <a href={`https://${etherscanSubdomain}etherscan.io/tx/${tx.id}`} target="_blank" rel="noopener noreferrer">
            {iconOutArrow}
            {/* {croppedAddress(tx.id)} */}
          </a>
        </td>
      </tr>
    );
  }

  let allTx = _.compact(_.concat(props.currentTXs, user.pastTXs));
  allTx = _.uniqBy(allTx, 'id');
  let transactionRows = (
    <tr className="empty-row">
      <td>No transactions</td>
      <td></td>
      <td></td>
      <td></td>
    </tr>
  );
  if (allTx.length > 0) {
    transactionRows = allTx.map(transactionRow);
  }

  return (
    <div className="content-section">
      <div className="page-header">Transactions</div>
      <ConnectionNotice />
      <table className={`transactions-table ${user.address ? '' : 'placeholder'}`}>
        <thead>
          <tr>
            <th>Type</th>
            <th className="transaction-amount">Amount</th>
            <th className="transaction-date">Date</th>
            <th className="transaction-link"></th>
          </tr>
        </thead>
        <tbody>{transactionRows}</tbody>
      </table>
    </div>
  );
}

export default Transactions;
