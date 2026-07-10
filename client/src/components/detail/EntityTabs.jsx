import { useState } from 'react'
import { cn } from '../../lib/utils'

export default function EntityTabs({ tabs }) {
  const [activeTab, setActiveTab] = useState(tabs[0]?.id)

  return (
    <div>
      <div className="sticky top-0 bg-background border-b border-border z-10">
        <nav className="flex gap-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'px-4 py-2.5 text-sm border-b-2 transition-colors',
                activeTab === tab.id
                  ? 'border-primary text-primary font-medium'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
      <div className="p-4">
        {tabs.map((tab) =>
          activeTab === tab.id ? <div key={tab.id}>{tab.content}</div> : null
        )}
      </div>
    </div>
  )
}
