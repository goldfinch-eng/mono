import React, { useState } from 'react';
import useTXLoading from '../hooks/useTXLoading';
import { useFormContext } from 'react-hook-form';

function LoadingButton(props) {
  const [isPending, setIsPending] = useState(false);
  const actionWithLoading = useTXLoading({
    action: props.action,
    postAction: props.postAction,
    txData: props.txData,
    setIsPending,
    sendFromUser: props.sendFromUser,
  });
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
      className={`button submit-payment ${isPending ? 'pending' : ''}`}
    >
      {buttonText}
    </button>
  );
}

export default LoadingButton;
