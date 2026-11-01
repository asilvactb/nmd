import type { Metadata, Viewport } from "next";
import "./globals.css";
import { BottomNav } from "@/components/BottomNav";
import { SwRegister } from "@/components/SwRegister";
import { getMe } from "@/lib/db";

export const metadata: Metadata = {
  title: "NMD",
  description: "Nunca Mais é Domingo",
  appleWebApp: { capable: true, title: "NMD", statusBarStyle: "black-translucent" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { player } = await getMe();
  return (
    <html lang="pt-PT">
      <body className="font-sans antialiased">
        {children}
        <BottomNav isAdmin={!!player?.is_admin} />
        <SwRegister />
      </body>
    </html>
  );
}
