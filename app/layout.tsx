import type { Metadata } from "next";
import { Rubik, Nunito } from "next/font/google";
import { PrivyProviderWrapper } from "@/components/providers/privy-provider";
import "./globals.css";

const rubik = Rubik({
  variable: "--font-rubik",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Whotnad — Play for MON",
  description:
    "Nigeria's card game, on-chain. 1v1 matches for MON prizes. Weekly seasons. AI opponents. Built on Monad.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${rubik.variable} ${nunito.variable} h-full`}
    >
      <body className="min-h-full flex flex-col">
        <PrivyProviderWrapper>{children}</PrivyProviderWrapper>
      </body>
    </html>
  );
}
