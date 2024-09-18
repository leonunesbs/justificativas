'use client';

import { UUID } from 'crypto';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
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
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { createPdfFromData, createPdfUrl, fillPdfTemplateWithDataForPage } from '@/lib/utils';

const formSchema = z.object({
  patientName: z.string().min(1, 'Nome do paciente é obrigatório.').toUpperCase(),
  medicalRecord: z.string().min(1, 'Número do prontuário é obrigatório.'),
  type: z.enum(['Urgente', 'Eletivo'], {
    errorMap: () => ({ message: "Por favor, selecione 'Urgente' ou 'Eletivo'." }),
  }),
  surgery: z.string().min(1, 'Cirurgia proposta é obrigatória.').toUpperCase(),
  justification: z.string().min(1, 'Justificativa é obrigatória.').toUpperCase(),
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

  // Load from localStorage on component mount
  useEffect(() => {
    const storedData = localStorage.getItem('dataList');
    if (storedData) {
      setDataList(JSON.parse(storedData));
    }
  }, []);

  // Save to localStorage after specific actions
  const saveDataToLocalStorage = (newData: JustificationData[]) => {
    localStorage.setItem('dataList', JSON.stringify(newData));
  };
  const router = useRouter();

  const handlePrintSingle = async (data: JustificationData) => {
    const modelPDFBytes = await fetch('/modelo.pdf').then((res) => res.arrayBuffer());
    const pdfBytes = await fillPdfTemplateWithDataForPage(data, modelPDFBytes);
    const url = createPdfUrl(pdfBytes);
    router.push(url);
  };

  const handlePrintAll = async () => {
    setLoading(true);
    setProgress(0);
    const modelPDFBytes = await fetch('/modelo.pdf').then((res) => res.arrayBuffer());
    const pdfDoc = await createPdfFromData(dataList, modelPDFBytes);
    const pdfBytes = await pdfDoc.save();
    const url = createPdfUrl(pdfBytes);
    setPdfUrl(url);

    // Progress bar with decelerating speed
    let currentProgress = 0;
    const interval = setInterval(() => {
      currentProgress += Math.max(1, (100 - currentProgress) * 0.25); // Decelerating progress
      setProgress(currentProgress);
      if (currentProgress >= 100) {
        clearInterval(interval);
        setLoading(false);
        setProgress(100);
      }
    }, 100);
  };

  const onSubmit = (values: any) => {
    setPdfUrl(null); // Reset the PDF download link
    let updatedDataList;
    if (editingId) {
      updatedDataList = dataList.map((item) => (item.id === editingId ? { ...values, id: editingId } : item));
      setEditingId(null);
    } else {
      updatedDataList = [...dataList, { ...values, id: Date.now().toString() }];
    }
    setDataList(updatedDataList);
    saveDataToLocalStorage(updatedDataList);
    form.reset(); // Reset the form after submission
    setProgress(0);
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
    setDataList([]);
    localStorage.removeItem('dataList'); // Clear data from localStorage
    setPdfUrl(null);
    setClearDialogOpen(false); // Close the dialog after clearing data
    setProgress(0);
  };

  return (
    <div>
      <h1 className="mt-12 scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl text-center">JustOFT</h1>
      <Separator className="mt-4" />
      <div className="py-12 px-4 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-screen-xl mx-auto">
        <div>
          <Card className="w-full">
            <CardHeader>
              <CardTitle>Justificativas de Cirurgias</CardTitle>
            </CardHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)}>
                <CardContent className="space-y-2">
                  {/* Tipo */}
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
                          <textarea
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
        </div>
        <div className="space-y-2 col-span-2">
          <div className="flex items-center">
            <div className="flex justify-center">
              <Button onClick={handlePrintAll} disabled={dataList.length === 0 || loading} className="w-full sm:w-auto">
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
          <div>
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
        </div>
      </div>
    </div>
  );
}
