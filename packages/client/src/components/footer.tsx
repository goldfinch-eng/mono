import React from "react"
import {NavLink} from "react-router-dom"

const footerNavItems = [
  {label: "Terms", href: "/terms"},
  {label: "Privacy", href: "/privacy"},
]

function Footer() {
  return (
    <footer>
      <div className="footer-content">
        <nav>
          {footerNavItems.map((item, i) => (
            <NavLink key={`footer-link-${item.label}`} to={item.href}>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </footer>
  )
}

export default Footer
