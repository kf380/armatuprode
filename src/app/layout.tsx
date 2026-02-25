import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ArmatuProde - Competencia Social Futbolistica",
  description: "Crea tu prode, invita amigos, demostra quien sabe mas.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "ArmatuProde",
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "ArmatuProde",
    description: "Arma tu prode, invita amigos y demostra quien sabe mas de futbol",
    type: "website",
    siteName: "ArmatuProde",
  },
  twitter: {
    card: "summary_large_image",
    title: "ArmatuProde",
    description: "Arma tu prode, invita amigos y demostra quien sabe mas de futbol",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#0A0E1A",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
