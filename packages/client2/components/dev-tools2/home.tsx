import { ButtonLink, Link } from "./helpers";

export function Home() {
  return (
    <div style={{ height: "500px" }}>
      <div>Dev Tools Home</div>
      <Link to="/membership">Go to membership tools</Link>
      <ButtonLink to="/membership">Membership</ButtonLink>
    </div>
  );
}
