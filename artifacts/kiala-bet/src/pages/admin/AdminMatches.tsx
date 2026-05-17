import { useState } from "react";
import { useListMatches, useCreateMatch, useUpdateMatch, getListMatchesQueryKey } from "@workspace/api-client-react";
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

const matchSchema = z.object({
  homeTeam: z.string().min(2),
  awayTeam: z.string().min(2),
  sport: z.string().min(2),
  league: z.string().min(2),
  kickoff: z.string(),
  homeOdds: z.coerce.number().min(1.01),
  drawOdds: z.coerce.number().min(1.01),
  awayOdds: z.coerce.number().min(1.01),
  isFeatured: z.boolean().optional(),
});

export default function AdminMatches() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { data: matches, isLoading } = useListMatches({ limit: 50 });
  const createMutation = useCreateMatch();

  const form = useForm<z.infer<typeof matchSchema>>({
    resolver: zodResolver(matchSchema),
    defaultValues: {
      homeTeam: "",
      awayTeam: "",
      sport: "football",
      league: "",
      kickoff: new Date().toISOString().slice(0, 16),
      homeOdds: 1.5,
      drawOdds: 3.0,
      awayOdds: 2.5,
      isFeatured: false,
    },
  });

  const onSubmit = (values: z.infer<typeof matchSchema>) => {
    // Ensure kickoff is in proper ISO format with timezone if it's from a datetime-local
    const formattedValues = {
      ...values,
      kickoff: new Date(values.kickoff).toISOString()
    };
    
    createMutation.mutate({ data: formattedValues }, {
      onSuccess: () => {
        toast({ title: "Match created successfully" });
        setIsDialogOpen(false);
        form.reset();
        queryClient.invalidateQueries({ queryKey: getListMatchesQueryKey() });
      },
      onError: () => {
        toast({ title: "Failed to create match", variant: "destructive" });
      }
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Match Management</h1>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="font-bold">Add New Match</Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Create Match</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="homeTeam" render={({field}) => (
                    <FormItem><FormLabel>Home Team</FormLabel><FormControl><Input className="bg-secondary" {...field}/></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name="awayTeam" render={({field}) => (
                    <FormItem><FormLabel>Away Team</FormLabel><FormControl><Input className="bg-secondary" {...field}/></FormControl></FormItem>
                  )} />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="sport" render={({field}) => (
                    <FormItem>
                      <FormLabel>Sport</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="bg-secondary"><SelectValue placeholder="Select sport" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="football">Football</SelectItem>
                          <SelectItem value="basketball">Basketball</SelectItem>
                          <SelectItem value="tennis">Tennis</SelectItem>
                          <SelectItem value="esports">Esports</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="league" render={({field}) => (
                    <FormItem><FormLabel>League</FormLabel><FormControl><Input className="bg-secondary" {...field}/></FormControl></FormItem>
                  )} />
                </div>

                <FormField control={form.control} name="kickoff" render={({field}) => (
                  <FormItem><FormLabel>Kickoff</FormLabel><FormControl><Input type="datetime-local" className="bg-secondary" {...field}/></FormControl></FormItem>
                )} />

                <div className="grid grid-cols-3 gap-4">
                  <FormField control={form.control} name="homeOdds" render={({field}) => (
                    <FormItem><FormLabel>1</FormLabel><FormControl><Input type="number" step="0.01" className="bg-secondary font-mono" {...field}/></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name="drawOdds" render={({field}) => (
                    <FormItem><FormLabel>X</FormLabel><FormControl><Input type="number" step="0.01" className="bg-secondary font-mono" {...field}/></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name="awayOdds" render={({field}) => (
                    <FormItem><FormLabel>2</FormLabel><FormControl><Input type="number" step="0.01" className="bg-secondary font-mono" {...field}/></FormControl></FormItem>
                  )} />
                </div>

                <Button type="submit" className="w-full font-bold" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Creating..." : "Save Match"}
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
              {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : !matches || matches.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              No matches found. Create one above.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead>Match</TableHead>
                  <TableHead>Sport/League</TableHead>
                  <TableHead>Kickoff</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Odds (1X2)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {matches.map((match) => (
                  <TableRow key={match.id} className="border-border hover:bg-secondary/50">
                    <TableCell className="font-bold">
                      {match.homeTeam} vs {match.awayTeam}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">{match.sport}</div>
                      <div className="text-xs text-muted-foreground">{match.league}</div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {new Date(match.kickoff).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full ${
                        match.status === 'live' ? 'bg-destructive/20 text-destructive' : 
                        match.status === 'finished' ? 'bg-secondary text-muted-foreground' : 
                        'bg-primary/20 text-primary'
                      }`}>
                        {match.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      <span className="text-primary">{match.homeOdds.toFixed(2)}</span> / <span className="text-muted-foreground">{match.drawOdds.toFixed(2)}</span> / <span className="text-primary">{match.awayOdds.toFixed(2)}</span>
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