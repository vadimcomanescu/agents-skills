import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Shepherd Acceptance Playground",
  description: "Real app target for Shepherd acceptance QA evidence."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
