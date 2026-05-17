import { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Activity, Play } from "lucide-react";

// A simple visual demo of an Aviator-style crash game
function AviatorDemo() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [multiplier, setMultiplier] = useState(1.00);
  const [isCrashed, setIsCrashed] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (!isPlaying) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let currentMultiplier = 1.0;
    let time = 0;
    const crashPoint = 1.5 + Math.random() * 5; // Random crash point between 1.5x and 6.5x
    
    setIsCrashed(false);

    const draw = () => {
      time += 0.016; // Roughly 60fps
      
      // Exponential curve for multiplier
      currentMultiplier = 1 + Math.pow(time, 2) * 0.2;
      setMultiplier(currentMultiplier);

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (currentMultiplier >= crashPoint) {
        setIsCrashed(true);
        setIsPlaying(false);
        // Draw crashed state
        ctx.fillStyle = "rgba(220, 38, 38, 0.1)"; // destructive color
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        return; // Stop animation
      }

      // Draw grid
      ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
      ctx.lineWidth = 1;
      for(let i=0; i<canvas.width; i+=50) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height); ctx.stroke();
      }
      for(let i=0; i<canvas.height; i+=50) {
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(canvas.width, i); ctx.stroke();
      }

      // Draw curve
      ctx.beginPath();
      ctx.moveTo(0, canvas.height);
      
      const currentX = Math.min(canvas.width - 20, time * 50);
      const currentY = canvas.height - Math.min(canvas.height - 20, Math.pow(time, 2) * 15);
      
      ctx.quadraticCurveTo(currentX * 0.5, canvas.height, currentX, currentY);
      
      ctx.strokeStyle = "#00C853"; // primary color
      ctx.lineWidth = 4;
      ctx.stroke();

      // Draw "plane" (just a dot for this simple demo)
      ctx.beginPath();
      ctx.arc(currentX, currentY, 6, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.shadowColor = "#00C853";
      ctx.shadowBlur = 10;

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isPlaying]);

  return (
    <div className="relative bg-[#1a1a24] rounded-xl overflow-hidden border border-border aspect-video max-h-[400px] w-full flex flex-col items-center justify-center">
      <canvas 
        ref={canvasRef} 
        width={800} 
        height={400} 
        className="w-full h-full absolute inset-0"
      />
      
      <div className="relative z-10 text-center pointer-events-none">
        <div className={`text-6xl md:text-8xl font-black tabular-nums transition-colors duration-200 ${isCrashed ? 'text-destructive' : 'text-primary'}`}>
          {multiplier.toFixed(2)}x
        </div>
        {isCrashed && (
          <div className="text-destructive font-bold text-xl md:text-3xl mt-2 animate-in slide-in-from-bottom-2">
            CRASHED
          </div>
        )}
      </div>

      {!isPlaying && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20">
          <Button 
            size="lg" 
            className="w-48 font-bold text-lg shadow-[0_0_20px_rgba(0,200,83,0.5)]"
            onClick={() => setIsPlaying(true)}
          >
            <Play className="mr-2 h-5 w-5" /> {isCrashed ? "Play Again" : "Start Demo"}
          </Button>
        </div>
      )}
    </div>
  );
}

export default function Casino() {
  return (
    <div className="space-y-10 animate-in fade-in duration-300">
      <div className="text-center space-y-4">
        <h1 className="text-4xl md:text-5xl font-black tracking-tighter uppercase">
          Kiala Casino
        </h1>
        <p className="text-muted-foreground text-lg">Fast-paced games. Instant wins.</p>
      </div>

      <section>
        <h2 className="text-2xl font-bold tracking-tight mb-4 flex items-center gap-2">
          <Activity className="text-primary" /> Popular: Crash Game
        </h2>
        <AviatorDemo />
      </section>

      <section>
        <h2 className="text-2xl font-bold tracking-tight mb-4">Virtual Games</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
            <Card key={i} className="bg-card border-border hover:border-primary/50 transition-colors cursor-pointer group overflow-hidden relative aspect-[3/4]">
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent z-10" />
              <div className="absolute inset-0 bg-secondary group-hover:scale-105 transition-transform duration-500 flex items-center justify-center">
                 <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
                    <span className="text-primary font-bold">Game {i}</span>
                 </div>
              </div>
              <div className="absolute bottom-4 left-4 z-20">
                <p className="font-bold text-white">Virtual Slot {i}</p>
              </div>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}