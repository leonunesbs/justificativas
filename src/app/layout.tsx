import '@/styles/globals.css';

export const metadata = {
  title: 'JustOFT',
  description: 'Oftalmologia - HGF',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-br">
      <body>{children}</body>
    </html>
  );
}
