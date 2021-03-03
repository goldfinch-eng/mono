import React, { useContext } from 'react';
import { AppContext } from '../App.js';
import { MAX_UINT } from '../ethereum/utils';
import LoadingButton from './loadingButton';
import { useForm, FormProvider } from 'react-hook-form';
import { iconInfo } from './icons.js';
import useSendFromUser from '../hooks/useSendFromUser.js';

function UnlockUSDCForm(props) {
  const { erc20, refreshUserData } = useContext(AppContext);
  const sendFromUser = useSendFromUser();
  const formMethods = useForm();

  const unlockUSDC = () => {
    return sendFromUser(erc20.methods.approve(props.unlockAddress, MAX_UINT), { type: 'Approval' }).then(
      refreshUserData,
    );
  };

  return (
    <FormProvider {...formMethods}>
      <div className="unlock-form background-container">
        <p>
          {iconInfo}
          Just this one time, you’ll first need to unlock your account to use USDC with Goldfinch.
        </p>
        <LoadingButton action={unlockUSDC} text={'Unlock USDC'} />
      </div>
    </FormProvider>
  );
}

export default UnlockUSDCForm;
