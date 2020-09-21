import React, { useState } from 'react';
import useTXLoading from '../hooks/useTXLoading';

function LoadingButton(props) {
  const [isPending, setIsPending] = useState(false);
  const actionWithLoading = useTXLoading(props.action, setIsPending);

  let buttonText = props.text;
  if (isPending) {
    buttonText = 'Submitting...';
  }

  return (
    <button
      onClick={() => {
        actionWithLoading();
      }}
      className={`button submit-payment ${isPending ? 'button-pending' : ''}`}
    >
      {buttonText}
    </button>
  );
}

export default LoadingButton;
