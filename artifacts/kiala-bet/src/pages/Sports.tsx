import { useState } from "react";
import { useListMatches } from "@workspace/api-client-react";
import { MatchCard } from "@/components/shared/MatchCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useParams, useLocation } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";

export default function Sports() {
  const params = useParams<{ sport?: string }>();
  const [_, setLocation] = useLocation();
  
  const currentSport = params.sport || "football";

  const { data: matches, isLoading } = useListMatches({ sport: currentSport });

  const handleTabChange = (val: string) => {
    setLocation(`/sports/${val}`);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Sportsbook</h1>
      </div>

      <Tabs value={currentSport} onValueChange={handleTabChange} className="w-full">
        <TabsList className="bg-secondary mb-6 w-full justify-start overflow-x-auto p-1 h-auto rounded-xl border border-border">
          <TabsTrigger value="football" className="rounded-lg px-6 py-2.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-semibold">
            Football
          </TabsTrigger>
          <TabsTrigger value="basketball" className="rounded-lg px-6 py-2.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-semibold">
            Basketball
          </TabsTrigger>
          <TabsTrigger value="tennis" className="rounded-lg px-6 py-2.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-semibold">
            Tennis
          </TabsTrigger>
          <TabsTrigger value="esports" className="rounded-lg px-6 py-2.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-semibold">
            Esports
          </TabsTrigger>
        </TabsList>

        <TabsContent value={currentSport} className="mt-0 outline-none">
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Skeleton key={i} className="h-44 w-full rounded-xl bg-card border border-border" />
              ))}
            </div>
          ) : matches && matches.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {matches.map((match) => (
                <MatchCard key={match.id} match={match} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground bg-card rounded-xl border border-border">
              <p className="text-lg font-medium mb-2">No matches found</p>
              <p className="text-sm">There are currently no upcoming matches for {currentSport}.</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}