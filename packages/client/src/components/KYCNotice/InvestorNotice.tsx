import {useState} from "react"
import {UserLoaded} from "../../ethereum/user"
import useGeolocation from "../../hooks/useGeolocation"
import {iconCarrotDown, iconCarrotUp, iconInfo} from "../icons"
import {getLegalLanguage} from "./utils"

export default function InvestorNotice({
  user,
  allowedUIDTypes,
}: {
  user: UserLoaded | undefined
  allowedUIDTypes: Array<number>
}) {
  const geolocation = useGeolocation()
  const [open, setOpen] = useState<boolean>(false)
  const {title, message} = getLegalLanguage({user, allowedUIDTypes, geolocation})

  return (
    <div className="investor-notice info-banner subtle background-container" onClick={() => setOpen(!open)}>
      <div className="inner-banner">
        <div className="message">
          {iconInfo}
          <p>{title}</p>
        </div>
        {open ? (
          <button className="expand close">{iconCarrotUp}</button>
        ) : (
          <button className="expand open">{iconCarrotDown}</button>
        )}
      </div>
      <div className={`hidden-message ${open ? "show" : "hide"}`}>{message}</div>
    </div>
  )
}
