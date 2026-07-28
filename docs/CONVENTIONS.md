Generic Fullstack Code Conventions (Payload CMS + React/Next + shadcn)
Project-agnostic version, distilled from a Next 16 / Payload 3 / Tailwind4 / shadcn / next-intl corporate-site codebase. Strip anything content-specific (news, pages, docs) — keep the structural patterns. Applicable to a project with heavy 3D/canvas work as much as a corporate site: the rules govern where state lives and how modules are shaped, not what the UI shows.

0. Principle
   Code should be easy to read and write and scream what it does — declarative, no noise. Senior-level bar. Debatable cases get discussed; the conventions themselves are followed always.

1. Architecture — two independent layers
   Frontend — simplified Feature-Sliced Design (FSD):

shared → entities → features → widgets → views → app/providers
A lower layer never imports a higher one.
app/ (Next routing or equivalent) is a THIN routing layer only — no business logic.
views/ = FSD "pages" (renamed to avoid a router-name clash) — page composition.
providers/ = FSD "app" layer (theme, i18n, global styles), wired at the root.
Every slice exposes a public API via index.ts; import only from the slice root (@/features/scene-editor), never a deep path (@/features/scene-editor/ui/Toolbar).
Segments inside a slice: ui/ model/ lib/ api/ config/.
Backend (Payload) — domain-modular:

payload.config.ts defines nothing itself — it only aggregates modules from src/modules/index.ts.

src/modules/<domain>/
collections/ # domain collections
globals/ # domain globals
fields/ # reusable field definitions
blocks/ # Payload blocks (for content, if there's RichText/Page Builder)
hooks/ # domain collection/field hooks
access/ # domain access-control rules
endpoints/ # domain custom REST/GraphQL endpoints — not scattered elsewhere
types.ts
index.ts # public API: PayloadModule { collections?, globals?, blocks? }
A new domain = a new src/modules/<domain>/ with an index.ts, registered in the aggregator.

Pairing: each backend domain ↔ a frontend domain. Payload blocks/ map to widgets/. Non-corporate example: modules/scenes (CMS description of 3D scenes) ↔ entities/scene + widgets/scene-viewer. shadcn components live in shared/ui, helpers in shared/lib/utils.

2. MVVM for interactive slices
   Every interactive module (not a dumb presentational one) splits into:

Model — data sources (RSC / Local API / Server Actions / entities / a WebSocket stream, etc).
ViewModel — a use<Slice>Model() hook: all state + business logic + handlers. Returns a typed, flat vm object. No JSX inside.
View — presentational components. Receive ready-made data; no logic in JSX.
Static, stateless sections don't need a ViewModel — don't force MVVM onto dumb components. But use the declarative control-flow primitives (below) everywhere, even in simple components.

export function useSceneEditorModel() {
const [tool, setTool] = useState<Tool>('select')
const { scene, isLoading, error } = useScene(sceneId)
return {
scene,
isLoading,
isEmpty: !isLoading && !scene,
error,
tool: { value: tool, onChange: setTool, items: TOOL_OPTIONS },
}
}
ViewModel hook naming: use<Slice>Model.
Handlers are named with verbs; outward event props are on<Event>. 3. Module anatomy & ModuleEntry
<slice>/
model/ # ViewModel hooks, state, logic, vm types
ui/ # View (components) + Layout (composition)
lib/ # pure helpers
config.ts # constants, static data
api/ # data access (server actions, fetchers) — as needed
index.ts # PUBLIC API = ModuleEntry
index.ts exports one composition root. Wrap complex/async modules (e.g. ones loading heavy 3D assets) in withModule — adds ErrorBoundary + Suspense so a module's failure/loading doesn't break the page.

export const SceneEditorModule = withModule(SceneEditorView, { errorFallback: <ModuleError /> }) 4. Layout — separate from content, compound via Object.assign
function Root({ children }: PropsWithChildren) { /_ grid/canvas-wrapper _/ }
function Toolbar({ children }: PropsWithChildren) { /_ … _/ }
function Viewport({ children }: PropsWithChildren) { /_ … _/ }
export const EditorLayout = Object.assign(Root, { Toolbar, Viewport })
Layout is responsible for composition only, not data/logic — which makes it trivially reusable.

5. Declarative control-flow — {cond && <…/>} / ternaries are FORBIDDEN for non-trivial rendering
   Use unified primitives (port from shared/ui/control-flow):

Primitive Purpose
<Show when={…} fallback> conditional render; render-prop receives the narrowed value
<For each={…} fallback getKey> lists; keys + empty state in one place
<Switch><Match when>… multi-branch selection
<Gate loading error empty …> async state (loader → error → empty → content)
<Gate loading={vm.isLoading} error={vm.error} empty={vm.isEmpty} emptyFallback={<Empty />}>
<For each={vm.scenes} fallback={<Empty />}>{(s) => <SceneCard scene={s} />}</For>
</Gate>
A trivial single-element render ({x && <Badge/>} with no branching) is an acceptable spot exception — but default to the primitives.

6. UI-kit abstractions (shadcn/radix) — two levels
   Level 1 — single-component wrappers. App code never touches Trigger/Content/Group directly. Example: <Tooltip content={…}>{trigger}</Tooltip> instead of Tooltip.Root > Tooltip.Trigger > Tooltip.Content. Rare complex cases needing raw parts live in shared/ui/<comp>/primitives. Wrappers: controlled+uncontrolled, forwardRef, full a11y, variants via tailwind-variants (tv), not CVA, data-slot attributes.

Level 2 — domain components. Encapsulate render + styles + behavior (debounce, throttle, a raf loop for 3D, etc), exposing minimal props outward:

// entities/scene/ui/SceneVisibilitySelect.tsx
type Props = { value: Visibility; onChange: (v: Visibility) => void; items: VisibilityOption[] }
export function SceneVisibilitySelect({ value, onChange, items }: Props) { /_ Select + styles _/ } 7. Render-prop & Slot — composition over boolean props
Render-prop for data flow: For/Show/Gate accept (value) => ReactNode.
Slot / asChild (Radix) for polymorphism: <Button asChild><Link …/></Button>.
Composition via children/slots beats a pile of boolean props (showIcon, variant2, isCompactMode, …). 8. Other rules
Server Components by default; 'use client' only when interactivity is actually needed (state, effects, event handlers, a canvas/WebGL context, etc).
Styling — Tailwind utilities with theme tokens only; avoid raw hex outside globals.css; compose classes via cn().
Data/state: RSC + Server Actions + ViewModel by default; a client-side data-fetching layer (TanStack Query or equivalent) is added only once there's a real need (polling, optimistic updates, realtime) — at that point it becomes part of the Model. Server actions return Result<T>, they don't throw.
Validate external data (forms, API responses, WS messages) with Zod at the module boundary.
Naming: slices kebab-case, components/types PascalCase, hooks use*, ViewModel hooks use*Model, filename = component name. Props type co-located with component. 9. What NOT to carry over 1:1 (previous-project specifics)
Ties to specific domains (news, press-center, pages, trades) — replace with the new project's own domains.
RichText/TextState specifics (Lexical text-color palettes) — only relevant if the new project also has a rich-text editor via Payload Lexical.
Specific libraries (next-intl, the particular seed-script approach) — carry over the principle (env-driven config, non-destructive seeding), not the code.
