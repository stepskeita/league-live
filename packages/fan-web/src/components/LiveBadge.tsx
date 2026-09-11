import styles from "./LiveBadge.module.css";

export function LiveBadge() {
  return (
    <span className={styles.badge}>
      <span className={styles.dot} />
      LIVE
    </span>
  );
}
