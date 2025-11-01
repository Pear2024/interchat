import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import ServiceWorkerRegister from "@/app/sw-register";
import { GA_TRACKING_ID } from "@/lib/ga";
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
  title: "InterChat App",
  description: "Realtime multilingual chat workspace.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#6366f1",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ServiceWorkerRegister />
        {GA_TRACKING_ID ? (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_TRACKING_ID}`}
              strategy="afterInteractive"
            />
            <Script id="google-analytics" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${GA_TRACKING_ID}');
              `}
            </Script>
          </>
        ) : null}
        {children}
      </body>
    </html>
  );
}
