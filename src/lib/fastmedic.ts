/**
 * Helpers puros para extrair os dados de uma solicitação do FastMedic
 * (resposta do endpoint `BuscaGridSolicitacao`) e mapeá-los para os campos do
 * formulário de justificativa.
 *
 * Mantido sem dependências de Node/React de propósito: assim a lógica de
 * parsing/mapeamento pode ser testada isoladamente (e reusada no client e no
 * route handler).
 */

export type JustificationType = 'Urgente' | 'Eletivo';

export type FastmedicLookupResult = {
  patientName: string;
  surgery: string;
  justification: string;
  type: JustificationType;
};

type Solicitacao = {
  CodSolicitacao?: number | string | null;
  NomUsuario?: string | null;
  Procedimento?: string | null;
  HipoteseDiagnostica?: string | null;
  DscTipoSolicitacao?: string | null;
  DscPrioridade?: string | null;
};

/**
 * `NomUsuario` vem com telefone(s) anexado(s) após dois espaços e um hífen.
 * Ex.: `"SAMUEL MAIA LIMA  - 88999118526 / 88996999316"` → `"SAMUEL MAIA LIMA"`.
 */
export function limparNome(nome: string | null | undefined): string {
  return ((nome ?? '').split('  - ')[0] ?? '').trim();
}

/**
 * `Procedimento` começa com o código SIGTAP (10 dígitos) seguido da descrição.
 * Ex.: `"0405020015 CORRECAO CIRURGICA DE ESTRABISMO (...)"` →
 * `"CORRECAO CIRURGICA DE ESTRABISMO (...)"`.
 */
export function limparProcedimento(proc: string | null | undefined): string {
  return (proc ?? '').replace(/^\s*\d{6,}\s+/, '').trim();
}

/**
 * Deduz Urgente/Eletivo a partir de `DscTipoSolicitacao` ("Eletiva") ou
 * `DscPrioridade` ("ELETIVA"). Qualquer coisa que não seja eletiva vira Urgente.
 */
export function deduzirTipo(item: Pick<Solicitacao, 'DscTipoSolicitacao' | 'DscPrioridade'>): JustificationType {
  const blob = `${item.DscTipoSolicitacao ?? ''} ${item.DscPrioridade ?? ''}`.toLowerCase();
  return blob.includes('eletiv') ? 'Eletivo' : 'Urgente';
}

/**
 * Normaliza a resposta do FastMedic: aceita tanto o array cru `[...]` quanto o
 * envelope `{ Sucesso, Resultado: [...] }` (as duas formas já foram observadas).
 */
export function extrairItens(json: unknown): Solicitacao[] {
  if (Array.isArray(json)) return json as Solicitacao[];
  if (json && typeof json === 'object') {
    const resultado = (json as { Resultado?: unknown }).Resultado;
    if (Array.isArray(resultado)) return resultado as Solicitacao[];
  }
  return [];
}

/**
 * Encontra a solicitação pelo número (`CodSolicitacao`) e mapeia para os campos
 * do formulário. Retorna `null` se o número não estiver na resposta.
 */
export function mapearSolicitacao(json: unknown, cod: string | number): FastmedicLookupResult | null {
  const alvo = String(cod).trim();
  const item = extrairItens(json).find((it) => String(it.CodSolicitacao ?? '').trim() === alvo);
  if (!item) return null;
  return {
    patientName: limparNome(item.NomUsuario),
    surgery: limparProcedimento(item.Procedimento),
    justification: (item.HipoteseDiagnostica ?? '').trim(),
    type: deduzirTipo(item),
  };
}
