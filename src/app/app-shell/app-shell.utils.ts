import styles from './app-shell.module.css'
import type { NavLinkClassNameArgs } from './app-shell.types'

export function navLinkClassName({ isActive }: NavLinkClassNameArgs): string {
  return isActive ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink
}
