# Error Handling Rules

TypeScript code under `src/` uses **[`neverthrow`](https://github.com/supermacro/neverthrow)** (`Result<T, E>` / `ResultAsync<T, E>`) for expected, recoverable errors. Throw only for programmer errors (unreachable code, invariant violations) and at the boundaries of third-party libraries that already throw.

1. **Any function that can fail in an expected way returns a `Result` or `ResultAsync`**, not a thrown exception. "Expected" means: a `fetch` call, a `localStorage` / `sessionStorage` read, a `JSON.parse`, a schema parse, or any I/O could fail.
2. **Error types are typed.** Prefer a discriminated class per boundary (`FetchError` with a `kind` field, `StorageError`, `ParseError`) rather than plain `Error`.
3. **Wrap throwing third-party APIs at the boundary** with `ResultAsync.fromPromise(promise, coerceErr)` (or `Result.fromThrowable` for sync). After that point, no `try/catch` should appear in feature code.
4. **Consume Results with the neverthrow API** (`.map`, `.mapErr`, `.andThen`, `.orElse`). Use `isOk()`/`isErr()` branching only when you need to update React state or branch on control flow.
5. **State stores surface errors via state**, not thrown exceptions. Actions return `Promise<Result<T, E>>`, and any `error` field on the store/hook return is always kept in sync with the latest action.
6. **Components and hooks never `try/catch`** a Result-returning function. Branch on `result.isOk()` or read `error` from the hook return.

## When to throw

- Invariant checks (`if (!ctx) throw new Error('unreachable: canvas context guaranteed by mount')`)
- Inside a `ResultAsync.fromPromise` / `Result.fromThrowable` wrapper — the throw is immediately converted to an `err`
- React render errors that should bubble to an error boundary (let them throw; don't `try/catch` them)
