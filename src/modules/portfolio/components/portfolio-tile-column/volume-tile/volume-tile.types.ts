export interface UseVolumeTileReturn {
  volumeDisplay: string
  /** `true` when connected and the first snapshot has not arrived yet (loading). */
  isLoading: boolean
  isModalOpen: boolean
  onViewVolume: () => void
  onCloseModal: () => void
}
