import type {ReactNode} from "react"
import {useState} from "react"
import {NavLink} from "react-router-dom"
import logoPurp from "../images/logomark-purp.svg"
import closeIcon from "../images/x.svg"
import menuIcon from "../images/menu.svg"

export const NAV_ITEMS = [
  {label: "Earn", href: "https://beta.app.goldfinch.finance/earn"},
  {label: "Borrow", href: "/borrow"},
  {label: "GFI", href: "https://beta.app.goldfinch.finance/gfi"},
  {label: "Stake", href: "https://beta.app.goldfinch.finance/stake"},
  {label: "Transactions", href: "https://beta.app.goldfinch.finance/transactions"},
]

export default function Nav({children}: {children: ReactNode}) {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false)

  return (
    <div className="main-nav">
      <div className="main-nav-button">
        <button
          onClick={() => {
            setIsMobileNavOpen(true)
          }}
        >
          <img src={menuIcon} alt="Open Mobile Menu" />
        </button>
      </div>

      <div className="main-nav-logo">
        <a href="/">
          <img src={logoPurp} alt="Goldfinch" />
        </a>
      </div>

      <div className="main-nav-links">
        {NAV_ITEMS.map(({label, href}) => {
          return !href.includes("beta") ? (
            <NavLink key={`${label}-${href}`} to={href}>
              {label}
            </NavLink>
          ) : (
            <a key={`${label}-${href}`} href={href}>
              {label}
            </a>
          )
        })}
      </div>

      <div className="main-nav-wallet">{children}</div>

      <div className={`mobile-nav ${isMobileNavOpen ? "is-open" : ""}`}>
        <div className="mobile-nav-buttons">
          <div className="mobile-nav-close">
            <button
              onClick={() => {
                setIsMobileNavOpen(false)
              }}
            >
              <img src={closeIcon} alt="Close Mobile Menu" />
            </button>
          </div>
          <div className="mobile-nav-wallet">{children}</div>
        </div>
        <div className="mobile-nav-links">
          <div className="mobile-nav-logo">
            <a href="/">
              <img src={logoPurp} alt="Goldfinch" />
            </a>
          </div>

          {NAV_ITEMS.map(({label, href}) => {
            return !href.includes("beta") ? (
              <NavLink key={`${label}-${href}`} to={href}>
                {label}
              </NavLink>
            ) : (
              <a key={`${label}-${href}`} href={href}>
                {label}
              </a>
            )
          })}
        </div>
      </div>
    </div>
  )
}
