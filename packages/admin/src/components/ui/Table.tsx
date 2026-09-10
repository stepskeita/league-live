"use client";

import type { ReactNode } from "react";
import styles from "./Table.module.css";

export interface Column<T> {
  key: string;
  label: string;
  render: (row: T) => ReactNode;
  align?: "left" | "right";
}

export interface TableProps<T> {
  columns: Column<T>[];
  rows: T[] | null;
  rowKey: (row: T) => string;
  emptyMessage?: string;
}

/** A generic table: pass columns + rows, get loading/empty states for free — every resource list page in this panel uses this instead of hand-rolling its own <table>. */
export function Table<T>({ columns, rows, rowKey, emptyMessage = "Nothing here yet." }: TableProps<T>) {
  if (rows === null) {
    return (
      <div className={styles.wrapper}>
        <div className={styles.loading}>Loading…</div>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className={styles.wrapper}>
        <div className={styles.empty}>{emptyMessage}</div>
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} style={column.align === "right" ? { textAlign: "right" } : undefined}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((column) => (
                <td key={column.key} style={column.align === "right" ? { textAlign: "right" } : undefined}>
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
