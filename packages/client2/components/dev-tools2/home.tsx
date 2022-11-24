import { Link } from "react-router-dom";

export function Home() {
  return (
    <div style={{ height: "500px" }}>
      <div>Dev Tools Home</div>
      <Link to="/membership">Go to membership tools</Link>
    </div>
  );
}
