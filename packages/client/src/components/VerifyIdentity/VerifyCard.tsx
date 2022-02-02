export default function VerifyCard({
  children,
  title,
  disabled = false,
}: React.PropsWithChildren<{title?: string; disabled?: boolean}>) {
  return (
    <div className={`background-container ${disabled && "placeholder"} verify-card`}>
      {title && <h1 className="title">{title}</h1>}
      {children}
    </div>
  )
}
