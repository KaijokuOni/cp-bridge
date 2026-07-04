import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CP Bridge",
  description:
    "Real-time bridge between two PCs with a built-in AI that solves competitive-programming problems from text or screenshots.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
