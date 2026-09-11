import Link from "next/link";
import styles from "./SiteHeader.module.css";

export function SiteHeader() {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href="/" className={styles.brand}>
          League<span className={styles.brandAccent}>Live</span>
        </Link>
        <nav className={styles.nav}>
          <Link href="/" className={styles.navLink}>
            Live Scores
          </Link>
          <Link href="/fixtures" className={styles.navLink}>
            Fixtures &amp; Results
          </Link>
        </nav>
      </div>
    </header>
  );
}
