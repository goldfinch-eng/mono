import React from "react";

function stuff() {
  return (
    <div>
      <div className="content-header">Your Credit Line</div>

      <div className="form-section">
        <div className="form-start">
          <button className="button-dk big">Start Drawdown</button>
          <button className="button-dk big">Start Payment</button>
        </div>
        <div className="form-full">
          <nav className="form-nav">
            <div className="form-nav-option">Prepayment</div>
            <div className="form-nav-option selected">Principal Payment</div>
            <div className="form-nav-option cancel">Cancel</div>
          </nav>
          <p class="form-message">Directly pay down your current balance. $182 will be applied to current accrued interest before paying down principal.</p>
          <div class="form-inputs">
            <div class="input-container"><input className="big-number-input"></input></div>
            <button className="button-dk submit-payment">Submit Payment</button>            
          </div>
          <div class="form-note">Note: After a principal payment of $15,000.00, your next payment due will be $496.30 on Oct 6, 2020.</div>
        </div>
      </div>

      <div className="info-section">
        <h2>Payment Status</h2>
        <table>
          <tr>
            <td>Payment Due on Oct 6</td>
            <td className="info-section-number">$543.60</td>
          </tr>
          <tr>
            <td>Prepaid Toward Payment Due</td>
            <td className="info-section-number">$0.00</td>
          </tr>
        </table>
      </div>

      <div className="info-section">
        <h2>Credit Status</h2>
        <table>
          <tr>
            <td>Available to Drawdown</td>
            <td className="info-section-number">$107,654.92</td>
          </tr>
          <tr>
            <td>Current Drawdown Balance</td>
            <td className="info-section-number">$92,345.08</td>
          </tr>
          <tr>
            <td>Total Credit Limit</td>
            <td className="info-section-number">$200,000.00</td>
          </tr>
        </table>
      </div>

    </div>
);
}

export default stuff;