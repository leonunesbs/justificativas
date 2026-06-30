/**
 * Slug do plano do Clerk Billing exigido para liberar a busca no FastMedic.
 *
 * Crie um plano com este slug no Clerk Dashboard (Billing → Plans). Para usar
 * outro slug, defina `NEXT_PUBLIC_CLERK_PLAN_SLUG`. É público de propósito
 * (slug não é segredo) para que o mesmo valor sirva no servidor e no cliente.
 */
export const CLERK_PLAN_SLUG = process.env.NEXT_PUBLIC_CLERK_PLAN_SLUG ?? 'pro';

/**
 * Período promocional de acesso liberado.
 *
 * Enquanto ativo, os recursos por assinatura ficam liberados para todos os
 * usuários — sem exigir plano ativo nem login. Vai até o último dia útil de
 * fevereiro de 2027 (sexta, 26/02/2027), inclusive, no horário de Fortaleza
 * (UTC-3). Depois dessa data o gate de assinatura volta a valer.
 */
export const FREE_ACCESS_UNTIL = new Date('2027-02-26T23:59:59.999-03:00');

/** Data do fim do acesso gratuito, para exibir nas mensagens da interface. */
export const FREE_ACCESS_LABEL = '26/02/2027';

/** `true` enquanto o acesso promocional estiver vigente. */
export function isFreeAccessActive(now: Date = new Date()): boolean {
  return now.getTime() <= FREE_ACCESS_UNTIL.getTime();
}
