import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from '@/components/AuthProvider';
import Header from '@/components/Header';

const inter = Inter({
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DisLab - Discord Tools",
  description: "Schedule Discord webhooks and manage your Discord tools with ease",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} antialiased min-h-screen`}>
        <AuthProvider>
          <Header />
          {children}
          <Toaster position="top-right" />
        </AuthProvider>
      </body>
    </html>
  );
}
