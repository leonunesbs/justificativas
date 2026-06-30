'use client';

import { Sparkles, X } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useLocalStorage } from '@/hooks/use-local-storage';

/**
 * Banner de novidades versionado, 100% client-side (sem servidor).
 *
 * Como funciona: ao dispensar, guardamos `BANNER.version` no `localStorage`.
 * O banner só aparece quando a versão guardada difere da atual — então, para
 * "lançar um banner novo" e fazê-lo reaparecer para todos, basta **subir o
 * `version`** (e atualizar o conteúdo) neste arquivo.
 */
const BANNER = {
  version: '2026-06-30',
  title: 'Novidades nesta atualização',
  highlights: [
    'Busca no FastMedic: digite o número e preencha nome, cirurgia e justificativa automaticamente.',
    'Status do login ao vivo + atalhos de foco nos campos (Ctrl+Shift+F/P/G/U).',
    'Manutenção e busca no FastMedic têm custos — gratuito para todos até 26/02/2027.',
    'Busca em série: cole vários números do FASTMEDIC e confirme para buscar em sequência.',
  ],
};

export function NewsBanner() {
  const [dismissedVersion, setDismissedVersion, hydrated] = useLocalStorage<string>('dismissedBannerVersion', '');

  // Não renderiza antes de hidratar (evita flash) nem se esta versão já foi dispensada.
  if (!hydrated || dismissedVersion === BANNER.version) return null;

  return (
    <div className="bg-card relative mb-6 overflow-hidden rounded-xl border shadow-sm">
      <div className="bg-primary absolute inset-y-0 left-0 w-1" aria-hidden />
      <div className="flex items-start gap-3 p-4 pl-5">
        <div className="bg-primary/10 text-primary mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full">
          <Sparkles className="size-4" />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold">{BANNER.title}</p>
            <Badge variant="secondary" className="font-normal">
              {BANNER.version}
            </Badge>
          </div>
          <ul className="text-muted-foreground list-disc space-y-1 pl-4 text-sm break-words">
            {BANNER.highlights.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="-mt-1 -mr-1 shrink-0"
          onClick={() => setDismissedVersion(BANNER.version)}
          aria-label="Dispensar novidades"
          title="Dispensar"
        >
          <X />
        </Button>
      </div>
    </div>
  );
}
