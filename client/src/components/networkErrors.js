import React, { useContext } from 'react';
import iconRedX from '../images/x-red.svg';
import { AppContext } from '../App.js';

function NetworkErrors(props) {
  const { removeError } = useContext(AppContext);

  function errorItem(error) {
    return (
      <div key={error.id} className="error-item">
        <div className="error-label">Error</div>
        <div
          onClick={() => {
            removeError(error);
          }}
          className="dismiss-error-item"
        >
          <img src={iconRedX} alt="x" />
        </div>
        <p>{error.message}</p>
      </div>
    );
  }

  if (!props.currentErrors.length) {
    return '';
  } else {
    return <div className="error-items">{props.currentErrors.map(errorItem)}</div>;
  }
}

export default NetworkErrors;
