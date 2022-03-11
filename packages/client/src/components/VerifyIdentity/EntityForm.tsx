import TransactionForm from "../transactionForm"

export default function EntityForm({onClose}) {
  return (
    <TransactionForm
      headerMessage="Entity"
      render={() => {
        return (
          <>
            <div className="form-message paragraph">
              Goldfinch is open to non-U.S. entities, and there may be opportunities soon for U.S. entities that qualify
              as accredited investors.
            </div>
            <div className="form-message paragraph">
              To verify or pre-verify, please fill out{" "}
              <a
                className="link"
                target="_blank"
                rel="noopener noreferrer"
                href="https://bridge.parallelmarkets.com/goldfinch"
              >
                this form
              </a>
              . Then we will reach out with next steps.
            </div>
          </>
        )
      }}
      closeForm={onClose}
    />
  )
}
