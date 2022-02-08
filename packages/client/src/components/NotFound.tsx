import {Link} from "react-router-dom"

export default function NotFound() {
  return (
    <div className="content-section">
      <div className="not-found-message-container">
        <h1 className="heading">Not Found</h1>
        <div className="message">Sorry, the page you requested could not be found</div>
        <div>
          <Link to="/">Return home</Link>
        </div>
      </div>
    </div>
  )
}
