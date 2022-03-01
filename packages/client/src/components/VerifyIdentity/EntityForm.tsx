import TransactionForm from "../transactionForm"

export default function EntityForm({onClose}) {
  return (
    <TransactionForm
      headerMessage="Entity"
      render={() => {
        return (
          <div className="form-message paragraph">
            If you are an entity, please complete the verification process through our partner{" "}
            <a
              className="link"
              target="_blank"
              rel="noopener noreferrer"
              href="https://bridge.parallelmarkets.com/goldfinch"
            >
              Parallel Markets
            </a>
            .
            <br />
            <br />
            We will reach out with next steps within 24-72 hours. If you encounter any issues, please reach out to{" "}
            <a className="link" target="_blank" rel="noopener noreferrer" href="mailto:institutional@goldfinch.finance">
              institutional@goldfinch.finance
            </a>
            .
          </div>
        )
      }}
      closeForm={onClose}
    />
  )
}
