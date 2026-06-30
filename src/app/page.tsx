'use client';

import { SignInButton, useAuth } from '@clerk/nextjs';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Check,
  ChevronDown,
  CircleAlert,
  Copy,
  Download,
  FileText,
  Keyboard,
  KeyRound,
  ListPlus,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Printer,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import type { SubmitHandler, UseFormReturn } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { NewsBanner } from '@/components/news-banner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { useHotkeys } from '@/hooks/use-hotkeys';
import { useLocalStorage } from '@/hooks/use-local-storage';
import { CLERK_PLAN_SLUG, FREE_ACCESS_LABEL, isFreeAccessActive } from '@/lib/billing';
import { createPdfFromData, createPdfUrl, fillPdfTemplateWithDataForPage } from '@/lib/utils';

const formSchema = z.object({
  patientName: z
    .string()
    .min(1, 'Nome do paciente é obrigatório.')
    .transform((value) => value.toUpperCase()),
  medicalRecord: z.string().min(1, 'Número do FASTMEDIC é obrigatório.'),
  type: z.enum(['Urgente', 'Eletivo'], {
    error: "Por favor, selecione 'Urgente' ou 'Eletivo'.",
  }),
  surgery: z
    .string()
    .min(1, 'Cirurgia proposta é obrigatória.')
    .transform((value) => value.toUpperCase()),
  justification: z
    .string()
    .min(1, 'Justificativa é obrigatória.')
    .transform((value) => value.toUpperCase()),
});

const doctorFormSchema = z.object({
  doctorName: z.string().transform((value) => value.toUpperCase()),
  crm: z.string(),
});

const justificationDataSchema = z.object({
  id: z.string(),
  patientName: z.string(),
  medicalRecord: z.string(),
  type: z.enum(['Urgente', 'Eletivo']),
  surgery: z.string(),
  justification: z.string(),
});

const fastmedicCredsSchema = z.object({
  cpf: z.string(),
  senha: z.string(),
});

type JustificationData = z.infer<typeof justificationDataSchema>;
type JustificationFormValues = z.input<typeof formSchema>;
type DoctorInfo = { doctorName: string; crm: string };
type FastmedicCreds = z.infer<typeof fastmedicCredsSchema>;

type LookupResult = { patientName?: string; surgery?: string; justification?: string; type?: string };
type BatchItem = { cod: string; status: 'pending' | 'running' | 'ok' | 'fail' | 'dup'; message?: string };

/** Extrai os números (grupos de dígitos) de um texto colado, sem duplicados. */
function parseCods(input: string): string[] {
  return Array.from(new Set((input.match(/\d+/g) ?? []).filter(Boolean)));
}

type JustificationListProps = {
  dataList: JustificationData[];
  handleEdit: (id: string) => void;
  handleDelete: (id: string) => void;
  handlePrintSingle: (data: JustificationData) => void;
  handleDuplicate: (item: JustificationData) => void;
  handleClearAllJustifications: () => void;
};

