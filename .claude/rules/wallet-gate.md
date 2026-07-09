# Wallet Gate Rules

How to render UI when the User is not connected. Three modes — pick the one that fits the surface, never invent a new one.

> **Mode-4 (venue onboarding) is documented separately.** When the wallet *is* connected but the active venue requires onboarding (e.g. Hyperliquid agent + builder approval) before trading, the composite side-sheet + global banner + gated submit pattern from **ADR-0026** applies. Mode-4 stacks with modes 1-3: if the wallet is disconnected, mode-3 wins on the submit button; once connected but onboarding incomplete, mode-4 takes over. The mode-4 primitives (`<VenueOnboardingSheet>`, `<VenueOnboardingBanner>`, `<VenueOnboardingGateButton>`) ship in subsequent slices of `.design/hyperliquid-onboarding/`; the predicate hooks (`useIsVenueOnboardingReady`, `useIsVenueCapabilityReady`) live in `shared/hooks/`. See `docs/adr/0026-venue-onboarding-port.md` for the full spec.

The only gate predicate is `useIsWalletConnected()` from `account/`. Do not branch on `useAuth().authenticated` directly, do not branch on `walletAddress != null`, do not invent module-local `isConnected` flags. There is one source of truth.

The two reusable primitives live in `modules/account/components/` (consistent with ADR-0004 — `account/` is openly Privy-coupled, no port/adapter):

- `<DisconnectedTablePlaceholder message>` — wraps a list/table panel.
- `<ConnectWalletGateButton>{children}</ConnectWalletGateButton>` — wraps a feature submit button; renders nothing when disconnected.

The third mode (empty values for scalar tiles) does not need a wrapper component — it's an inline conditional at the consumer.

## Mode 1 — Empty values (scalar tiles)

A tile that shows a single number (Account Value, PnL, Volume, Fees) renders the placeholder string when disconnected and the real value when connected. Inline conditional at the consumer; **no wrapping component**, no CTA button.

Copy convention:

- Currency values → `$0.00`
- Percentages, counts, ratios → `--`

```tsx
const isConnected = useIsWalletConnected()
const display = isConnected ? formatUsd(accountValue) : '$0.00'
return <Tile label="Account Value" value={display} />
```

## Mode 2 — Table placeholder (lists, positions, orders, history)

A panel that lists rows renders a centered placeholder text when disconnected. Use `<DisconnectedTablePlaceholder>`. Text only — **no button, no CTA inside the panel**. The Connect-Wallet entry point lives in the header (`AccountMenu`).

Copy convention: `Connect wallet to view {thing}` — e.g. `"Connect wallet to view positions"`, `"Connect wallet to view open orders"`.

```tsx
<DisconnectedTablePlaceholder message="Connect wallet to view positions">
  <PositionsTable rows={positions} />
</DisconnectedTablePlaceholder>
```

## Mode 3 — Hide the affordance (feature submit actions)

A button that requires a connected wallet (Place Order, Close Position, Confirm Withdrawal, Deposit) is wrapped with `<ConnectWalletGateButton>`. When connected, the wrapper renders the consumer's normal button. When disconnected, the wrapper renders **nothing** — the affordance is simply absent. The single Connect-Wallet entry point for the whole app lives in the header `AccountMenu` (consistent with modes 1 and 2, where the header owns connect); a disconnected submit slot does not get its own CTA.

```tsx
<ConnectWalletGateButton>
  <button type="submit" onClick={placeOrder}>Place Order</button>
</ConnectWalletGateButton>
```

> **History:** mode-3 originally swapped the affordance for a bare `Connect Wallet` button. That button never adopted the pixel button styling and duplicated the header's connect entry point, so it was removed in favour of hiding the affordance. See `docs/adr/0031-connect-wallet-gate-hides-when-disconnected.md`.

## What not to do

- Do not block the whole page with a modal or a full-page CTA when the User is disconnected. The page renders; the data inside it switches mode.
- Do not put a `Connect Wallet` button inside a tile or table panel — that is mode-mixing. Tiles get empty values, tables get text placeholders, submit affordances are hidden. The header `AccountMenu` is the only Connect-Wallet CTA.
- Do not introduce a new mode without an ADR — the three above cover every disconnected surface in the app.
- Do not duplicate `useIsWalletConnected`'s logic in feature modules.

## Cross-references

- `docs/adr/0004-no-account-adapter-port.md` — why these primitives live in `account/`.
- `apps/client/src/modules/account/MODULE.md` — public surface of the primitives.
- `docs/adr/0026-venue-onboarding-port.md` — mode-4 composite (venue onboarding) spec.
