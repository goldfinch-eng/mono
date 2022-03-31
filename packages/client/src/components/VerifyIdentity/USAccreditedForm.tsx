import TransactionForm from "../transactionForm"

export default function USAccreditedForm({onClose}: {onClose: () => void}) {
  return (
    <TransactionForm
      headerMessage="U.S. Accredited Individual"
      render={() => {
        return (
          <div className="form-message paragraph">
            If you are an accredited U.S. investor, please complete the verification process through our partner{" "}
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
            <a className="link" target="_blank" rel="noopener noreferrer" href="mailto:accredited@goldfinch.finance">
              accredited@goldfinch.finance
            </a>
            .
          </div>
        )
      }}
      closeForm={onClose}
    />
  )
}
