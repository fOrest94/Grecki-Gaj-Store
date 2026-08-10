import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const headerList = await headers();
  const host = headerList.get("host") || "localhost:3000";
  const protocol =
    headerList.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const origin = protocol + "://" + host;

  return {
    title: "Grecki Gaj | Oliwa i greckie produkty",
    description:
      "Rodzinna oliwa extra virgin i greckie produkty importowane z Grecji, magazynowane i wysyłane z Polski.",
    icons: {
      icon: "/favicon.svg",
      shortcut: "/favicon.svg",
    },
    openGraph: {
      title: "Grecki Gaj",
      description: "Oliwa z rodzinnego gaju.",
      type: "website",
      locale: "pl_PL",
      images: [{ url: origin + "/og.png", width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Grecki Gaj",
      description: "Oliwa z rodzinnego gaju.",
      images: [origin + "/og.png"],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl">
      <body>{children}</body>
    </html>
  );
}
