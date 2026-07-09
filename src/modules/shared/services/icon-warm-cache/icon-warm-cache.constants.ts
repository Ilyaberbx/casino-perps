/** Icon URLs primed per idle slice in `warmMany`, so a large market universe is
 *  spread across several idle callbacks instead of one synchronous burst. */
export const WARM_BATCH_SIZE = 16

/** Abort a fire-and-forget icon prime after this long so a stalled CDN
 *  connection can't dangle indefinitely (the SW owns the durable cache; a
 *  dropped prime just means the <img> re-requests later). */
export const WARM_FETCH_TIMEOUT_MS = 8_000
