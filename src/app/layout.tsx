import type { Metadata, Viewport } from "next";
import { ThemeProvider } from "@/components/theme-provider";
import { ServiceWorkerRegistrar } from "@/components/sw-registrar";
import { PWAInstallPrompt } from "@/components/pwa-install-prompt";
import "./globals.css";

// Supabase 연동 앱이므로 빌드 시 정적 프리렌더링을 비활성화
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: {
    default: "KAACI_JR",
    template: "%s | KAACI_JR",
  },
  description: "KAACI_JR 비공개 비즈니스 네트워킹",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "KAACI_JR",
    startupImage: [],
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning className="h-dvh">
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const theme = localStorage.getItem('theme');
                if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                  document.documentElement.classList.add('dark');
                }
              } catch(e) {}
            `,
          }}
        />
      </head>
      <body className="antialiased h-dvh overflow-hidden">
        <ThemeProvider>
          {children}
          <ServiceWorkerRegistrar />
          <PWAInstallPrompt />
        </ThemeProvider>
      </body>
    </html>
  );
}
