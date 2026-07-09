/**
 * Floor for the horizontal compression. Content never squeezes below half its
 * natural width — past this, characters become unreadable, so we accept clipping
 * instead of compressing further.
 */
export const MIN_SCALE = 0.5
