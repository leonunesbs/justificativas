import { PricingTable, Show, SignInButton } from '@clerk/nextjs';
import { CircleCheck } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FREE_ACCESS_LABEL, isFreeAccessActive } from '@/lib/billing';

export const metadata = {
  title: 'Assinatura · JustOFT',
};

export default function AssinaturaPage() {
  const free = isFreeAccessActive();

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center gap-8 px-4 py-10">
      <header className="space-y-2 text-center">
        <h1 className="text-3xl font-extrabold tracking-tight">Assinatura</h1>
        <p className="text-muted-foreground mx-auto max-w-prose text-sm text-pretty">
          {free
            ? 'A busca no FastMedic está liberada para todos. As demais funções do JustOFT continuam gratuitas.'
            : 'Assine para liberar a busca automática de dados no FastMedic. As demais funções do JustOFT continuam gratuitas.'}
        </p>
      </header>

      {free ? (
        <Card className="w-full max-w-md">
          <CardHeader className="items-center justify-items-center gap-3 text-center">
            <div className="bg-muted text-foreground flex size-14 items-center justify-center rounded-full">
              <CircleCheck className="size-7" />
            </div>
            <CardTitle className="text-xl">Tudo liberado por enquanto</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4 text-center">
            <p className="text-muted-foreground text-sm text-pretty">
              A busca no FastMedic está gratuita para todos até <strong className="text-foreground">{FREE_ACCESS_LABEL}</strong>. Não é
              preciso assinar agora — é só usar.
            </p>
            <p className="text-muted-foreground text-xs text-pretty">
              A manutenção e o recurso de busca têm custos; depois dessa data os planos voltam a valer.
            </p>
            <Button asChild className="mt-2">
              <Link href="/">Voltar para o app</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="w-full">
          <Show when="signed-in">
            <PricingTable />
          </Show>
          <Show when="signed-out">
            <div className="flex flex-col items-center gap-4 text-center">
              <p className="text-muted-foreground text-sm">Entre na sua conta para ver os planos disponíveis.</p>
              <SignInButton mode="modal">
                <Button>Entrar</Button>
              </SignInButton>
            </div>
          </Show>
        </div>
      )}
    </main>
  );
}
