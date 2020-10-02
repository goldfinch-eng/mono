import React, { useState } from 'react';
import useTXLoading from '../hooks/useTXLoading';
import { useFormContext } from 'react-hook-form';

function LoadingButton(props) {
  const [isPending, setIsPending] = useState(false);
  const actionWithLoading = useTXLoading(props.action, props.txData, setIsPending);
  const formMethods = useFormContext();

  let buttonText = props.text;
  if (isPending) {
    buttonText = 'Submitting...';
  }

  return (
    <button
      onClick={formMethods.handleSubmit(() => {
        actionWithLoading();
      })}
      className={`button submit-payment ${isPending ? 'button-pending' : ''}`}
    >
      {buttonText}
    </button>
  );
}

export default LoadingButton;
