import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AuthProvider } from "../lib/auth-context";
import "./globals.css";

export const metadata: Metadata = {
  title: "LeagueLive Admin",
  description: "LeagueLive's admin panel.",
};

// Plain ReactNode, not the generated LayoutProps<Route> helper: that type
// only exists after `next dev`/`next build`/`next typegen` has run at least
// once (see node_modules/next/dist/docs/.../typescript.md) — this avoids
// every layout in this app depending on codegen having already happened.
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
