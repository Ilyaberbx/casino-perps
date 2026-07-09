export interface VenueErrorToastInput {
  /** The action-specific toast title, e.g. 'Close rejected', 'Order not modified'. */
  readonly title: string
  /** The venue error; only its `message` is read (stripped for display). */
  readonly error: { readonly message: string }
  /** Optional toast id — set when the builder updates a pending toast in place. */
  readonly toastId?: string
}
