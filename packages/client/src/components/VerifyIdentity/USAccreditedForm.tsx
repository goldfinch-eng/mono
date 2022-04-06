import {iconOutArrow} from "../icons"
import TransactionForm from "../transactionForm"

export default function USAccreditedForm({onClose}: {onClose: () => void}) {
  return (
    <TransactionForm
      headerMessage="U.S. Accredited Individual"
      render={() => {
        return (
          <div className="info-banner subtle">
            <div className="message">
              <p className="font-small">
                We use Parallel Markets to complete verification for accredited investors. After you have completed
                verification, we will reach out within 24-72 hours. If you encounter any issues, please reach out to{" "}
                <a
                  className="link"
                  target="_blank"
                  rel="noopener noreferrer"
                  href="mailto:accredited@goldfinch.finance"
                >
                  accredited@goldfinch.finance
                </a>
                .
              </p>
            </div>
            <button
              className="button submit-form"
              onClick={(e) => {
                e.preventDefault()
                window.open("https://bridge.parallelmarkets.com/goldfinch", "_blank")
              }}
            >
              Get Verified {iconOutArrow}
            </button>
          </div>
        )
      }}
      closeForm={onClose}
    />
  )
}
