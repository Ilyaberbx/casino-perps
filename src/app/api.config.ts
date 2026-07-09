// Backend API base URL. Empty string means same-origin (the default during
// `pnpm dev` when Vite proxies `/api/*`); set `VITE_API_BASE_URL` to point at
// a deployed backend (e.g. `https://api.example.com`).
const baseUrl = import.meta.env.VITE_API_BASE_URL ?? ''

export const API_BASE_URL: string = baseUrl.replace(/\/$/, '')
