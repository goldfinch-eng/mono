import {iconCircleCheck} from "../icons"
import TransactionForm from "../transactionForm"
import PersonaForm from "./PersonaForm"

export default function USForm({kycStatus, entityType, onClose, onEvent, network, address}) {
  return (
    <TransactionForm
      headerMessage="U.S. Individual"
      render={({formMethods}) => {
        if (kycStatus === "approved") {
          return (
            <div className="placeholder">
              <span className="verify-step-label">Step 1: Verify ID {iconCircleCheck}</span>
            </div>
          )
        }

        return (
          <>
            <PersonaForm
              entityType={entityType}
              network={network}
              address={address}
              onEvent={onEvent}
              formMethods={formMethods}
            />
            <div className="form-separator background-container-inner"></div>
          </>
        )
      }}
      closeForm={onClose}
    />
  )
}
