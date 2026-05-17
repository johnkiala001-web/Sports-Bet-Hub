import { useState } from "react";
import { useListJackpots, useCreateJackpot, getListJackpotsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const jackpotSchema = z.object({
  name: z.string().min(3),
  type: z.string().min(2),
  poolAmount: z.coerce.number().min(1000),
  ticketPrice: z.coerce.number().min(0.5),
  drawDate: z.string(),
});

export default function AdminJackpots() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { data: jackpots, isLoading } = useListJackpots();
  const createMutation = useCreateJackpot();

  const form = useForm<z.infer<typeof jackpotSchema>>({
    resolver: zodResolver(jackpotSchema),
    defaultValues: {
      name: "Mega Weekend Jackpot",
      type: "mega",
      poolAmount: 1000000,
      ticketPrice: 1,
      drawDate: new Date(Date.now() + 7*24*60*60*1000).toISOString().slice(0, 16),
    },
  });

  const onSubmit = (values: z.infer<typeof jackpotSchema>) => {
    const formattedValues = {
      ...values,
      drawDate: new Date(values.drawDate).toISOString()
    };
    
    createMutation.mutate({ data: formattedValues }, {
      onSuccess: () => {
        toast({ title: "Jackpot created successfully" });
        setIsDialogOpen(false);
        form.reset();
        queryClient.invalidateQueries({ queryKey: getListJackpotsQueryKey() });
      },
      onError: () => {
        toast({ title: "Failed to create jackpot", variant: "destructive" });
      }
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Jackpot Management</h1>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="font-bold">Create New Jackpot</Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Create Jackpot</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="name" render={({field}) => (
                  <FormItem><FormLabel>Name</FormLabel><FormControl><Input className="bg-secondary" {...field}/></FormControl></FormItem>
                )} />
                
                <FormField control={form.control} name="type" render={({field}) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-secondary"><SelectValue placeholder="Select type" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="mega">Mega</SelectItem>
                        <SelectItem value="midweek">Midweek</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />

                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="poolAmount" render={({field}) => (
                    <FormItem><FormLabel>Prize Pool ($)</FormLabel><FormControl><Input type="number" className="bg-secondary font-mono" {...field}/></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name="ticketPrice" render={({field}) => (
                    <FormItem><FormLabel>Ticket Price ($)</FormLabel><FormControl><Input type="number" step="0.1" className="bg-secondary font-mono" {...field}/></FormControl></FormItem>
                  )} />
                </div>

                <FormField control={form.control} name="drawDate" render={({field}) => (
                  <FormItem><FormLabel>Draw Date</FormLabel><FormControl><Input type="datetime-local" className="bg-secondary" {...field}/></FormControl></FormItem>
                )} />

                <Button type="submit" className="w-full font-bold mt-4" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Creating..." : "Save Jackpot"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="bg-card border-border">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : !jackpots || jackpots.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              No jackpots found. Create one above.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead>Name</TableHead>
                  <TableHead>Prize Pool</TableHead>
                  <TableHead>Ticket</TableHead>
                  <TableHead>Draw Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jackpots.map((jackpot) => (
                  <TableRow key={jackpot.id} className="border-border hover:bg-secondary/50">
                    <TableCell className="font-bold uppercase tracking-wider">
                      {jackpot.name}
                    </TableCell>
                    <TableCell className="font-black text-primary text-lg">
                      ${jackpot.poolAmount.toLocaleString()}
                    </TableCell>
                    <TableCell className="font-mono">
                      ${jackpot.ticketPrice.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {new Date(jackpot.drawDate).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full ${
                        jackpot.status === 'open' ? 'bg-primary/20 text-primary' : 
                        jackpot.status === 'closed' ? 'bg-destructive/20 text-destructive' : 
                        'bg-secondary text-muted-foreground'
                      }`}>
                        {jackpot.status}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}