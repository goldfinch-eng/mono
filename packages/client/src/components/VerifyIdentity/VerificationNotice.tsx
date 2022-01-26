export default function VerificationNotice({icon, notice}) {
  return (
    <div className="verify-card info-banner background-container subtle">
      <div className="message">
        {icon}
        <p>{notice}</p>
      </div>
    </div>
  )
}
