'use client';

import { UUID } from 'crypto';
import { zodResolver } from '@hookform/resolvers/zod';
import { DownloadIcon, UploadIcon } from '@radix-ui/react-icons';
import { AlertTriangle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Alert, AlertDescription } from '@/components/ui/alert';
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
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { createPdfFromData, createPdfUrl, fillPdfTemplateWithDataForPage } from '@/lib/utils';

const formSchema = z.object({
  patientName: z
    .string()
    .min(1, 'Nome do paciente é obrigatório.')
    .transform((value) => value.toUpperCase()),
  medicalRecord: z.string().min(1, 'Número do prontuário é obrigatório.'),
  type: z.enum(['Urgente', 'Eletivo'], {
    errorMap: () => ({ message: "Por favor, selecione 'Urgente' ou 'Eletivo'." }),
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

// Esquema de validação atualizado para o formulário do médico
const doctorFormSchema = z.object({
  doctorName: z
    .string()
    .optional()
    .transform((value) => value?.toUpperCase() || ''),
  crm: z.string().optional(),
});

type JustificationData = {
  id: UUID;
  patientName: string;
  medicalRecord: string;
  type: 'Urgente' | 'Eletivo';
  surgery: string;
  justification: string;
};

export default function Home() {
  const [dataList, setDataList] = useState<JustificationData[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  // Estado para armazenar as informações do médico
  const [doctorInfo, setDoctorInfo] = useState<{ doctorName: string; crm: string }>({ doctorName: '', crm: '' });

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      patientName: '',
      medicalRecord: '',
      type: 'Eletivo',
      surgery: '',
      justification: '',
    },
  });

  // Formulário para as informações do médico
  const formDoctor = useForm({
    resolver: zodResolver(doctorFormSchema),
    defaultValues: doctorInfo,
  });

  // Carrega dados do localStorage ao montar o componente
  useEffect(() => {
    const storedData = localStorage.getItem('dataList');
    if (storedData) {
      setDataList(JSON.parse(storedData));
    }

    const storedDoctorInfo = localStorage.getItem('doctorInfo');
    if (storedDoctorInfo) {
      const parsedDoctorInfo = JSON.parse(storedDoctorInfo);
      setDoctorInfo(parsedDoctorInfo);
      formDoctor.reset(parsedDoctorInfo); // Atualiza os valores do formulário do médico
    }
  }, [formDoctor]);

  // Salva dados no localStorage após ações específicas
  const saveDataToLocalStorage = (newData: JustificationData[]) => {
    localStorage.setItem('dataList', JSON.stringify(newData));
  };

  // Exporta dados como arquivo JSON
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

  // Importa dados de arquivo JSON
  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const importedData = JSON.parse(e.target?.result as string);
          if (Array.isArray(importedData)) {
            setDataList(importedData);
            saveDataToLocalStorage(importedData);
            setAlertMessage('Dados importados com sucesso.');
          } else {
            setAlertMessage('Formato de arquivo inválido.');
          }
        } catch (error) {
          setAlertMessage('Erro ao importar o arquivo. Verifique o formato do arquivo.');
          console.log(error);
        }
      };
      reader.readAsText(file);
    }
  };

  const router = useRouter();

  // Modifique a função para incluir doctorInfo opcionalmente
  const handlePrintSingle = async (data: JustificationData) => {
    const modelPDFBytes = await fetch('/modelo.pdf').then((res) => res.arrayBuffer());
    const pdfBytes = await fillPdfTemplateWithDataForPage(data, modelPDFBytes, doctorInfo); // Passa doctorInfo
    const url = createPdfUrl(pdfBytes);
    router.push(url);
  };

  // Modifique a função para incluir doctorInfo opcionalmente
  const handlePrintAll = async () => {
    setLoading(true);
    setProgress(0);
    const modelPDFBytes = await fetch('/modelo.pdf').then((res) => res.arrayBuffer());
    const pdfDoc = await createPdfFromData(dataList, modelPDFBytes, doctorInfo); // Passa doctorInfo
    const pdfBytes = await pdfDoc.save();
    const url = createPdfUrl(pdfBytes);
    setPdfUrl(url);

    let currentProgress = 0;
    const interval = setInterval(() => {
      currentProgress += Math.max(1, (100 - currentProgress) * 0.25);
      setProgress(currentProgress);
      if (currentProgress >= 100) {
        clearInterval(interval);
        setLoading(false);
        setProgress(100);
      }
    }, 100);
  };

  const onSubmit = (values: any) => {
    setPdfUrl(null);
    setAlertMessage(null);
    let updatedDataList;
    if (editingId) {
      updatedDataList = dataList.map((item) => (item.id === editingId ? { ...values, id: editingId } : item));
      setEditingId(null);
    } else {
      updatedDataList = [...dataList, { ...values, id: Date.now().toString() }];
    }
    setDataList(updatedDataList);
    saveDataToLocalStorage(updatedDataList);
    form.setFocus('medicalRecord');
    form.reset();
    setProgress(0);
  };

  const onSubmitDoctorInfo = (values: any) => {
    setDoctorInfo({
      doctorName: values.doctorName || '',
      crm: values.crm || '',
    });
    localStorage.setItem('doctorInfo', JSON.stringify(values));
    setAlertMessage('Informações do médico salvas com sucesso.');
  };

  const handleEdit = (id: string) => {
    const itemToEdit = dataList.find((item) => item.id === id);
    if (itemToEdit) {
      form.setValue('patientName', itemToEdit.patientName);
      form.setValue('medicalRecord', itemToEdit.medicalRecord);
      form.setValue('type', itemToEdit.type);
      form.setValue('surgery', itemToEdit.surgery);
      form.setValue('justification', itemToEdit.justification);
      setEditingId(id);
    }
  };

  const handleDelete = (id: string) => {
    const updatedDataList = dataList.filter((item) => item.id !== id);
    setDataList(updatedDataList);
    saveDataToLocalStorage(updatedDataList);
  };

  const handleClearAll = () => {
    form.reset();
    formDoctor.reset();
    localStorage.clear();
    setDataList([]);
    setPdfUrl(null);
    setClearDialogOpen(false); // Fecha o diálogo após limpar os dados
    setProgress(0);
    setAlertMessage(null);
  };

  return (
    <main>
      <h1 className="mt-12 scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl text-center">JustOFT</h1>
      <Separator className="mt-4" />
      <div className="py-12 px-4 grid grid-cols-1 sm:grid-cols-3 space-y-4 sm:space-y-0 space-x-0 sm:space-x-4 lg:space-x-8 max-w-screen-xl mx-auto">
        <div className="space-y-4">
          {/* Formulário das justificativas */}
          <Card>
            <CardHeader>
              <CardTitle>Justificativas de Cirurgias</CardTitle>
              <div className="flex flex-row ">
                <div>
                  <label
                    htmlFor="importFile"
                    className="bg-primary text-primary-foreground shadow hover:bg-primary/90 inline-flex items-center justify-center whitespace-nowrap rounded-md rounded-r-none text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 h-9 px-4 py-2"
                  >
                    <UploadIcon className="size-5 " />
                  </label>
                  <Input type="file" id="importFile" accept=".json" onChange={handleImport} className="hidden" />
                </div>
                <Button onClick={handleExport} className="rounded-l-none">
                  <DownloadIcon className="size-5" />
                </Button>
              </div>
            </CardHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)}>
                <CardContent className="space-y-2">
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo</FormLabel>
                        <FormControl>
                          <RadioGroup value={field.value} onValueChange={field.onChange} className="flex">
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
                        <FormLabel>Número do Prontuário</FormLabel>
                        <FormControl>
                          <Input autoFocus placeholder="Digite o número do prontuário" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="patientName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome do Paciente</FormLabel>
                        <FormControl>
                          <Input placeholder="Digite o nome do paciente" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="justification"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Justificativa</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            className="border p-2 rounded w-full"
                            placeholder="Digite a justificativa"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="surgery"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Proposta de Cirurgia</FormLabel>
                        <FormControl>
                          <Input placeholder="Descreva a cirurgia" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
                <CardFooter className="flex justify-end space-x-2">
                  <AlertDialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive">Limpar Tudo</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Confirmar limpeza</AlertDialogTitle>
                        <AlertDialogDescription>
                          Tem certeza de que deseja limpar todos os dados?
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleClearAll}>Confirmar</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  <Button type="submit">{editingId ? 'Atualizar' : 'Enviar'}</Button>
                </CardFooter>
              </form>
            </Form>
          </Card>

          {/* Formulário para as informações do médico */}
          <Card>
            <CardHeader>
              <CardTitle>Informações do Médico (Opcional)</CardTitle>
            </CardHeader>
            <Form {...formDoctor}>
              <form onSubmit={formDoctor.handleSubmit(onSubmitDoctorInfo)}>
                <CardContent className="space-y-2">
                  <FormField
                    control={formDoctor.control}
                    name="doctorName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome do Médico</FormLabel>
                        <FormControl>
                          <Input placeholder="Digite o nome do médico (opcional)" {...field} />
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
                          <Input placeholder="Digite o CRM (opcional)" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
                <CardFooter className="flex justify-end space-x-2">
                  <Button type="submit">Salvar Informações</Button>
                </CardFooter>
              </form>
            </Form>
          </Card>
        </div>

        <div className="space-y-2 col-span-2">
          {alertMessage && (
            <Alert variant="default">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{alertMessage}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-4 lg:space-y-8">
            {dataList.map((item) => (
              <Card key={item.id}>
                <CardHeader>
                  <CardTitle>{item.patientName}</CardTitle>
                  <CardDescription>
                    <Badge variant={item.type === 'Urgente' ? 'destructive' : 'outline'} className="text-xs px-2 py-1">
                      {item.type}
                    </Badge>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="mt-2 space-y-1 text-sm text-gray-700">
                    <div className="flex justify-between">
                      <span className="font-semibold">Prontuário:</span> <span>{item.medicalRecord}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-semibold">Cirurgia:</span> <span>{item.surgery}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-semibold">Justificativa:</span>
                      <span className="ml-2 truncate">{item.justification}</span>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <Button size="sm" onClick={() => handlePrintSingle(item)} className="text-sm px-4 py-1">
                      Imprimir
                    </Button>
                    <Button size="sm" onClick={() => handleEdit(item.id)} className="text-sm px-4 py-1">
                      Editar
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="destructive" className="text-sm px-4 py-1">
                          Excluir
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta ação não pode ser desfeita. Isso excluirá permanentemente o item.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(item.id)}>Confirmar</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {!(dataList.length === 0) && (
            <div className="flex flex-col items-center py-2 sm:flex-row space-y-2 sm:space-y-0">
              <div className="flex justify-center">
                <Button onClick={handlePrintAll} disabled={loading} className="w-full sm:w-auto">
                  {loading ? 'Gerando PDF...' : 'Imprimir Tudo'}
                </Button>
              </div>

              {progress > 0 && (
                <div className="w-full px-10">
                  <Progress value={progress} />
                </div>
              )}

              {progress === 100 && pdfUrl ? (
                <div className="flex justify-center visible">
                  <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
                    <Button className="w-full sm:w-auto">Baixar PDF</Button>
                  </a>
                </div>
              ) : (
                <div className="flex justify-center invisible">
                  <Button className="w-full sm:w-auto">Baixar PDF</Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
