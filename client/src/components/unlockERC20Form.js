import React from 'react';
import { MAX_UINT } from '../ethereum/utils';
import LoadingButton from './loadingButton';
import { useForm, FormProvider } from 'react-hook-form';
import { iconInfo } from './icons.js';
import useSendFromUser from '../hooks/useSendFromUser.js';

function UnlockERC20Form(props) {
  const { erc20, onUnlock, unlockAddress } = props;
  const sendFromUser = useSendFromUser();
  const formMethods = useForm();

  const unlock = () => {
    return sendFromUser(erc20.contract.methods.approve(unlockAddress, MAX_UINT), { type: 'Approval' }).then(onUnlock);
  };

  return (
    <FormProvider {...formMethods}>
      <div className="unlock-form background-container">
        <p>
          {iconInfo}
          Just this one time, you’ll first need to unlock your account to use {erc20.ticker} with Goldfinch.
        </p>
        <LoadingButton action={unlock} text={`Unlock ${erc20.ticker}`} />
      </div>
    </FormProvider>
  );
}

export default UnlockERC20Form;
