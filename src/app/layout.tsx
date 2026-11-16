import type { Metadata } from "next";
import { Inter, Montserrat } from "next/font/google";
import "./globals.css";
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import QueryProvider from '@/lib/providers/query-provider'
import SplashScreen from '@/components/SplashScreen';
import './splash.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-montserrat',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://mbw202clubindonesia.vercel.app'),
  title: {
    default: 'Mercedes Benz W202 Club Indonesia',
    template: '%s | Mercedes Benz W202 Club Indonesia',
  },
  description:
    'Mercedes-Benz W202 Club Indonesia adalah komunitas pecinta Mercedes-Benz seri W202 di Indonesia.',
  other: {
    'google-adsense-account': 'ca-pub-1586411952757444',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Mercedes-Benz W202 Club Indonesia',
    url: 'https://mbw202club.id',
    logo: 'https://mbw202clubindonesia.vercel.app/logo.png',
    description: 'Mercedes-Benz W202 Club Indonesia adalah komunitas pecinta Mercedes-Benz seri W202 di Indonesia.',
    sameAs: [
      'https://instagram.com/mbw202club',
    ],
    contactPoint: {
      '@type': 'ContactPoint',
      email: 'info@mbw202club.id',
      contactType: 'Customer Service',
      availableLanguage: 'Indonesian',
    },
  }

  return (
    <html lang="id">
      <head>
        <meta name="google-adsense-account" content="ca-pub-1586411952757444" />
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1586411952757444"
          crossOrigin="anonymous"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
      </head>
      <body
        className={`${inter.variable} ${montserrat.variable} font-sans`}
      >
        
        <QueryProvider>
          <SplashScreen>
          <Navbar />
          <main>{children}</main>
          <Footer />
          </SplashScreen>
        </QueryProvider>
      </body>
    </html>
  );
}
