import Link from 'next/link'

type Props = {
  lineName: string
  requestedUnits: number
}

export function OverCapacityScreen({ lineName, requestedUnits }: Props) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-4 rounded-xl bg-card p-6 text-center shadow-md ring-1 ring-border">
        <span className="inline-flex rounded-full bg-gold px-3 py-1 text-xs font-medium text-ink">
          Custom build
        </span>
        <h1 className="text-2xl font-medium">That’s a big project — we like it.</h1>
        <p className="text-sm text-muted-foreground">
          {requestedUnits} units is beyond the largest standard {lineName} configuration. Our team
          will put together an individual proposal for you.
        </p>
        <Link
          href="/configurator"
          className="inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-transform hover:scale-[1.02] active:scale-[0.98]"
        >
          Adjust request
        </Link>
      </div>
    </main>
  )
}
