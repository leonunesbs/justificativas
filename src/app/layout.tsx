import '@/styles/globals.css';

import Link from 'next/link';

import { Toaster } from '@/components/ui/toaster';

export const metadata = {
  title: 'JustOFT',
  description: 'Oftalmologia - HGF',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-br">
      <body>
        {children}
        <footer className="flex">
          <span className="bg-primary text-primary-foreground w-full text-center text-xs py-1">
            Coded with ❤️ by{' '}
            <Link href={'https://github.com/leonunesbs'} className="link no-underline  font-bold" target="_blank">
              @leonunesbs
            </Link>
          </span>
        </footer>
        <Toaster />
      </body>
    </html>
  );
}
