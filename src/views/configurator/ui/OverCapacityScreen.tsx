import Link from 'next/link'

type Props = {
  lineName: string
  requestedUnits: number
}

export function OverCapacityScreen({ lineName, requestedUnits }: Props) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-secondary/40 p-4">
      <div className="w-full max-w-md space-y-4 rounded-xl border bg-background p-6 text-center shadow-lg">
        <p className="text-3xl">🏗️</p>
        <h1 className="text-lg font-semibold">That’s a big project — we like it.</h1>
        <p className="text-sm text-muted-foreground">
          {requestedUnits} units is beyond the largest standard {lineName} configuration. Our team
          will put together an individual proposal for you.
        </p>
        <div className="flex justify-center gap-2">
          <Link
            href="/configurator"
            className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-secondary"
          >
            Adjust request
          </Link>
          <a
            href="mailto:sales@example.com?subject=Custom%20building%20request"
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            Request custom quote
          </a>
        </div>
      </div>
    </main>
  )
}
