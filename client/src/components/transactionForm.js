import React from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { iconX } from './icons.js';
import useCloseOnClickOrEsc from '../hooks/useCloseOnClickOrEsc';

function TransactionForm(props) {
  const formMethods = useForm({ mode: 'onChange' });
  const [node] = useCloseOnClickOrEsc({ closeFormFn: props.closeForm, closeOnClick: false });

  return (
    <div ref={node} className={`form-full background-container ${props.formClass}`}>
      <div className="form-header">
        <div className="form-header-message">{props.headerMessage}</div>
        <div onClick={props.closeForm} className="cancel">
          Cancel{iconX}
        </div>
      </div>
      <FormProvider {...formMethods}>
        <form>
          <h2>{props.title}</h2>
          {props.render({ formMethods })}
        </form>
      </FormProvider>
    </div>
  );
}

export default TransactionForm;
