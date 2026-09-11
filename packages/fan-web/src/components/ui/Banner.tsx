import type { ReactNode } from "react";
import styles from "./Banner.module.css";

export interface BannerProps {
  variant?: "error" | "info";
  children: ReactNode;
}

export function Banner({ variant = "info", children }: BannerProps) {
  return <div className={`${styles.banner} ${styles[variant]}`}>{children}</div>;
}
