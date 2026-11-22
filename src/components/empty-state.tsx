export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: React.ReactNode
  title: string
  body: string
  action: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-12 text-center">
      <div className="text-muted-foreground">{icon}</div>
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{body}</p>
      </div>
      {action}
    </div>
  )
}
