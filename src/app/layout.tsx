import type {Metadata} from 'next';
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import './globals.css';
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: 'RegexVision',
  description: 'Визуально создавайте и анализируйте сложные регулярные выражения с помощью ИИ.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className={`font-sans antialiased`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
