import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SiteHeader } from "../components/SiteHeader";
import "./globals.css";

export const metadata: Metadata = {
  title: "LeagueLive",
  description: "Live scores, fixtures, and results across every competition on LeagueLive.",
};

// Plain ReactNode, not the generated LayoutProps<Route> helper: that type
// only exists after `next dev`/`next build`/`next typegen` has run at least
// once — see packages/admin/src/app/layout.tsx's identical note, the same
// reasoning applies to this fresh scaffold.
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SiteHeader />
        <main>{children}</main>
      </body>
    </html>
  );
}
