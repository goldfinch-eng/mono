import VerifyCard from "./VerifyCard"

export default function ErrorCard({title}: {title: string}) {
  return (
    <VerifyCard title={title} disabled={false}>
      <p className="font-small">Oops, there was an error. Try refreshing the page.</p>
    </VerifyCard>
  )
}
