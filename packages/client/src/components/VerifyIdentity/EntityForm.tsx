import {iconOutArrow} from "../icons"
import TransactionForm from "../transactionForm"

export default function EntityForm({onClose}) {
  return (
    <TransactionForm
      headerMessage="Entity"
      render={() => {
        return (
          <div className="info-banner subtle">
            <div className="message">
              <p className="font-small">
                We use Parallel Markets to complete verification for entities. After you have completed verification, we
                will reach out within 24-72 hours. If you encounter any issues, please reach out to{" "}
                <a
                  className="link"
                  target="_blank"
                  rel="noopener noreferrer"
                  href="mailto:institutional@goldfinch.finance"
                >
                  institutional@goldfinch.finance
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
