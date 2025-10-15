import { cn } from '@/lib/cn'
import { buttonVariants } from 'fumadocs-ui/components/ui/button'
import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col justify-center items-center text-center px-4 py-16 md:py-24">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Hero Section */}
        <div className="space-y-4">
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight">
            End to End Evaluation
            <br />
            Framework For TS Devs
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            Build, test, and evaluate your AI applications with confidence.
            Simple, type-safe, and powerful.
          </p>
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
          <Link
            href="/docs/core"
            className={cn(
              buttonVariants({
                variant: 'primary',
              }),
              'h-12 px-8'
            )}
          >
            Get Started
          </Link>
          <Link
            href="https://github.com/cantemizyurek/open-evals"
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              buttonVariants({
                variant: 'outline',
              }),
              'h-12 px-8'
            )}
          >
            View on GitHub
          </Link>
        </div>

        {/* Feature Highlights */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-16">
          <div className="space-y-2 p-6 rounded-lg border border-border hover:border-foreground/20 transition-colors">
            <h3 className="font-semibold text-lg">Type-Safe</h3>
            <p className="text-sm text-muted-foreground">
              Built with TypeScript for complete type safety and excellent DX
            </p>
          </div>
          <div className="space-y-2 p-6 rounded-lg border border-border hover:border-foreground/20 transition-colors">
            <h3 className="font-semibold text-lg">End-to-End</h3>
            <p className="text-sm text-muted-foreground">
              From dataset generation to evaluation, everything you need in one
              place
            </p>
          </div>
          <div className="space-y-2 p-6 rounded-lg border border-border hover:border-foreground/20 transition-colors">
            <h3 className="font-semibold text-lg">Open Source</h3>
            <p className="text-sm text-muted-foreground">
              Free to use and extend for any project
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
