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
  CodSolicitacaoLeito?: number | string | null;
  NomUsuario?: string | null;
  Procedimento?: string | null;
  HipDiagnostica?: string | null;
  HipoteseDiagnostica?: string | null;
  DscObservacao?: string | null;
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
    const obj = json as { Resultado?: unknown; Data?: unknown };
    const resultado = obj.Resultado ?? obj.Data;
    if (Array.isArray(resultado)) return resultado as Solicitacao[];
  }
  return [];
}

/** Mapeia um registro já identificado (folha de rosto ou linha do grid). */
export function mapearRegistro(item: Solicitacao): FastmedicLookupResult | null {
  const justification = [item.HipDiagnostica, item.HipoteseDiagnostica, item.DscObservacao]
    .find((value) => value?.trim())
    ?.trim();
  const patientName = limparNome(item.NomUsuario);
  const surgery = limparProcedimento(item.Procedimento);
  if (!patientName && !surgery && !justification) return null;
  return {
    patientName,
    surgery,
    // A folha de rosto preserva o texto original em `HipDiagnostica`. O grid
    // usa `HipoteseDiagnostica` e pode remover pontuação, por isso é fallback.
    justification: justification ?? '',
    type: deduzirTipo(item),
  };
}

/**
 * Encontra a solicitação pelo número (`CodSolicitacao`) e mapeia para os campos
 * do formulário. Retorna `null` se o número não estiver na resposta.
 */
export function mapearSolicitacao(json: unknown, cod: string | number): FastmedicLookupResult | null {
  const alvo = String(cod).trim();
  const itens = extrairItens(json);
  // O filtro enviado se chama `CodSolicitacaoLeito`, mas a linha do grid pode
  // devolver apenas o id interno `CodSolicitacao`. Se veio exatamente uma
  // linha, ela já foi filtrada pelo servidor e não deve ser descartada.
  const item =
    itens.find(
      (it) => String(it.CodSolicitacaoLeito ?? '').trim() === alvo || String(it.CodSolicitacao ?? '').trim() === alvo,
    ) ?? (itens.length === 1 ? itens[0] : undefined);
  if (!item) return null;
  return mapearRegistro(item);
}
