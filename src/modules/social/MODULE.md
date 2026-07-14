# social (client)

> **Scope of this file:** non-obvious context only. If something is obvious from `index.ts` or by reading a few files, do NOT add it here. Update this file in the same PR that changes the module's public surface, the things it owns, or its dependencies on other modules.

## Purpose

The **fake social proof**: a scripted "Live Chat" reel. Fixture-driven — **no network, no websocket, no backend, no persistence.** The reel plays from `social.fixtures.ts` on a local timer; the composer echoes typed messages into the same local list and sends nothing anywhere. This module is fabricated social proof rendered next to a real-money button — see the standing disclosure below.

The **LIVE WINS ticker was removed** when the trade page became a real trading surface: a marquee of fabricated wins above a live order ticket is the single loudest casino tell, and it framed trading as gambling. Do not reintroduce it.

## Public surface

- `ChatPanel` — the persistent right-column chat. Self-contained (owns its own state via `useChat`), takes no props. Header ("Live Chat" + collapse button left, settings cog right), auto-scrolling capped message list, and a bottom composer with a magenta "Chat" button. Renders three message kinds: plain text (per-user name color, `@mention` highlighting), inline **win-brag cards** (magenta-bordered, right-aligned multiplier badge), and **tip rows** (teal-highlighted). Collapsing hides the body/composer/footer, leaving only the header bar.
- `DISCLOSURE_TEXT` — the string `"Chat is simulated."`, exported for a **later phase** to render as a visible footer/near-surface disclosure (PRD §13 R5). This module does not render it itself.
- `ChatMessage` — the message-union type, for a consumer that wants to type against the reel.

The smart hook (`useChat`) and all sub-components are **private** — consumers mount `ChatPanel` and get the behavior for free.

## Owns

- The entire **chat fixture data set** (`social.fixtures.ts`): fake users and their name colors, the seed messages, and the looping scripted reel. This is the single file to edit to change what the crowd "says".
- The **scripted-append timer** (jittered `setTimeout`, `CHAT_APPEND_MIN/MAX_DELAY_MS`) and the **message retention cap** (`CHAT_MAX_MESSAGES`, ~80) that bounds memory. Both live in `social.constants.ts`.
- No DB tables, no API routes, no ports/adapters, no providers — this is a leaf UI module.

## Depends on

- `@/modules/shared/hooks/use-prefers-reduced-motion` — the only cross-module import. Chat auto-scroll degrades from `smooth` to an instant jump under reduced motion.
- `lucide-react` — icons (`Settings`, `PanelRightClose`, `Gift`, `Send`, `Smile`).
- `shared` icon plumbing — `iconCandidatesForSymbol` + `useIconLadder` resolve the real token icon on chat win-brag thumbs (monogram fallback when the ladder exhausts).
- The casino palette CSS variables (`--bg-*`, `--accent-*`, `--win`, `--text-*`) with **hard hex fallbacks** (`var(--accent-action, #cf38dd)`), so the module renders correctly whether or not the design-tokens phase has defined them yet.

## Cross-app contract

None — the social surface is entirely client-side fabrication. There is deliberately no backend (PRD D4: "No real chat. No WebSocket, no moderation, no persistence.").

## Gotchas

- **This is a simulated crowd next to a real-money button.** `social.fixtures.ts` carries a standing header comment to this effect, and `DISCLOSURE_TEXT` exists so the admission is rendered somewhere visible. Do not remove either without replacing the disclosure.
- The chat composer is **local echo only** — `handleSubmit` appends a `You` text message to the in-memory list and clears the draft. It must never gain a network call; that would contradict D4 and turn fabricated social proof into a real chat surface.
- The append timer self-reschedules with a fresh jitter each tick (not a fixed `setInterval`), so the crowd does not tick in on a mechanical beat. Tests pin `Math.random` to make the gap deterministic.
- Per-user name colors and the win-card gradients are **data-driven inline styles** (color from the fixture, gradient hashed from the market symbol) — this is the one legitimate place inline `style` beats a CSS Module, since the values are enumerated in data, not known at author time.

## Out of scope

- Rendering `DISCLOSURE_TEXT` — a later shell/footer phase owns where the disclosure appears.
- Mounting the panel into the three-column shell and mobile "Chat" tab — the `app/` shell phase wires these in.
- Any real messaging, moderation, presence, or win feed — permanently out of scope (D4).
- A LIVE WINS ticker, or any other fabricated-win marquee — deliberately removed, see Purpose.