function JustificationList({
  dataList,
  handleEdit,
  handleDelete,
  handlePrintSingle,
  handleDuplicate,
  handleClearAllJustifications,
}: JustificationListProps) {
  if (dataList.length === 0) {
    return (
      <Card className="border-dashed shadow-none">
        <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <FileText className="text-muted-foreground size-8" />
          <div className="space-y-1">
            <p className="font-medium">Nenhuma justificativa ainda</p>
            <p className="text-muted-foreground text-sm">
              Preencha o formulário ao lado e clique em <span className="text-foreground font-medium">Adicionar</span>.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-muted-foreground text-sm font-medium">
          {dataList.length} {dataList.length === 1 ? 'justificativa' : 'justificativas'}
        </h2>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
              <Trash2 />
              Limpar todas
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar exclusão de todas as justificativas</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza de que deseja excluir todas as justificativas salvas? Essa ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleClearAllJustifications}>Confirmar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {dataList.map((item: JustificationData) => (
        <Card key={item.id}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{item.patientName}</CardTitle>
              <Badge variant={item.type === 'Urgente' ? 'destructive' : 'outline'}>{item.type}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm break-words">
            <p>
              <strong>FASTMEDIC:</strong> {item.medicalRecord}
            </p>
            <p>
              <strong>Cirurgia:</strong> {item.surgery}
            </p>
            <p>
              <strong>Justificativa:</strong> {item.justification}
            </p>
          </CardContent>
          <CardFooter className="flex flex-wrap justify-end gap-2">
            <Button size="sm" onClick={() => handlePrintSingle(item)}>
              <Printer />
              Imprimir
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleEdit(item.id)}>
              <Pencil />
              Editar
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleDuplicate(item)}>
              <Copy />
              Duplicar
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="destructive">
                  <Trash2 />
                  Excluir
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                  <AlertDialogDescription>Tem certeza de que deseja excluir esta justificativa?</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => handleDelete(item.id)}>Confirmar</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}

type ActionButtonsProps = {
  loading: boolean;
  progress: number;
  pdfUrl: string | null;
  handlePrintAll: () => void;
};

function ActionButtons({ loading, progress, pdfUrl, handlePrintAll }: ActionButtonsProps) {
  return (
    <div className="flex flex-col items-center gap-4">
      <Button size="lg" onClick={handlePrintAll} disabled={loading}>
        <Printer />
        {loading ? 'Gerando PDF...' : 'Imprimir Tudo'}
      </Button>
      {progress > 0 && (
        <div className="w-full">
          <Progress value={progress} />
        </div>
      )}
      {progress === 100 && pdfUrl && (
        <Button asChild variant="outline">
          <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
            <Download />
            Baixar PDF
          </a>
        </Button>
      )}
    </div>
  );
}

type JustificationFormProps = {
  form: UseFormReturn<JustificationFormValues>;
  onSubmit: SubmitHandler<JustificationFormValues>;
  handleExport: () => void;
  handleImport: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleClearJustificationForm: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onLookup: () => void;
  onOpenBatch: () => void;
  lookupLoading: boolean;
  lookupSteps: string[];
};

const TEXT_FIELDS = ['patientName', 'surgery'] as const;

function JustificationForm({
  form,
  onSubmit,
  handleExport,
  handleImport,
  handleClearJustificationForm,
  fileInputRef,
  onLookup,
  onOpenBatch,
  lookupLoading,
  lookupSteps,
}: JustificationFormProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-1.5">
            <CardTitle>Justificativas de Cirurgias</CardTitle>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Importar ou exportar dados" title="Importar / Exportar">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Dados (JSON)</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                <Upload />
                Importar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExport}>
                <Download />
                Exportar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <Input type="file" ref={fileInputRef} accept=".json" onChange={handleImport} className="hidden" multiple />
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6">
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo</FormLabel>
                  <FormControl>
                    <RadioGroup value={field.value} onValueChange={field.onChange} className="flex space-x-4">
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="Eletivo" id="eletivo" />
                        <Label htmlFor="eletivo">Eletivo</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="Urgente" id="urgente" />
                        <Label htmlFor="urgente">Urgente</Label>
                      </div>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="medicalRecord"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Número do FASTMEDIC</FormLabel>
                  <div className="flex gap-2">
                    <FormControl>
                      <Input
                        placeholder="Digite o número do FASTMEDIC"
                        inputMode="numeric"
                        {...field}
                        onKeyDown={(event) => {
                          // Só Enter puro busca; Shift/Ctrl/Alt/Meta+Enter (e IME) não disparam.
                          if (
                            event.key === 'Enter' &&
                            !event.shiftKey &&
                            !event.ctrlKey &&
                            !event.altKey &&
                            !event.metaKey &&
                            !event.nativeEvent.isComposing
                          ) {
                            event.preventDefault();
                            onLookup();
                          }
                        }}
                      />
                    </FormControl>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={onLookup}
                      disabled={lookupLoading}
                      title="Buscar nome, cirurgia e justificativa no FastMedic"
                    >
                      {lookupLoading ? <Loader2 className="animate-spin" /> : <Search />}
                      {lookupLoading ? 'Buscando…' : 'Buscar'}
                    </Button>
                  </div>
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    onClick={onOpenBatch}
                    disabled={lookupLoading}
                    className="text-muted-foreground h-auto justify-start px-0"
                  >
                    <ListPlus />
                    Buscar vários em série
                  </Button>
                  {lookupLoading && lookupSteps.length > 0 && (
                    <div className="bg-muted/40 text-muted-foreground mt-2 space-y-1.5 rounded-md border p-3 text-sm">
                      {lookupSteps.map((step, index) => {
                        const current = index === lookupSteps.length - 1;
                        return (
                          <div key={index} className="flex items-center gap-2">
                            {current ? (
                              <Loader2 className="size-3.5 shrink-0 animate-spin" />
                            ) : (
                              <Check className="text-foreground size-3.5 shrink-0" />
                            )}
                            <span className="break-words">{step}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
            {TEXT_FIELDS.map((fieldName) => (
              <FormField
                key={fieldName}
                control={form.control}
                name={fieldName}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{fieldName === 'patientName' ? 'Nome do Paciente' : 'Proposta de Cirurgia'}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={`Digite ${
                          fieldName === 'patientName' ? 'o nome do paciente' : 'a proposta de cirurgia'
                        }`}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ))}
            <FormField
              control={form.control}
              name="justification"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Justificativa</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Digite a justificativa" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button type="button" variant="outline" onClick={handleClearJustificationForm}>
              Limpar
            </Button>
            <Button type="submit">
              <Plus />
              Adicionar
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}

type EditJustificationDialogProps = {
  item: JustificationData | null;
  onOpenChange: (open: boolean) => void;
  onSave: SubmitHandler<JustificationFormValues>;
};

function EditJustificationDialog({ item, onOpenChange, onSave }: EditJustificationDialogProps) {
  const form = useForm<JustificationFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { patientName: '', medicalRecord: '', type: 'Eletivo', surgery: '', justification: '' },
  });

  // Recarrega o formulário sempre que abre para editar outro item.
  useEffect(() => {
    if (item) form.reset(item);
  }, [item, form]);

  return (
    <Dialog open={item !== null} onOpenChange={(value) => !value && onOpenChange(false)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar justificativa</DialogTitle>
          <DialogDescription>Altere os dados e salve para atualizar a justificativa.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSave)} className="space-y-4">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo</FormLabel>
                  <FormControl>
                    <RadioGroup value={field.value} onValueChange={field.onChange} className="flex space-x-4">
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="Eletivo" id="edit-eletivo" />
                        <Label htmlFor="edit-eletivo">Eletivo</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="Urgente" id="edit-urgente" />
                        <Label htmlFor="edit-urgente">Urgente</Label>
                      </div>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="medicalRecord"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Número do FASTMEDIC</FormLabel>
                  <FormControl>
                    <Input placeholder="Digite o número do FASTMEDIC" inputMode="numeric" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {TEXT_FIELDS.map((fieldName) => (
              <FormField
                key={fieldName}
                control={form.control}
                name={fieldName}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{fieldName === 'patientName' ? 'Nome do Paciente' : 'Proposta de Cirurgia'}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={`Digite ${fieldName === 'patientName' ? 'o nome do paciente' : 'a proposta de cirurgia'}`}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ))}
            <FormField
              control={form.control}
              name="justification"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Justificativa</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Digite a justificativa" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit">
                <Check />
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

type BatchLookupDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  running: boolean;
  items: BatchItem[];
  onConfirm: (cods: string[]) => void;
};

function BatchLookupDialog({ open, onOpenChange, running, items, onConfirm }: BatchLookupDialogProps) {
  const [input, setInput] = useState('');
  const cods = parseCods(input);
  const done = items.filter((item) => item.status !== 'pending' && item.status !== 'running').length;
  const started = items.length > 0;
  const okCount = items.filter((item) => item.status === 'ok').length;
  const dupCount = items.filter((item) => item.status === 'dup').length;
  const failCount = items.filter((item) => item.status === 'fail').length;
  const plural = (n: number) => (n === 1 ? '' : 's');

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (running) return; // não fecha no meio da busca
        onOpenChange(value);
      }}
    >
      <DialogContent className="sm:max-w-md" showCloseButton={!running}>
        <DialogHeader>
          <DialogTitle>Buscar FASTMEDIC em série</DialogTitle>
          <DialogDescription>
            Cole os números (um por linha ou separados por espaço/vírgula). Cada um é buscado em sequência e adicionado
            às justificativas.
          </DialogDescription>
        </DialogHeader>

        {!started ? (
          <div className="space-y-2">
            <Textarea
              autoFocus
              rows={7}
              inputMode="numeric"
              placeholder={'3941799\n3940217\n3941971'}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              className="font-mono text-sm"
            />
            <p className="text-muted-foreground text-sm">
              {cods.length > 0
                ? `${cods.length} ${cods.length === 1 ? 'número detectado' : 'números detectados'}.`
                : 'Nenhum número detectado ainda.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{running ? 'Buscando…' : 'Concluído'}</span>
                <span className="text-muted-foreground text-xs tabular-nums">
                  {done}/{items.length}
                </span>
              </div>
              <Progress value={items.length > 0 ? (done / items.length) * 100 : 0} />
            </div>

            {!running && (
              <div className="flex flex-wrap gap-1.5">
                {okCount > 0 && (
                  <Badge variant="secondary" className="gap-1">
                    <Check className="size-3" />
                    {okCount} adicionada{plural(okCount)}
                  </Badge>
                )}
                {dupCount > 0 && (
                  <Badge variant="outline" className="gap-1">
                    <Copy className="size-3" />
                    {dupCount} duplicada{plural(dupCount)}
                  </Badge>
                )}
                {failCount > 0 && (
                  <Badge variant="destructive" className="gap-1">
                    <CircleAlert className="size-3" />
                    {failCount} falha{plural(failCount)}
                  </Badge>
                )}
              </div>
            )}

            <div className="max-h-64 divide-y overflow-y-auto rounded-md border text-sm">
              {items.map((item) => (
                <div key={item.cod} className="flex items-center gap-2 px-3 py-2">
                  {item.status === 'ok' ? (
                    <Check className="size-4 shrink-0 text-emerald-600" />
                  ) : item.status === 'fail' ? (
                    <CircleAlert className="text-destructive size-4 shrink-0" />
                  ) : item.status === 'dup' ? (
                    <Copy className="text-muted-foreground size-4 shrink-0" />
                  ) : item.status === 'running' ? (
                    <Loader2 className="size-4 shrink-0 animate-spin" />
                  ) : (
                    <span className="bg-muted size-4 shrink-0 rounded-full" />
                  )}
                  <span className="font-mono text-xs tabular-nums shrink-0">{item.cod}</span>
                  {item.message && (
                    <span className="text-muted-foreground min-w-0 flex-1 truncate text-xs">{item.message}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          {!started ? (
            <>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="button" onClick={() => onConfirm(cods)} disabled={cods.length === 0}>
                <Search />
                Buscar {cods.length > 0 ? `${cods.length} ` : ''}em série
              </Button>
            </>
          ) : (
            <Button type="button" onClick={() => onOpenChange(false)} disabled={running}>
              {running ? (
                <>
                  <Loader2 className="animate-spin" />
                  Buscando…
                </>
              ) : (
                'Fechar'
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type FastmedicAccessProps = {
  creds: FastmedicCreds;
  setCreds: (value: FastmedicCreds | ((prev: FastmedicCreds) => FastmedicCreds)) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function FastmedicAccess({ creds, setCreds, open, onOpenChange }: FastmedicAccessProps) {
  const { isLoaded, isSignedIn, has } = useAuth();
  // Durante o período promocional, libera para todos (sem login nem assinatura).
  const subscribed = isFreeAccessActive() || (isLoaded && isSignedIn && Boolean(has?.({ plan: CLERK_PLAN_SLUG })));

  return (
    <Card>
      <Collapsible open={open} onOpenChange={onOpenChange} className="flex flex-col gap-6">
        <CardHeader>
          <CollapsibleTrigger className="group flex w-full cursor-pointer items-center justify-between gap-2 text-left">
            <CardTitle className="flex items-center gap-2 text-base">
              <KeyRound className="size-4" />
              Acesso FastMedic
            </CardTitle>
            <ChevronDown className="text-muted-foreground size-4 transition-transform group-data-[state=open]:rotate-180" />
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent className="flex flex-col gap-6">
          {subscribed ? (
            <>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground text-sm">
                  Usado apenas para autenticar e buscar os dados pelo número. Fica salvo somente neste navegador.
                </p>
                <div className="bg-muted/40 text-muted-foreground flex items-start gap-2 rounded-md border p-3 text-xs">
                  <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
                  <span>
                    A manutenção e o recurso de busca no FastMedic têm custos. Por enquanto, gratuito para todos até{' '}
                    {FREE_ACCESS_LABEL}.
                  </span>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fastmedic-cpf">CPF</Label>
                  <Input
                    id="fastmedic-cpf"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="Somente números"
                    value={creds.cpf}
                    onChange={(event) => setCreds((prev) => ({ ...prev, cpf: event.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fastmedic-senha">Senha</Label>
                  <Input
                    id="fastmedic-senha"
                    type="password"
                    autoComplete="off"
                    placeholder="Senha do FastMedic"
                    value={creds.senha}
                    onChange={(event) => setCreds((prev) => ({ ...prev, senha: event.target.value }))}
                  />
                </div>
              </CardContent>
              <CardFooter className="justify-end">
                <Button variant="outline" size="sm" onClick={() => setCreds({ cpf: '', senha: '' })}>
                  Limpar credenciais
                </Button>
              </CardFooter>
            </>
          ) : (
            <CardContent className="space-y-3">
              {!isLoaded ? (
                <p className="text-muted-foreground text-sm">Carregando…</p>
              ) : !isSignedIn ? (
                <>
                  <p className="text-muted-foreground text-sm">
                    A busca no FastMedic é exclusiva para assinantes. Entre na sua conta para continuar.
                  </p>
                  <SignInButton mode="modal">
                    <Button className="w-full">Entrar</Button>
                  </SignInButton>
                </>
              ) : (
                <>
                  <p className="text-muted-foreground text-sm">
                    Sua conta ainda não tem uma assinatura ativa. Ative um plano para liberar a busca automática no
                    FastMedic.
                  </p>
                  <Button asChild className="w-full">
                    <Link href="/assinatura">Ver planos</Link>
                  </Button>
                </>
              )}
            </CardContent>
          )}
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

type DoctorFormProps = {
  formDoctor: UseFormReturn<DoctorInfo>;
  onSubmitDoctorInfo: SubmitHandler<DoctorInfo>;
  handleClearDoctorForm: () => void;
};

function DoctorForm({ formDoctor, onSubmitDoctorInfo, handleClearDoctorForm }: DoctorFormProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Informações do Médico (Opcional)</CardTitle>
      </CardHeader>
      <Form {...formDoctor}>
        <form onSubmit={formDoctor.handleSubmit(onSubmitDoctorInfo)} className="flex flex-col gap-6">
          <CardContent className="space-y-4">
            <FormField
              control={formDoctor.control}
              name="doctorName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome do Médico</FormLabel>
                  <FormControl>
                    <Input placeholder="Digite o nome do médico" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={formDoctor.control}
              name="crm"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>CRM</FormLabel>
                  <FormControl>
                    <Input placeholder="Digite o CRM" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
          <CardFooter className="flex items-center justify-between">
            <Button type="button" variant="outline" onClick={handleClearDoctorForm}>
              Limpar
            </Button>
            <Button type="submit">Salvar</Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}

function PreviewValue({ value, placeholder }: { value?: string; placeholder: string }) {
  const text = value?.trim();
  if (text) {
    return <span className="text-foreground font-semibold">{text.toUpperCase()}</span>;
  }
  return <span className="text-muted-foreground italic">{placeholder}</span>;
}

function JustificationPreview({
  form,
  doctorInfo,
}: {
  form: UseFormReturn<JustificationFormValues>;
  doctorInfo: DoctorInfo;
}) {
  // Live mirror of the PDF text, updated as the user types.
  const values = useWatch({ control: form.control });
  const today = new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <Card>
      <Collapsible defaultOpen>
        <CardHeader>
          <CollapsibleTrigger className="group flex w-full cursor-pointer items-center justify-between gap-2 text-left">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="size-4" />
              Pré-visualização do documento
            </CardTitle>
            <ChevronDown className="text-muted-foreground size-4 transition-transform group-data-[state=open]:rotate-180" />
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent>
            <div className="bg-card text-card-foreground rounded-md border p-6 font-serif text-sm leading-relaxed break-words shadow-xs">
              <p className="mb-4 text-justify">
                Solicito a realização de procedimento em caráter <PreviewValue value={values.type} placeholder="tipo" />{' '}
                que beneficiaria o paciente <PreviewValue value={values.patientName} placeholder="nome do paciente" />{' '}
                (FASTMEDIC <PreviewValue value={values.medicalRecord} placeholder="número" />
                ), acompanhado no Setor de Oftalmologia deste hospital.
              </p>
              <p className="mb-8 text-justify">
                O paciente tem indicação de <PreviewValue value={values.surgery} placeholder="proposta de cirurgia" />,
                justificada por <PreviewValue value={values.justification} placeholder="justificativa" />. A realização
                do procedimento com brevidade é fundamental para prevenir complicações.
              </p>
              <div className="flex flex-col items-center gap-0.5 text-center">
                <span className="text-muted-foreground">___________________________</span>
                {doctorInfo.doctorName ? (
                  <span className="font-semibold">{doctorInfo.doctorName.toUpperCase()}</span>
                ) : null}
                {doctorInfo.crm ? <span>CRM: {doctorInfo.crm.toUpperCase()}</span> : null}
                <span className="mt-1">{today}</span>
                <span>Serviço de Oftalmologia - HGF</span>
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

const HOTKEYS: { keys: string; description: string }[] = [
  { keys: 'Ctrl + Enter', description: 'Adicionar / Atualizar justificativa' },
  { keys: 'Ctrl + B', description: 'Buscar dados no FastMedic' },
  { keys: 'Ctrl + Shift + F', description: 'Focar Número do FASTMEDIC' },
  { keys: 'Ctrl + Shift + P', description: 'Focar Nome do Paciente' },
  { keys: 'Ctrl + Shift + G', description: 'Focar Proposta de Cirurgia' },
  { keys: 'Ctrl + Shift + U', description: 'Focar Justificativa' },
  { keys: 'Ctrl + O', description: 'Importar JSON' },
  { keys: 'Ctrl + S', description: 'Exportar JSON' },
  { keys: 'Ctrl + P', description: 'Imprimir Tudo (PDF)' },
  { keys: 'Esc', description: 'Cancelar edição / fechar' },
  { keys: '?', description: 'Mostrar atalhos' },
];

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="bg-muted text-muted-foreground inline-flex h-6 min-w-6 items-center justify-center rounded border px-1.5 font-mono text-xs font-medium">
      {children}
    </kbd>
  );
}

function HotkeysHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="presentation"
    >
      <Card className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            Atalhos de teclado
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {HOTKEYS.map((hotkey) => (
            <div key={hotkey.keys} className="flex items-center justify-between gap-4 text-sm">
              <span className="text-muted-foreground">{hotkey.description}</span>
              <span className="flex gap-1">
                {hotkey.keys.split(' + ').map((key) => (
                  <Kbd key={key}>{key}</Kbd>
                ))}
              </span>
            </div>
          ))}
        </CardContent>
        <CardFooter className="justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>
            Fechar
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

type PdfJob = { loading: boolean; progress: number; url: string | null };

export default function Home() {
  // Persisted domain state — hydration + persistence handled by the hook, validated on load.
  const [dataList, setDataList] = useLocalStorage<JustificationData[]>('dataList', [], (raw) => {
    const result = z.array(justificationDataSchema).safeParse(JSON.parse(raw));
    return result.success ? result.data : [];
  });
  const [doctorInfo, setDoctorInfo] = useLocalStorage<DoctorInfo>('doctorInfo', { doctorName: '', crm: '' });
  const [fastmedicCreds, setFastmedicCreds] = useLocalStorage<FastmedicCreds>(
    'fastmedicCreds',
    { cpf: '', senha: '' },
    (raw) => {
      const result = fastmedicCredsSchema.safeParse(JSON.parse(raw));
      return result.success ? result.data : { cpf: '', senha: '' };
    },
  );

  // Transient UI state.
  const [editItem, setEditItem] = useState<JustificationData | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [pdf, setPdf] = useState<PdfJob>({ loading: false, progress: 0, url: null });
  const [credsOpen, setCredsOpen] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupSteps, setLookupSteps] = useState<string[]>([]);
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchKey, setBatchKey] = useState(0);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchItems, setBatchItems] = useState<BatchItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<z.input<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      patientName: '',
      medicalRecord: '',
      type: 'Eletivo',
      surgery: '',
      justification: '',
    },
  });

  const formDoctor = useForm<DoctorInfo>({
    resolver: zodResolver(doctorFormSchema),
    defaultValues: { doctorName: doctorInfo.doctorName, crm: doctorInfo.crm },
  });

  // Mirror the persisted doctor info into its form (covers async hydration).
  useEffect(() => {
    formDoctor.reset(doctorInfo);
  }, [doctorInfo, formDoctor]);

  // Foca o número do FASTMEDIC ao abrir, para começar a digitar sem o mouse.
  useEffect(() => {
    form.setFocus('medicalRecord');
  }, [form]);

  // Busca um único FASTMEDIC e devolve o resultado já parseado (ou um erro).
  // `onStep` recebe cada mensagem de log do stream NDJSON (status ao vivo).
  const fetchFastmedic = async (
    cod: string,
    onStep?: (message: string) => void,
  ): Promise<{ result?: LookupResult; error?: string }> => {
    let response: Response;
    try {
      response = await fetch('/api/fastmedic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cpf: fastmedicCreds.cpf, senha: fastmedicCreds.senha, cod }),
      });
    } catch {
      return { error: 'Erro de rede ao buscar no FastMedic.' };
    }

    // Erros anteriores ao stream (validação) voltam como JSON simples (sem corpo NDJSON).
    if (!response.ok || !response.body) {
      const data = await response.json().catch(() => null);
      return { error: data?.error ?? 'Não foi possível buscar no FastMedic.' };
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let result: LookupResult | null = null;
    let errorMessage: string | null = null;

    const handleEvent = (line: string) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      let event: { type?: string; message?: string; result?: LookupResult | null };
      try {
        event = JSON.parse(trimmed);
      } catch {
        return;
      }
      if (event.type === 'log' && event.message) onStep?.(event.message);
      else if (event.type === 'result') result = event.result ?? null;
      else if (event.type === 'error') errorMessage = event.message ?? 'Falha ao consultar o FastMedic.';
    };

    // Lê o NDJSON e reflete cada passo da autenticação no status ao vivo.
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) handleEvent(line);
    }
    handleEvent(buffer); // última linha, caso não termine em \n

    if (errorMessage) return { error: errorMessage };
    if (!result) return { error: 'Solicitação não encontrada ou resposta vazia do FastMedic.' };
    return { result };
  };

  const handleLookup = async () => {
    if (lookupLoading) return;
    const cod = form.getValues('medicalRecord').trim();
    if (!cod) {
      toast.error('Digite o número do FASTMEDIC para buscar.');
      return;
    }
    if (!fastmedicCreds.cpf.trim() || !fastmedicCreds.senha) {
      toast.error('Configure o acesso ao FastMedic (CPF e senha).');
      setCredsOpen(true);
      return;
    }
    setLookupLoading(true);
    setLookupSteps([]);
    const toastId = toast.loading('Conectando ao FastMedic…');
    const { result, error } = await fetchFastmedic(cod, (message) => {
      toast.loading(message, { id: toastId });
      setLookupSteps((prev) => [...prev, message]);
    });
    setLookupLoading(false);

    if (error || !result) {
      toast.error(error ?? 'Solicitação não encontrada ou resposta vazia do FastMedic.', { id: toastId });
      return;
    }

    form.setValue('patientName', result.patientName ?? '', { shouldValidate: true, shouldDirty: true });
    form.setValue('surgery', result.surgery ?? '', { shouldValidate: true, shouldDirty: true });
    form.setValue('justification', result.justification ?? '', { shouldValidate: true, shouldDirty: true });
    if (result.type === 'Urgente' || result.type === 'Eletivo') {
      form.setValue('type', result.type, { shouldValidate: true, shouldDirty: true });
    }
    toast.success(`Dados de ${result.patientName || 'paciente'} preenchidos.`, { id: toastId });
  };

  const openBatchDialog = () => {
    if (lookupLoading || batchRunning) return;
    if (!fastmedicCreds.cpf.trim() || !fastmedicCreds.senha) {
      toast.error('Configure o acesso ao FastMedic (CPF e senha).');
      setCredsOpen(true);
      return;
    }
    setBatchItems([]);
    setBatchKey((k) => k + 1); // remonta o diálogo p/ limpar o texto colado
    setBatchOpen(true);
  };

  // Busca vários FASTMEDIC em sequência e adiciona cada resultado às justificativas.
  const handleBatchLookup = async (cods: string[]) => {
    if (batchRunning) return;
    const unique = Array.from(new Set(cods.map((c) => c.trim()).filter(Boolean)));
    if (unique.length === 0) return;

    setBatchRunning(true);
    setBatchItems(unique.map((cod) => ({ cod, status: 'pending' })));
    const seen = new Set(dataList.map((item) => item.medicalRecord));
    let added = 0;
    let duplicated = 0;
    let failed = 0;

    const patch = (cod: string, next: Partial<BatchItem>) =>
      setBatchItems((prev) => prev.map((item) => (item.cod === cod ? { ...item, ...next } : item)));

    for (const cod of unique) {
      patch(cod, { status: 'running', message: undefined });

      if (seen.has(cod)) {
        duplicated += 1;
        patch(cod, { status: 'dup', message: 'Já está na lista.' });
        continue;
      }

      const { result, error } = await fetchFastmedic(cod, (message) => patch(cod, { message }));
      if (error || !result) {
        failed += 1;
        patch(cod, { status: 'fail', message: error ?? 'Não encontrado.' });
        continue;
      }

      seen.add(cod);
      added += 1;
      const novo: JustificationData = {
        id: `${Date.now()}-${cod}`,
        medicalRecord: cod,
        patientName: (result.patientName ?? '').toUpperCase(),
        surgery: (result.surgery ?? '').toUpperCase(),
        justification: (result.justification ?? '').toUpperCase(),
        type: result.type === 'Urgente' ? 'Urgente' : 'Eletivo',
      };
      setDataList((prev) => [...prev, novo]);
      patch(cod, { status: 'ok', message: novo.patientName || 'Adicionado.' });
    }

    setBatchRunning(false);
    setPdf((prev) => ({ ...prev, url: null, progress: 0 }));
    const partes = [`${added} adicionada(s)`];
    if (duplicated) partes.push(`${duplicated} duplicada(s)`);
    if (failed) partes.push(`${failed} falha(s)`);
    toast.success(`Busca em série concluída: ${partes.join(', ')}.`);
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(dataList, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dataList.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    const totalFiles = files.length;
    const newDataList = [...dataList];
    let filesProcessed = 0;
    let duplicatesCount = 0;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const importedData = JSON.parse(e.target?.result as string);
          if (Array.isArray(importedData)) {
            const validData = importedData.filter((item) => {
              const result = justificationDataSchema.safeParse(item);
              if (!result.success) {
                console.log(result.error);
              }
              return result.success;
            });

            validData.forEach((item) => {
              const exists = newDataList.some(
                (existingItem) =>
                  existingItem.patientName === item.patientName &&
                  existingItem.medicalRecord === item.medicalRecord &&
                  existingItem.surgery === item.surgery &&
                  existingItem.justification === item.justification &&
                  existingItem.type === item.type,
              );
              if (!exists) {
                newDataList.push(item);
              } else {
                duplicatesCount++;
              }
            });

            filesProcessed++;
            if (filesProcessed === totalFiles) {
              setDataList(newDataList);
              if (duplicatesCount > 0) {
                toast.success(`Importação concluída. ${duplicatesCount} itens duplicados foram ignorados.`);
              } else {
                toast.success('Dados importados e combinados com sucesso.');
              }
            }
          } else {
            toast.error('Formato de arquivo inválido.');
          }
        } catch (error) {
          console.error(error);
          toast.error('Erro ao importar o arquivo. Verifique o formato do arquivo.');
        }
      };
      reader.readAsText(file);
    });
  };

  const handlePrintSingle = async (data: JustificationData) => {
    // Open the tab synchronously (within the click) so Chrome's popup blocker allows it;
    // the blob URL is filled in once the PDF is ready.
    const win = window.open('', '_blank');
    try {
      const modelPDFBytes = await fetch('/modelo.pdf').then((res) => res.arrayBuffer());
      const pdfBytes = await fillPdfTemplateWithDataForPage(data, modelPDFBytes, doctorInfo);
      const url = createPdfUrl(pdfBytes);
      if (win) {
        win.location.href = url;
      } else {
        window.location.href = url;
      }
    } catch (error) {
      win?.close();
      console.error(error);
      toast.error('Erro ao gerar o PDF.');
    }
  };

  const handlePrintAll = async () => {
    if (dataList.length === 0) {
      toast.info('Adicione ao menos uma justificativa para imprimir.');
      return;
    }
    // Open the tab synchronously so it isn't popup-blocked after the await chain.
    const win = window.open('', '_blank');
    setPdf({ loading: true, progress: 40, url: null });
    try {
      const modelPDFBytes = await fetch('/modelo.pdf').then((res) => res.arrayBuffer());
      setPdf((prev) => ({ ...prev, progress: 70 }));
      const pdfDoc = await createPdfFromData(dataList, modelPDFBytes, doctorInfo);
      const pdfBytes = await pdfDoc.save();
      const url = createPdfUrl(pdfBytes);
      setPdf({ loading: false, progress: 100, url });
      if (win) {
        win.location.href = url;
      } else {
        window.location.href = url;
      }
    } catch (error) {
      win?.close();
      console.error(error);
      setPdf({ loading: false, progress: 0, url: null });
      toast.error('Erro ao gerar o PDF.');
    }
  };

  const onSubmit: SubmitHandler<JustificationFormValues> = (values) => {
    setPdf((prev) => ({ ...prev, url: null }));

    const exists = dataList.some(
      (item) =>
        item.patientName === values.patientName &&
        item.medicalRecord === values.medicalRecord &&
        item.surgery === values.surgery &&
        item.justification === values.justification &&
        item.type === values.type,
    );

    if (exists) {
      toast.error('Esta justificativa já foi adicionada.');
      return;
    }

    setDataList((prev) => [...prev, { ...values, id: Date.now().toString() }]);
    toast.success('Justificativa adicionada com sucesso.');

    form.reset({
      patientName: '',
      medicalRecord: '',
      type: 'Eletivo',
      surgery: '',
      justification: '',
    });
    setPdf((prev) => ({ ...prev, progress: 0 }));
    // Volta o foco ao número para agilizar a próxima entrada sem o mouse.
    form.setFocus('medicalRecord');
  };

  // Salva a edição feita no diálogo de edição.
  const handleSaveEdit: SubmitHandler<JustificationFormValues> = (values) => {
    if (!editItem) return;
    setDataList((prev) => prev.map((item) => (item.id === editItem.id ? { ...values, id: editItem.id } : item)));
    setEditItem(null);
    setPdf((prev) => ({ ...prev, url: null, progress: 0 }));
    toast.success('Justificativa atualizada com sucesso.');
  };

  const onSubmitDoctorInfo: SubmitHandler<DoctorInfo> = (values) => {
    if (values.doctorName === '' && values.crm === '') {
      setDoctorInfo({ doctorName: '', crm: '' });
      toast.success('Informações do médico removidas.');
      return;
    }
    setDoctorInfo(values);
    toast.success('Informações do médico salvas com sucesso.');
  };

  const handleEdit = (id: string) => {
    const itemToEdit = dataList.find((item) => item.id === id);
    if (itemToEdit) setEditItem(itemToEdit);
  };

  const handleDelete = (id: string) => {
    setDataList((prev) => prev.filter((item) => item.id !== id));
    toast.success('Justificativa excluída com sucesso.');
  };

  const handleDuplicate = (item: JustificationData) => {
    const newItem = { ...item, id: Date.now().toString() };
    setDataList((prev) => [...prev, newItem]);
    toast.success('Justificativa duplicada com sucesso.');
  };

  const handleClearJustificationForm = () => {
    form.reset({
      patientName: '',
      medicalRecord: '',
      type: 'Eletivo',
      surgery: '',
      justification: '',
    });
    toast.info('Formulário de justificativa limpo.');
  };

  const handleClearAllJustifications = () => {
    setDataList([]);
    toast.success('Todas as justificativas foram removidas.');
  };

  const handleClearDoctorForm = () => {
    formDoctor.reset({
      doctorName: '',
      crm: '',
    });
    toast.info('Formulário do médico limpo.');
  };

  useHotkeys([
    {
      combo: 'ctrl+enter',
      enableOnFormTags: true,
      handler: () => form.handleSubmit(onSubmit)(),
    },
    {
      combo: 'ctrl+b',
      enableOnFormTags: true,
      handler: () => handleLookup(),
    },
    {
      combo: 'ctrl+shift+f',
      enableOnFormTags: true,
      handler: () => form.setFocus('medicalRecord'),
    },
    {
      combo: 'ctrl+shift+p',
      enableOnFormTags: true,
      handler: () => form.setFocus('patientName'),
    },
    {
      combo: 'ctrl+shift+g',
      enableOnFormTags: true,
      handler: () => form.setFocus('surgery'),
    },
    {
      combo: 'ctrl+shift+u',
      enableOnFormTags: true,
      handler: () => form.setFocus('justification'),
    },
    {
      combo: 'ctrl+o',
      enableOnFormTags: true,
      handler: () => fileInputRef.current?.click(),
    },
    {
      combo: 'ctrl+s',
      enableOnFormTags: true,
      handler: () => handleExport(),
    },
    {
      combo: 'ctrl+p',
      enableOnFormTags: true,
      handler: () => handlePrintAll(),
    },
    {
      combo: 'escape',
      enableOnFormTags: true,
      preventDefault: false,
      handler: () => {
        if (showHelp) {
          setShowHelp(false);
        } else if (editItem) {
          setEditItem(null);
        }
      },
    },
    {
      combo: '?',
      handler: () => setShowHelp((prev) => !prev),
    },
  ]);

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:py-10">
      <NewsBanner />
      <header className="relative mb-6 text-center">
        <h1 className="text-4xl font-extrabold tracking-tight">JustOFT</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Justificativas de cirurgias · Serviço de Oftalmologia do HGF
        </p>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowHelp(true)}
          aria-label="Atalhos de teclado"
          title="Atalhos de teclado (?)"
          className="text-muted-foreground absolute top-0 right-0"
        >
          <Keyboard />
        </Button>
      </header>
      <Separator className="mb-8" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
        <div className="space-y-6 lg:sticky lg:top-8">
          <JustificationForm
            form={form}
            onSubmit={onSubmit}
            handleExport={handleExport}
            handleImport={handleImport}
            handleClearJustificationForm={handleClearJustificationForm}
            fileInputRef={fileInputRef}
            onLookup={handleLookup}
            onOpenBatch={openBatchDialog}
            lookupLoading={lookupLoading}
            lookupSteps={lookupSteps}
          />

          <BatchLookupDialog
            key={batchKey}
            open={batchOpen}
            onOpenChange={setBatchOpen}
            running={batchRunning}
            items={batchItems}
            onConfirm={handleBatchLookup}
          />

          <EditJustificationDialog item={editItem} onOpenChange={() => setEditItem(null)} onSave={handleSaveEdit} />

          <FastmedicAccess
            creds={fastmedicCreds}
            setCreds={setFastmedicCreds}
            open={credsOpen}
            onOpenChange={setCredsOpen}
          />

          <DoctorForm
            formDoctor={formDoctor}
            onSubmitDoctorInfo={onSubmitDoctorInfo}
            handleClearDoctorForm={handleClearDoctorForm}
          />
        </div>

        <div className="space-y-6 lg:col-span-2">
          <JustificationPreview form={form} doctorInfo={doctorInfo} />

          <JustificationList
            dataList={dataList}
            handleEdit={handleEdit}
            handleDelete={handleDelete}
            handlePrintSingle={handlePrintSingle}
            handleDuplicate={handleDuplicate}
            handleClearAllJustifications={handleClearAllJustifications}
          />

          {dataList.length > 0 && (
            <ActionButtons
              loading={pdf.loading}
              progress={pdf.progress}
              pdfUrl={pdf.url}
              handlePrintAll={handlePrintAll}
            />
          )}
        </div>
      </div>

      <HotkeysHelp open={showHelp} onClose={() => setShowHelp(false)} />
    </main>
  );
}
