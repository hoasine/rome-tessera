import type { Metadata } from "next";
import { DM_Sans, Libre_Caslon_Display } from "next/font/google";
import { WalletProvider } from "@/components/wallet-provider";
import { SiteFooter, SiteHeader, TransactionToast } from "@/components/ui";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

const caslon = Libre_Caslon_Display({
  variable: "--font-caslon",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Tessera - Check-in badges for both wallet worlds",
  description:
    "Event check-in badges that MetaMask and Solflare users claim by scanning a QR code, with Solana attendance proven on-chain by Rome.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${dmSans.variable} ${caslon.variable}`}>
      <body>
        <WalletProvider>
          <SiteHeader />
          {children}
          <SiteFooter />
          <TransactionToast />
        </WalletProvider>
      </body>
    </html>
  );
}
