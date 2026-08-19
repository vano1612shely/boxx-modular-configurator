'use client'

import { CircleCheck, FileText, TriangleAlert, X } from 'lucide-react'
import { useState } from 'react'

import type { BuildingScene } from '@/entities/building'
import type { FurniturePackageEntity } from '@/entities/furniture-package'
import { fillTokens } from '@/modules/shared/quiz-copy'
import {
  Callout,
  Card,
  Eyebrow,
  Field,
  OVERLAY_Z,
  Pill,
  PillLink,
  SceneOverlay,
} from '@/shared/ui/boxx'
import { For, Match, Show, Switch } from '@/shared/ui/control-flow'

import { useQuoteSummaryModel, type IntegrationOptions } from '../model/use-quote-summary-model'

type Props = {
  building: BuildingScene
  packages: FurniturePackageEntity[]
  integration: IntegrationOptions
}

const requiredMark = (
  <span aria-hidden className="text-brand">
    *
  </span>
)

export function QuoteDialog({ building, packages, integration }: Props) {
  const vm = useQuoteSummaryModel({ building, packages, integration })
  const [open, setOpen] = useState(false)
  const [contact, setContact] = useState({ name: '', email: '', phone: '', company: '' })

  const field = (key: keyof typeof contact) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setContact((prev) => ({ ...prev, [key]: event.target.value }))

  return (
    <>
      {/* Down by the padding the header bar puts around its own pills, so this
          one sits on their line rather than eight pixels above it. Both are the
          same pill in the same size; only one of them is in a bar. */}
      <SceneOverlay corner="top-right" z="quote" className="pt-2">
        <Pill
          variant="primary"
          labelFrom="desktop"
          leadingIcon={<FileText size={16} />}
          onClick={() => setOpen(true)}
          className="shadow-xl shadow-ink/15"
        >
          Request a quote
        </Pill>
      </SceneOverlay>

      <Show when={open}>
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Request a quote"
          className="absolute inset-0 flex items-center justify-center bg-ink/40 p-4"
          style={{ zIndex: OVERLAY_Z.modal }}
        >
          <Card
            tone="cream"
            elevation="float"
            pad="md"
            className="flex max-h-[85dvh] w-full max-w-md flex-col gap-block overflow-y-auto"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <Eyebrow>Your configuration</Eyebrow>
                <h2 className="text-xl leading-normal font-medium">Request a quote</h2>
              </div>
              <Pill variant="secondary" size="sm" aria-label="Close" onClick={() => setOpen(false)}>
                Close
                <X size={14} className="shrink-0" />
              </Pill>
            </div>

            <Switch>
              <Match when={vm.submitState.phase === 'success' && vm.submitState}>
                {(state) => (
                  <Callout
                    tone="success"
                    align="center"
                    icon={<CircleCheck />}
                    title={integration.success.title}
                    action={
                      <>
                        {/* The 3D view of what was just ordered. Opened in its
                            own tab: the visitor may still be mid-redirect. */}
                        <Show when={integration.success.showOrderLink ? state.reference : null}>
                          {(reference) => (
                            <PillLink
                              href={`/order/${encodeURIComponent(reference)}`}
                              variant="primary"
                              target="_blank"
                              rel="noopener"
                            >
                              {integration.success.viewOrderLabel}
                            </PillLink>
                          )}
                        </Show>
                        {/* A real anchor, because an automatic redirect can be
                            refused — the activation from the press was spent
                            waiting on the server. One click beats a dead end. */}
                        <Show when={state.target.kind === 'external' ? state.target.href : null}>
                          {(href) => (
                            <PillLink href={href} variant="secondary" target="_top" rel="noopener">
                              Continue
                            </PillLink>
                          )}
                        </Show>
                      </>
                    }
                  >
                    {fillTokens(integration.success.body, { reference: state.reference })}
                  </Callout>
                )}
              </Match>
              <Match when={vm.submitState.phase !== 'success'}>
                <div className="flex flex-col gap-card">
                  <Card as="section" radius="card" elevation="none" pad="sm" hairline>
                    <p className="text-base leading-normal font-medium">{vm.buildingTitle}</p>
                    <For each={vm.packagesByRoom} getKey={(room) => room.key}>
                      {(room) => (
                        <div className="mt-3">
                          <Eyebrow as="h3">{room.name}</Eyebrow>
                          <For each={room.packages} getKey={(p, i) => `${p.packageId}-${i}`}>
                            {(pkg) => (
                              <div className="mt-1 flex justify-between gap-4 text-sm">
                                <span>{pkg.title}</span>
                                <Show when={pkg.price}>
                                  {(price) => (
                                    <span className="shrink-0 text-muted-foreground">
                                      ${price.toLocaleString()}
                                    </span>
                                  )}
                                </Show>
                              </div>
                            )}
                          </For>
                        </div>
                      )}
                    </For>

                    <Show when={vm.quoteExterior.length > 0}>
                      <div className="mt-3">
                        <Eyebrow as="h3">Entrances</Eyebrow>
                        <For each={vm.quoteExterior} getKey={(spot) => spot.slotKey}>
                          {(spot) => (
                            <div className="mt-1 flex justify-between gap-4 text-sm">
                              <span>
                                {spot.slotName}
                                <span className="text-muted-foreground">{' · '}</span>
                                {spot.title}
                              </span>
                              <Show when={spot.price}>
                                {(price) => (
                                  <span className="shrink-0 text-muted-foreground">
                                    ${price.toLocaleString()}
                                  </span>
                                )}
                              </Show>
                            </div>
                          )}
                        </For>
                      </div>
                    </Show>

                    {/* A total of $0 reads as free rather than as unpriced. */}
                    <Show when={vm.hasPrices}>
                      <div className="mt-3 flex justify-between gap-4 border-t pt-3 text-base font-medium">
                        <span>Total</span>
                        <span className="shrink-0">${vm.totalPrice.toLocaleString()}</span>
                      </div>
                    </Show>
                  </Card>

                  <Field.Text
                    label={<>Full name {requiredMark}</>}
                    value={contact.name}
                    onChange={field('name')}
                    required
                    autoComplete="name"
                  />
                  <Field.Text
                    label={<>Email {requiredMark}</>}
                    type="email"
                    value={contact.email}
                    onChange={field('email')}
                    required
                    autoComplete="email"
                  />
                  <Field.Text
                    label="Phone"
                    type="tel"
                    value={contact.phone}
                    onChange={field('phone')}
                    autoComplete="tel"
                  />
                  <Field.Text
                    label="Company"
                    value={contact.company}
                    onChange={field('company')}
                    autoComplete="organization"
                  />

                  <Show when={vm.submitState.phase === 'error' && vm.submitState}>
                    {(state) => (
                      <Callout tone="danger" icon={<TriangleAlert />} className="p-4">
                        {'message' in state ? state.message : ''}
                      </Callout>
                    )}
                  </Show>

                  <Pill
                    variant="primary"
                    block
                    disabled={vm.submitState.phase === 'submitting'}
                    onClick={() => void vm.onSubmit(contact)}
                  >
                    {vm.submitState.phase === 'submitting' ? 'Sending…' : 'Send quote request'}
                  </Pill>
                </div>
              </Match>
            </Switch>
          </Card>
        </div>
      </Show>
    </>
  )
}
