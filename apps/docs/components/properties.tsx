import { type ReactNode } from 'react'

export function Properties({ children }: { children: ReactNode }) {
  return (
    <div className="not-prose my-6 space-y-4 border rounded-lg p-4 bg-fd-card">
      {children}
    </div>
  )
}

interface PropertyProps {
  name: string
  type: string
  required?: boolean
  default?: string
  children: ReactNode
}

export function Property({
  name,
  type,
  required = false,
  default: defaultValue,
  children,
}: PropertyProps) {
  return (
    <div className="space-y-2 pb-4 last:pb-0 border-b last:border-b-0">
      <div className="flex flex-wrap items-baseline gap-2">
        <code className="text-sm font-semibold text-fd-foreground px-1.5 py-0.5 bg-fd-secondary rounded">
          {name}
        </code>
        <code className="text-xs text-fd-muted-foreground px-1.5 py-0.5 bg-fd-secondary/50 rounded">
          {type}
        </code>
        {required && (
          <span className="text-xs font-medium text-red-600 dark:text-red-400 px-1.5 py-0.5 bg-red-50 dark:bg-red-950/50 rounded">
            required
          </span>
        )}
        {defaultValue && (
          <span className="text-xs text-fd-muted-foreground">
            default: <code className="px-1 py-0.5 bg-fd-secondary/50 rounded">{defaultValue}</code>
          </span>
        )}
      </div>
      <div className="text-sm text-fd-muted-foreground prose-sm">
        {children}
      </div>
    </div>
  )
}
