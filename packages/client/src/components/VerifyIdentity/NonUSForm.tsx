import TransactionForm from "../transactionForm"
import PersonaForm from "./PersonaForm"

export default function NonUSForm({entityType, onClose, onEvent, network, address}) {
  return (
    <TransactionForm
      headerMessage="Non-U.S. Individual"
      render={({formMethods}) => {
        return (
          <PersonaForm
            entityType={entityType}
            network={network}
            address={address}
            onEvent={onEvent}
            formMethods={formMethods}
          />
        )
      }}
      closeForm={onClose}
    />
  )
}
