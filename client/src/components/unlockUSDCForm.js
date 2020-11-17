import React, { useContext } from 'react';
import { AppContext } from '../App.js';
import { MAX_UINT } from '../ethereum/utils';
import LoadingButton from './loadingButton';
import { useForm, FormProvider } from 'react-hook-form';
import iconInfo from '../images/info-purp.svg';

function UnlockUSDCForm() {
  const { erc20, pool, refreshUserData } = useContext(AppContext);
  const formMethods = useForm();

  const unlockUSDC = () => {
    return erc20.methods.approve(pool._address, MAX_UINT);
  };

  return (
    <FormProvider {...formMethods}>
      <div className="unlock-form background-container">
        <p>
          <img className="icon" src={iconInfo} alt="info" />
          Just this one time, you’ll first need to unlock your account to send USDC to Goldfinch.
        </p>
        <LoadingButton
          action={unlockUSDC}
          actionComplete={() => {
            refreshUserData();
          }}
          text={'Unlock USDC'}
          txData={{ type: 'Approval' }}
          sendFromUser={true}
        />
      </div>
    </FormProvider>
  );
}

export default UnlockUSDCForm;
