import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "mcmcp — Build Minecraft Schematics with AI",
  description:
    "Connect Claude to your Minecraft world through MCP. Place blocks, fill regions, and export .litematic files — all in real-time with a live 3D viewer.",
  openGraph: {
    title: "mcmcp — Build Minecraft Schematics with AI",
    description:
      "Connect Claude to your Minecraft world through MCP. Place blocks, fill regions, and export .litematic files — all in real-time with a live 3D viewer.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
