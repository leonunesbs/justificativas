import './globals.css';
import { ClerkProvider, Show, SignInButton, SignUpButton, UserButton } from '@clerk/nextjs';
import type { Metadata } from 'next';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Toaster } from '@/components/ui/sonner';

export const metadata: Metadata = {
  title: 'JustOFT',
  description: 'Oftalmologia - HGF',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-br">
      <body>
        <ClerkProvider>
          <div className="flex min-h-svh flex-col">
            <header className="flex items-center justify-end gap-2 px-4 py-2 sm:px-6">
              <Show when="signed-out">
                <SignInButton mode="modal">
                  <Button size="sm" variant="ghost">
                    Entrar
                  </Button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <Button size="sm">Criar conta</Button>
                </SignUpButton>
              </Show>
              <Show when="signed-in">
                <Button asChild size="sm" variant="ghost">
                  <Link href="/assinatura">Assinatura</Link>
                </Button>
                <UserButton />
              </Show>
            </header>
            <div className="flex flex-1 flex-col">{children}</div>
            <footer className="bg-primary text-primary-foreground py-1.5 text-center text-xs">
              Coded with ❤️ by{' '}
              <Link href="https://github.com/leonunesbs" className="font-bold no-underline" target="_blank">
                @leonunesbs
              </Link>
            </footer>
          </div>
          <Toaster />
        </ClerkProvider>
      </body>
    </html>
  );
}
