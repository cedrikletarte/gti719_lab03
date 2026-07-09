import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "IDPERSO",
  description: "Fournisseur d'identité maison (OAuth2)",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
