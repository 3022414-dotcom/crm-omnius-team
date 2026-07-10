export default function DetailLayout({ leftPanel, rightPanel }) {
  return (
    <div className="h-full grid grid-cols-[340px_1fr] overflow-hidden">
      <div className="overflow-y-auto border-r border-border">
        {leftPanel}
      </div>
      <div className="overflow-y-auto">
        {rightPanel}
      </div>
    </div>
  )
}
