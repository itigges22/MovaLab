import type { Metadata } from "next";
import { Raleway } from "next/font/google";
import "./globals.css";
import { Suspense } from "react";
import { Toaster } from "sonner";
import { ChunkErrorHandler } from "@/components/chunk-error-handler";
import { AuthProviderWrapper } from "@/components/auth-provider-wrapper";
import { SWRProvider } from "@/lib/swr-config";
import { ResourceHints } from "@/components/resource-hints";
import { LoadingProvider } from "@/components/loading-overlay";
import { AppWithClockProvider } from "@/components/app-with-clock-provider";

const raleway = Raleway({
  variable: "--font-raleway",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "MovaLab - Professional Service Automation",
  description: "Professional Service Automation Platform for MovaLab",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${raleway.variable} font-sans antialiased`}>
        <ResourceHints />
        <AuthProviderWrapper>
          <SWRProvider>
            <Suspense fallback={null}>
              <LoadingProvider>
                <ChunkErrorHandler />
                <AppWithClockProvider>
                  {children}
                </AppWithClockProvider>
                <Toaster />
              </LoadingProvider>
            </Suspense>
          </SWRProvider>
        </AuthProviderWrapper>
      </body>
    </html>
  );
}
