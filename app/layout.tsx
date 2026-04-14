import type { Metadata } from "next";
import { Chakra_Petch, Nunito } from "next/font/google";
import { PrivyProviderWrapper } from "@/components/providers/privy-provider";
import "./globals.css";

const chakraPetch = Chakra_Petch({
  variable: "--font-chakra-petch",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
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
      className={`${chakraPetch.variable} ${nunito.variable} h-full`}
    >
      <body className="min-h-full flex flex-col">
        <PrivyProviderWrapper>{children}</PrivyProviderWrapper>
      </body>
    </html>
  );
}
