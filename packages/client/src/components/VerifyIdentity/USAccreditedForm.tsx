import TransactionForm from "../transactionForm"

export default function USAccreditedForm({onClose}) {
  return (
    <TransactionForm
      headerMessage="U.S. Accredited Individual"
      render={() => {
        return (
          <>
            <div className="form-message paragraph">
              Goldfinch is open to U.S. accredited investors. TODO NEED CONTENT
            </div>
            <div className="form-message paragraph">
              To verify or pre-verify, please fill out{" "}
              <a className="link" target="_blank" rel="noopener noreferrer" href="https://forms.gle/fWErQMxREWwkGhe18">
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
