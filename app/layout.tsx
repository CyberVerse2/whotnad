import type { Metadata } from "next";
import { Rubik, Nunito } from "next/font/google";
import { PrivyProviderWrapper } from "@/components/providers/privy-provider";
import "./globals.css";

const rubik = Rubik({
  variable: "--font-rubik",
  subsets: ["latin"],
  display: "swap",
});

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Whot! — Nigeria's Card Game",
  description:
    "Nigeria's card game, online. 1v1 matches with points and seasons. AI opponents. Play now.",
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
