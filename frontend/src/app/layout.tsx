import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import '../../styles/globals.css';
import './globals.css';
import NavbarWrapper from '../components/NavbarWrapper';
import ChatbotInitializer from '../components/ChatbotInitializer';
{/*import ConditionalTopNavbar from '../components/ConditionalTopNavbar';*/}
import { ToastProvider } from '../contexts/ToastContext';
import ReduxProvider from '../providers/ReduxProvider';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Digital Transformation Center",
  description: "Inventory Management System for Digital Transformation Center",
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/dtc-logo.png', type: 'image/png', sizes: '32x32' },
    ],
    shortcut: '/favicon.ico',
    apple: '/dtc-logo.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable}`}>
        <ReduxProvider>
        <ToastProvider>
          {/*<ConditionalTopNavbar />*/}
          {children}
          <NavbarWrapper />
            <ChatbotInitializer />
        </ToastProvider>
        </ReduxProvider>
      </body>
    </html>
  );
}
