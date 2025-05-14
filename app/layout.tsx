import { Toaster } from 'sonner';
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { ThemeProvider } from '@/components/theme-provider';

import './globals.css';
import { SessionProvider } from 'next-auth/react';

export const metadata: Metadata = {
  metadataBase: new URL('https://open-notion-ai.vercel.app/'),
  title: {
    default: 'OpenNotionAI',
    template: '%s | OpenNotionAI',
  },
  description:
    'OpenNotionAI: Open source alternative to Notion AI. Connect your LLM API (OpenAI, Anthropic, etc.) and chat with your Notion database from any device. Free, self-hostable, and private.',
  keywords: [
    'Notion AI',
    'Open Source',
    'LLM',
    'OpenAI',
    'Anthropic',
    'Chat with Notion',
    'Self-hostable AI',
    'Private AI',
    'Notion Database',
    'AI Chatbot',
  ],
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  alternates: {
    canonical: 'https://open-notion-ai.vercel.app/',
  },
  openGraph: {
    title: 'OpenNotionAI',
    description:
      'OpenNotionAI: Open source alternative to Notion AI. Connect your LLM API and chat with your Notion database. Free, self-hostable, and private.',
    url: 'https://open-notion-ai.vercel.app/',
    siteName: 'OpenNotionAI',
    images: [
      {
        url: '/opengraph-image.png', // Assuming you have this in your public folder
        width: 1200,
        height: 630,
        alt: 'OpenNotionAI Banner',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'OpenNotionAI',
    description:
      'OpenNotionAI: Open source alternative to Notion AI. Connect your LLM API and chat with your Notion database. Free, self-hostable, and private.',
    images: ['/twitter-image.png'], // Assuming you have this in your public folder
    creator: '@yourtwitterhandle', // Replace with your actual Twitter handle
  },
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
    apple: '/apple-touch-icon.png', // Assuming you will add this
  },
  manifest: '/site.webmanifest', // Assuming you will add this
};

export const viewport = {
  maximumScale: 1, // Disable auto-zoom on mobile Safari
};

const geist = Geist({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-geist',
});

const geistMono = Geist_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-geist-mono',
});

const LIGHT_THEME_COLOR = 'hsl(0 0% 100%)';
const DARK_THEME_COLOR = 'hsl(240deg 10% 3.92%)';
const THEME_COLOR_SCRIPT = `\
(function() {
  var html = document.documentElement;
  var meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    document.head.appendChild(meta);
  }
  function updateThemeColor() {
    var isDark = html.classList.contains('dark');
    meta.setAttribute('content', isDark ? '${DARK_THEME_COLOR}' : '${LIGHT_THEME_COLOR}');
  }
  var observer = new MutationObserver(updateThemeColor);
  observer.observe(html, { attributes: true, attributeFilter: ['class'] });
  updateThemeColor();
})();`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      // `next-themes` injects an extra classname to the body element to avoid
      // visual flicker before hydration. Hence the `suppressHydrationWarning`
      // prop is necessary to avoid the React hydration mismatch warning.
      // https://github.com/pacocoursey/next-themes?tab=readme-ov-file#with-app
      suppressHydrationWarning
      className={`${geist.variable} ${geistMono.variable}`}
    >
      <head>
        <meta
          name="theme-color"
          media="(prefers-color-scheme: light)"
          content={LIGHT_THEME_COLOR}
        />
        <meta
          name="theme-color"
          media="(prefers-color-scheme: dark)"
          content={DARK_THEME_COLOR}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: THEME_COLOR_SCRIPT,
          }}
        />
      </head>
      <body className="antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <Toaster position="top-center" />
          <SessionProvider>{children}</SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
