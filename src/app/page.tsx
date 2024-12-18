'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { DownloadIcon, TrashIcon, UploadIcon } from '@radix-ui/react-icons';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
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

const doctorFormSchema = z.object({
  doctorName: z
    .string()
    .optional()
    .transform((value) => value?.toUpperCase() || ''),
  crm: z.string().optional(),
});

const justificationDataSchema = z.object({
  id: z.string(),
  patientName: z.string(),
  medicalRecord: z.string(),
  type: z.enum(['Urgente', 'Eletivo']),
  surgery: z.string(),
  justification: z.string(),
});

type JustificationData = z.infer<typeof justificationDataSchema>;

function JustificationList({
  dataList,
  handleEdit,
  handleDelete,
  handlePrintSingle,
  handleDuplicate,
  handleClearAllJustifications,
}: any) {
  return (
    <div className="space-y-4">
      {dataList.map((item: JustificationData) => (
        <Card key={item.id}>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>{item.patientName}</CardTitle>
              <Badge variant={item.type === 'Urgente' ? 'destructive' : 'outline'}>{item.type}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <strong>Prontuário:</strong> {item.medicalRecord}
            </p>
            <p>
              <strong>Cirurgia:</strong> {item.surgery}
            </p>
            <p>
              <strong>Justificativa:</strong> {item.justification}
            </p>
          </CardContent>
          <CardFooter className="flex justify-end space-x-2">
            <Button size="sm" onClick={() => handlePrintSingle(item)}>
              Imprimir
            </Button>
            <Button size="sm" onClick={() => handleEdit(item.id)}>
              Editar
            </Button>
            <Button size="sm" onClick={() => handleDuplicate(item)}>
              Duplicar
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="destructive">
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

      {dataList.length > 0 && (
        <div className="flex justify-end mt-4">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" className="text-red-600 hover:bg-red-50" size="sm">
                <TrashIcon className="mr-2 h-4 w-4" />
                Limpar Todas as Justificativas
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirmar exclusão de todas as justificativas</AlertDialogTitle>
                <AlertDialogDescription>
                  Tem certeza de que deseja excluir **todas** as justificativas salvas? Essa ação não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleClearAllJustifications}>Confirmar</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </div>
  );
}

function ActionButtons({ loading, progress, pdfUrl, handlePrintAll }: any) {
  return (
    <div className="flex flex-col items-center space-y-4">
      <Button onClick={handlePrintAll} disabled={loading}>
        {loading ? 'Gerando PDF...' : 'Imprimir Tudo'}
      </Button>
      {progress > 0 && (
        <div className="w-full">
          <Progress value={progress} />
        </div>
      )}
      {progress === 100 && pdfUrl && (
        <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
          <Button>Baixar PDF</Button>
        </a>
      )}
    </div>
  );
}

function JustificationForm({
  form,
  onSubmit,
  editingId,
  handleExport,
  handleImport,
  handleClearJustificationForm,
}: any) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Justificativas de Cirurgias</CardTitle>
        <div className="flex space-x-2 mt-2">
          <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
            <UploadIcon className="mr-2" />
            Importar
          </Button>
          <Input type="file" ref={fileInputRef} accept=".json" onChange={handleImport} className="hidden" multiple />
          <Button onClick={handleExport}>
            <DownloadIcon className="mr-2" />
            Exportar
          </Button>
        </div>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
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
            {['medicalRecord', 'patientName', 'surgery'].map((fieldName) => (
              <FormField
                key={fieldName}
                control={form.control}
                name={fieldName}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {fieldName === 'medicalRecord'
                        ? 'Número do Prontuário'
                        : fieldName === 'patientName'
                          ? 'Nome do Paciente'
                          : 'Proposta de Cirurgia'}
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder={`Digite ${fieldName === 'surgery' ? 'a' : 'o'} ${
                          fieldName === 'medicalRecord'
                            ? 'número do prontuário'
                            : fieldName === 'patientName'
                              ? 'nome do paciente'
                              : 'proposta de cirurgia'
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
            <Button type="button" variant="destructive" onClick={handleClearJustificationForm}>
              Limpar
            </Button>
            <Button type="submit">{editingId ? 'Atualizar' : 'Adicionar'}</Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}

function DoctorForm({ formDoctor, onSubmitDoctorInfo, handleClearDoctorForm }: any) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Informações do Médico (Opcional)</CardTitle>
      </CardHeader>
      <Form {...formDoctor}>
        <form onSubmit={formDoctor.handleSubmit(onSubmitDoctorInfo)}>
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
          <CardFooter className="flex justify-between items-center">
            <Button type="button" variant="destructive" onClick={handleClearDoctorForm}>
              Limpar
            </Button>
            <Button type="submit">Salvar</Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}

export default function Home() {
  const { toast } = useToast();
  const [dataList, setDataList] = useState<JustificationData[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const [doctorInfo, setDoctorInfo] = useState<{ doctorName: string; crm: string }>({
    doctorName: '',
    crm: '',
  });

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

  const formDoctor = useForm({
    resolver: zodResolver(doctorFormSchema),
    defaultValues: { doctorName: doctorInfo.doctorName, crm: doctorInfo.crm },
  });

  useEffect(() => {
    const storedData = localStorage.getItem('dataList');
    if (storedData) {
      setDataList(JSON.parse(storedData));
    }

    const storedDoctorInfo = localStorage.getItem('doctorInfo');
    if (storedDoctorInfo) {
      const parsedDoctorInfo = JSON.parse(storedDoctorInfo);
      setDoctorInfo(parsedDoctorInfo);
      formDoctor.reset(parsedDoctorInfo);
    }
  }, [formDoctor]);

  const saveDataToLocalStorage = (newData: JustificationData[]) => {
    localStorage.setItem('dataList', JSON.stringify(newData));
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
    if (files) {
      const newDataList = [...dataList];
      let filesProcessed = 0;
      let duplicatesCount = 0;
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const importedData = JSON.parse(e.target?.result as string);
            if (Array.isArray(importedData)) {
              const validData = importedData.filter((item) => {
                try {
                  justificationDataSchema.parse(item);
                  return true;
                } catch (e) {
                  console.log(e);
                  return false;
                }
              });

              validData.forEach((item) => {
                const exists = newDataList.some(
                  (existingItem) =>
                    existingItem.patientName === item.patientName &&
                    existingItem.medicalRecord === item.medicalRecord &&
                    existingItem.surgery === item.surgery &&
                    existingItem.justification === item.justification &&
                    existingItem.type === item.type
                );
                if (!exists) {
                  newDataList.push(item);
                } else {
                  duplicatesCount++;
                }
              });

              filesProcessed++;
              if (filesProcessed === files.length) {
                setDataList(newDataList);
                saveDataToLocalStorage(newDataList);
                if (duplicatesCount > 0) {
                  toast({ description: `Importação concluída. ${duplicatesCount} itens duplicados foram ignorados.` });
                } else {
                  toast({ description: 'Dados importados e combinados com sucesso.' });
                }
              }
            } else {
              toast({ description: 'Formato de arquivo inválido.' });
            }
          } catch (error) {
            console.error(error);
            toast({ description: 'Erro ao importar o arquivo. Verifique o formato do arquivo.' });
          }
        };
        reader.readAsText(file);
      }
    }
  };

  const router = useRouter();

  const handlePrintSingle = async (data: JustificationData) => {
    const modelPDFBytes = await fetch('/modelo.pdf').then((res) => res.arrayBuffer());
    const pdfBytes = await fillPdfTemplateWithDataForPage(data, modelPDFBytes, doctorInfo);
    const url = createPdfUrl(pdfBytes);
    router.push(url);
  };

  const handlePrintAll = async () => {
    setLoading(true);
    setProgress(0);
    const modelPDFBytes = await fetch('/modelo.pdf').then((res) => res.arrayBuffer());
    const pdfDoc = await createPdfFromData(dataList, modelPDFBytes, doctorInfo);
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

    const exists = dataList.some(
      (item) =>
        item.patientName === values.patientName &&
        item.medicalRecord === values.medicalRecord &&
        item.surgery === values.surgery &&
        item.justification === values.justification &&
        item.type === values.type &&
        item.id !== editingId
    );

    if (exists && !editingId) {
      toast({ description: 'Esta justificativa já foi adicionada.' });
    } else {
      let updatedDataList;
      if (editingId) {
        updatedDataList = dataList.map((item) => (item.id === editingId ? { ...values, id: editingId } : item));
        setEditingId(null);
        toast({ description: 'Justificativa atualizada com sucesso.' });
      } else {
        updatedDataList = [...dataList, { ...values, id: Date.now().toString() }];
        toast({ description: 'Justificativa adicionada com sucesso.' });
      }
      setDataList(updatedDataList);
      saveDataToLocalStorage(updatedDataList);

      form.reset({
        patientName: '',
        medicalRecord: '',
        type: 'Eletivo',
        surgery: '',
        justification: '',
      });
      setProgress(0);
    }
  };

  const onSubmitDoctorInfo = (values: any) => {
    if (values.doctorName === '' && values.crm === '') {
      setDoctorInfo({ doctorName: '', crm: '' });
      localStorage.removeItem('doctorInfo');
      formDoctor.reset();
      toast({ description: 'Informações do médico removidas.' });
      return;
    }
    setDoctorInfo(values);
    localStorage.setItem('doctorInfo', JSON.stringify(values));
    toast({ description: 'Informações do médico salvas com sucesso.' });
  };

  const handleEdit = (id: string) => {
    const itemToEdit = dataList.find((item) => item.id === id);
    if (itemToEdit) {
      form.reset(itemToEdit);
      setEditingId(id);
    }
  };

  const handleDelete = (id: string) => {
    const updatedDataList = dataList.filter((item) => item.id !== id);
    setDataList(updatedDataList);
    saveDataToLocalStorage(updatedDataList);
    toast({ description: 'Justificativa excluída com sucesso.' });
  };

  const handleDuplicate = (item: JustificationData) => {
    const newItem = { ...item, id: Date.now().toString() };
    const updatedDataList = [...dataList, newItem];
    setDataList(updatedDataList);
    saveDataToLocalStorage(updatedDataList);
    toast({ description: 'Justificativa duplicada com sucesso.' });
  };

  const handleClearJustificationForm = () => {
    form.reset({
      patientName: '',
      medicalRecord: '',
      type: 'Eletivo',
      surgery: '',
      justification: '',
    });
    setEditingId(null);
    toast({ description: 'Formulário de justificativa limpo.' });
  };

  const handleClearAllJustifications = () => {
    setDataList([]);
    localStorage.removeItem('dataList');
    toast({ description: 'Todas as justificativas foram removidas.' });
  };

  const handleClearDoctorForm = () => {
    formDoctor.reset({
      doctorName: '',
      crm: '',
    });
    toast({ description: 'Formulário do médico limpo.' });
  };

  return (
    <main className="max-w-screen-xl mx-auto p-4">
      <h1 className="mt-8 text-4xl font-extrabold text-center">JustOFT</h1>
      <Separator className="my-4" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-6">
          <JustificationForm
            form={form}
            onSubmit={onSubmit}
            editingId={editingId}
            handleExport={handleExport}
            handleImport={handleImport}
            handleClearJustificationForm={handleClearJustificationForm}
          />

          <DoctorForm
            formDoctor={formDoctor}
            onSubmitDoctorInfo={onSubmitDoctorInfo}
            handleClearDoctorForm={handleClearDoctorForm}
          />
        </div>

        <div className="lg:col-span-2 space-y-6">
          <JustificationList
            dataList={dataList}
            handleEdit={handleEdit}
            handleDelete={handleDelete}
            handlePrintSingle={handlePrintSingle}
            handleDuplicate={handleDuplicate}
            handleClearAllJustifications={handleClearAllJustifications}
          />

          {dataList.length > 0 && (
            <ActionButtons loading={loading} progress={progress} pdfUrl={pdfUrl} handlePrintAll={handlePrintAll} />
          )}
        </div>
      </div>
    </main>
  );
}
