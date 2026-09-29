import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Friends Included Finance",
  description: "Internal finance system for Friends Included Ltd.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
