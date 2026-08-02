'use client'

import { FileText } from 'lucide-react'
import { useState } from 'react'

import type { BuildingScene } from '@/entities/building'
import type { FurniturePackageEntity } from '@/entities/furniture-package'
import { For, Match, Show, Switch } from '@/shared/ui/control-flow'

import {
  useQuoteSummaryModel,
  type IntegrationOptions,
} from '../model/use-quote-summary-model'

type Props = {
  building: BuildingScene
  packages: FurniturePackageEntity[]
  integration: IntegrationOptions
}

export function QuoteDialog({ building, packages, integration }: Props) {
  const vm = useQuoteSummaryModel({ building, packages, integration })
  const [open, setOpen] = useState(false)
  const [contact, setContact] = useState({ name: '', email: '', phone: '', company: '' })

  const field =
    (key: keyof typeof contact) => (event: React.ChangeEvent<HTMLInputElement>) =>
      setContact((prev) => ({ ...prev, [key]: event.target.value }))

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Request a quote"
        className="absolute top-[max(1rem,env(safe-area-inset-top))] right-[max(1rem,env(safe-area-inset-right))] z-30 flex items-center gap-2 rounded-full bg-primary p-3 text-sm font-medium text-primary-foreground shadow-xl transition-transform hover:scale-[1.02] active:scale-[0.98] desktop:py-3 desktop:pr-5 desktop:pl-4"
      >
        <FileText size={16} strokeWidth={2.5} />
        <span className="hidden desktop:inline">Request a quote</span>
      </button>

      <Show when={open}>
        {/* Above the trigger, which sits at z-30 — the modal used to open *under*
            the button that opened it. */}
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
          <div className="max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-xl bg-background p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">Request a quote</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full px-2 py-1 text-sm text-muted-foreground hover:bg-secondary"
              >
                ✕
              </button>
            </div>

            <Switch>
              <Match when={vm.submitState.phase === 'success'}>
                <div className="mt-6 space-y-2 text-center">
                  <p className="text-2xl">✓</p>
                  <p className="text-sm font-medium">Your quote request has been sent.</p>
                  <p className="text-xs text-muted-foreground">
                    The team will get back to you shortly.
                  </p>
                </div>
              </Match>
              <Match when={vm.submitState.phase !== 'success'}>
                <div className="mt-4 space-y-4">
                  <section className="rounded-lg border p-3">
                    <p className="text-sm font-medium">{vm.buildingTitle}</p>
                    <For each={vm.quotePackages} getKey={(p, i) => `${p.packageId}-${i}`}>
                      {(pkg) => (
                        <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                          <span>{pkg.title}</span>
                          <Show when={pkg.price}>
                            {(price) => <span>${price.toLocaleString()}</span>}
                          </Show>
                        </div>
                      )}
                    </For>
                    <div className="mt-2 flex justify-between border-t pt-2 text-sm font-medium">
                      <span>Furniture total</span>
                      <span>${vm.totalPrice.toLocaleString()}</span>
                    </div>
                  </section>

                  <section className="space-y-2">
                    <input
                      value={contact.name}
                      onChange={field('name')}
                      placeholder="Full name *"
                      className="w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                    />
                    <input
                      value={contact.email}
                      onChange={field('email')}
                      type="email"
                      placeholder="Email *"
                      className="w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                    />
                    <input
                      value={contact.phone}
                      onChange={field('phone')}
                      placeholder="Phone"
                      className="w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                    />
                    <input
                      value={contact.company}
                      onChange={field('company')}
                      placeholder="Company"
                      className="w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                    />
                  </section>

                  <Show when={vm.submitState.phase === 'error' && vm.submitState}>
                    {(state) => (
                      <p className="text-xs text-destructive">
                        {'message' in state ? state.message : ''}
                      </p>
                    )}
                  </Show>

                  <button
                    type="button"
                    disabled={vm.submitState.phase === 'submitting'}
                    onClick={() => void vm.onSubmit(contact)}
                    className="w-full rounded-md bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
                  >
                    {vm.submitState.phase === 'submitting' ? 'Sending…' : 'Send quote request'}
                  </button>
                </div>
              </Match>
            </Switch>
          </div>
        </div>
      </Show>
    </>
  )
}
