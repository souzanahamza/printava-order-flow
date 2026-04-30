import { useLayoutEffect, useRef, useState } from 'react';
import {
  Banknote,
  BarChart3,
  Boxes,
  Calendar,
  CheckCircle,
  ClipboardList,
  Cog,
  Factory,
  FileText,
  Package,
  Palette,
  Settings,
  ShoppingCart,
  Truck,
  User,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type MouseClient = { x: number; y: number };

const PROXIMITY_RADIUS = 150;
const PROXIMITY_PUSH = 20;

function GlassOrb({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'pointer-events-none absolute rounded-full mix-blend-screen opacity-95 blur-3xl',
        className,
      )}
      aria-hidden
    />
  );
}

function ProximityIconChip({
  className,
  floatClass,
  delayClass,
  chipClass,
  mouse,
  children,
}: {
  className?: string;
  floatClass: string;
  delayClass?: string;
  chipClass: string;
  mouse: MouseClient | null;
  children: React.ReactNode;
}) {
  const outerRef = useRef<HTMLDivElement>(null);
  const [prox, setProx] = useState({ tx: 0, ty: 0, scale: 1 });

  useLayoutEffect(() => {
    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      setProx({ tx: 0, ty: 0, scale: 1 });
      return;
    }
    if (!mouse || !outerRef.current) {
      setProx({ tx: 0, ty: 0, scale: 1 });
      return;
    }
    const rect = outerRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = mouse.x - cx;
    const dy = mouse.y - cy;
    const dist = Math.hypot(dx, dy);
    const t = Math.max(0, 1 - dist / PROXIMITY_RADIUS);
    if (t < 0.03) {
      setProx({ tx: 0, ty: 0, scale: 1 });
      return;
    }
    const len = Math.hypot(dx, dy) || 1;
    const nx = dx / len;
    const ny = dy / len;
    const push = PROXIMITY_PUSH * t;
    setProx({ tx: -nx * push, ty: -ny * push, scale: 1 + 0.12 * t });
  }, [mouse]);

  return (
    <div
      ref={outerRef}
      className={cn(
        'absolute z-20 flex items-center justify-center motion-reduce:animate-none',
        floatClass,
        delayClass,
        className,
      )}
      aria-hidden
    >
      <div
        className={cn(
          'flex items-center justify-center rounded-2xl border backdrop-blur-sm will-change-transform motion-reduce:transition-none',
          'transition-[transform,box-shadow] duration-200 ease-out',
          chipClass,
          prox.tx !== 0 || prox.ty !== 0
            ? 'shadow-[0_0_24px_rgba(167,139,250,0.35)] ring-1 ring-white/25'
            : '',
        )}
        style={{
          transform: `translate(${prox.tx}px, ${prox.ty}px) scale(${prox.scale})`,
        }}
      >
        {children}
      </div>
    </div>
  );
}

/** Glass-only task-card silhouette (no copy) — tones echo design vs production cards. */
type TaskCardPreset = 'design' | 'production' | 'hybrid';

function DecorativeOrderCard({
  className,
  preset,
  breatheClass,
}: {
  className?: string;
  preset: TaskCardPreset;
  breatheClass?: string;
}) {
  const ringBorder =
    preset === 'design'
      ? 'ring-1 ring-fuchsia-500/35 border-fuchsia-500/25'
      : preset === 'production'
        ? 'ring-1 ring-amber-500/35 border-amber-500/25'
        : 'ring-1 ring-indigo-400/40 border-indigo-400/30';

  const leftAccent =
    preset === 'design'
      ? 'border-l-fuchsia-500'
      : preset === 'production'
        ? 'border-l-amber-500'
        : 'border-l-indigo-400';

  return (
    <div
      className={cn(
        'relative flex w-full max-w-[300px] flex-col overflow-hidden rounded-xl border border-l-4 border-white/14 bg-white/[0.045] shadow-[0_0_0_1px_rgba(255,255,255,0.06)_inset,0_20px_50px_-18px_rgba(99,102,241,0.28)] backdrop-blur-md',
        leftAccent,
        ringBorder,
        breatheClass,
        className,
      )}
      aria-hidden
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/[0.05] to-transparent motion-reduce:animate-none animate-auth-shimmer" />

      <div className="relative space-y-3 border-b border-white/10 px-4 pb-3 pt-4 sm:px-5">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <div className="h-7 w-[4.25rem] rounded-md bg-white/22" />
            <div className="h-5 w-[7.5rem] rounded-md border border-white/15 bg-white/5" />
            <div className="h-5 w-14 rounded-md border border-white/10 bg-white/5" />
          </div>
          <div className="flex h-8 w-9 shrink-0 items-center justify-center rounded-md border border-white/20 bg-white/5">
            <Calendar className="h-3.5 w-3.5 text-white/40" strokeWidth={1.5} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {preset === 'design' && (
            <>
              <div className="h-5 w-[5.25rem] rounded-md bg-violet-600/75 shadow-inner" />
              <div className="h-5 w-24 rounded-md border border-amber-500/35 bg-amber-500/18" />
            </>
          )}
          {preset === 'production' && (
            <>
              <div className="h-5 w-20 rounded-md bg-amber-600/75 shadow-inner" />
              <div className="h-5 w-[4.5rem] rounded-md border border-emerald-500/35 bg-emerald-500/18" />
            </>
          )}
          {preset === 'hybrid' && (
            <>
              <div className="h-5 w-[5.75rem] rounded-md bg-orange-600/75 shadow-inner" />
              <div className="h-5 w-16 rounded-md border border-white/18 bg-white/6" />
            </>
          )}
        </div>
        <div className="flex items-center gap-2 pt-0.5">
          <div className="h-2 w-2 shrink-0 rounded-full bg-white/30" />
          <div className="h-2 max-w-[10rem] flex-1 rounded bg-white/12" />
        </div>
      </div>

      <div className="relative space-y-3 px-4 pb-4 pt-3 sm:px-5">
        <div className="grid gap-3 rounded-lg border border-white/10 bg-white/[0.04] p-3 sm:grid-cols-2">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/5">
                <User className="h-3.5 w-3.5 text-white/35" strokeWidth={1.5} />
              </div>
              <div className="h-2 flex-1 rounded bg-white/12" />
            </div>
            <div className="ml-9 h-2 w-full rounded bg-white/10" />
            <div className="ml-9 h-2 w-[58%] rounded bg-white/8" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/5">
                <Truck className="h-3.5 w-3.5 text-white/35" strokeWidth={1.5} />
              </div>
              <div className="h-2 flex-1 rounded bg-white/12" />
            </div>
            <div className="ml-9 h-2 w-full rounded bg-white/10" />
            <div className="ml-9 h-2 w-[42%] rounded bg-white/8" />
          </div>
        </div>

        <div className="flex items-center gap-2.5 rounded-lg border border-white/10 bg-white/[0.03] p-2.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/5">
            <Package className="h-5 w-5 text-white/38" strokeWidth={1.5} />
          </div>
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="h-2.5 max-w-[12rem] rounded bg-white/16" />
            <div className="h-2 w-[66%] max-w-[9rem] rounded bg-white/10" />
          </div>
        </div>

        <div className="flex gap-2 border-t border-white/10 pt-3">
          <div className="flex flex-1 items-center justify-center rounded-md bg-amber-600/78 py-2.5 shadow-sm">
            <Cog className="h-4 w-4 text-white/95" strokeWidth={1.75} />
          </div>
          <div className="flex flex-1 items-center justify-center rounded-md bg-emerald-600/78 py-2.5 shadow-sm">
            <CheckCircle className="h-4 w-4 text-white/95" strokeWidth={1.75} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function AuthMarketingPanel() {
  const [mouse, setMouse] = useState<MouseClient | null>(null);

  return (
    <div className="relative flex h-full min-h-[320px] flex-1 overflow-hidden border-l border-white/5 bg-slate-950 lg:min-h-0">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-indigo-950/95 via-slate-950 to-violet-950/90" aria-hidden />
      <GlassOrb className="left-[-20%] top-[-10%] h-[min(55vw,420px)] w-[min(55vw,420px)] animate-auth-mesh-drift bg-indigo-400/50 motion-reduce:animate-none" />
      <GlassOrb className="bottom-[-15%] right-[-15%] h-[min(50vw,380px)] w-[min(50vw,380px)] animate-auth-mesh-drift-slow bg-violet-400/45 motion-reduce:animate-none" />
      <GlassOrb className="left-[30%] top-[40%] h-[min(35vw,260px)] w-[min(35vw,260px)] animate-auth-mesh-drift bg-fuchsia-400/38 motion-reduce:animate-none [animation-delay:4s]" />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_95%_65%_at_50%_42%,transparent_18%,transparent_52%,rgba(2,6,23,0.52)_92%,rgba(2,6,23,0.78)_100%)]"
        aria-hidden
      />

      <div
        className="relative flex min-h-0 flex-1 cursor-default items-center justify-center px-8 py-16 lg:px-10"
        onMouseMove={(e) => setMouse({ x: e.clientX, y: e.clientY })}
        onMouseLeave={() => setMouse(null)}
      >
        {/* Icon chips — intentionally uneven / non-symmetric placement */}
        <ProximityIconChip
          mouse={mouse}
          className="left-[7%] top-[9%] h-12 w-12 sm:left-[5%]"
          floatClass="animate-auth-float motion-reduce:animate-none"
          delayClass="[animation-delay:0.2s]"
          chipClass="h-12 w-12 rounded-2xl border-white/15 bg-white/10 text-white/90 shadow-lg"
        >
          <ClipboardList className="h-5 w-5" strokeWidth={1.5} />
        </ProximityIconChip>
        <ProximityIconChip
          mouse={mouse}
          className="left-[63%] top-[6%] h-11 w-11 sm:left-[58%]"
          floatClass="animate-auth-float-reverse motion-reduce:animate-none"
          delayClass="[animation-delay:0.5s]"
          chipClass="h-11 w-11 rounded-xl border-white/10 bg-white/5 text-fuchsia-200/90 shadow-md"
        >
          <Palette className="h-5 w-5" strokeWidth={1.5} />
        </ProximityIconChip>
        <ProximityIconChip
          mouse={mouse}
          className="right-[4%] top-[21%] h-11 w-11 sm:right-[7%]"
          floatClass="animate-auth-float-reverse motion-reduce:animate-none"
          delayClass="[animation-delay:0.8s]"
          chipClass="h-11 w-11 rounded-xl border-white/10 bg-white/5 text-violet-200/90 shadow-md"
        >
          <Package className="h-5 w-5" strokeWidth={1.5} />
        </ProximityIconChip>
        <ProximityIconChip
          mouse={mouse}
          className="left-[3%] top-[36%] h-10 w-10 sm:top-[33%]"
          floatClass="animate-auth-float motion-reduce:animate-none"
          delayClass="[animation-delay:1s]"
          chipClass="h-10 w-10 rounded-xl border-white/10 bg-white/5 text-indigo-200/90 shadow-md"
        >
          <Users className="h-4 w-4" strokeWidth={1.5} />
        </ProximityIconChip>
        <ProximityIconChip
          mouse={mouse}
          className="right-[3%] top-[49%] h-11 w-11 sm:right-[11%]"
          floatClass="animate-auth-float-reverse motion-reduce:animate-none"
          delayClass="[animation-delay:0.35s]"
          chipClass="h-11 w-11 rounded-xl border-white/10 bg-white/5 text-violet-200/90 shadow-md"
        >
          <ShoppingCart className="h-5 w-5" strokeWidth={1.5} />
        </ProximityIconChip>
        <ProximityIconChip
          mouse={mouse}
          className="left-[22%] top-[68%] h-11 w-11 sm:left-[17%]"
          floatClass="animate-auth-float motion-reduce:animate-none"
          delayClass="[animation-delay:1.2s]"
          chipClass="h-11 w-11 rounded-xl border-white/10 bg-white/5 text-indigo-200/90 shadow-md"
        >
          <Factory className="h-5 w-5" strokeWidth={1.5} />
        </ProximityIconChip>
        <ProximityIconChip
          mouse={mouse}
          className="right-[16%] top-[59%] h-10 w-10 sm:right-[9%]"
          floatClass="animate-auth-float-reverse motion-reduce:animate-none"
          delayClass="[animation-delay:0.4s]"
          chipClass="h-10 w-10 rounded-xl border-white/10 bg-white/5 text-violet-200/90 shadow-md"
        >
          <Truck className="h-4 w-4" strokeWidth={1.5} />
        </ProximityIconChip>
        <ProximityIconChip
          mouse={mouse}
          className="left-[71%] top-[52%] h-11 w-11 sm:left-[66%]"
          floatClass="animate-auth-float motion-reduce:animate-none"
          delayClass="[animation-delay:0.65s]"
          chipClass="h-11 w-11 rounded-xl border-white/10 bg-white/5 text-emerald-200/90 shadow-md"
        >
          <Banknote className="h-5 w-5" strokeWidth={1.5} />
        </ProximityIconChip>
        <ProximityIconChip
          mouse={mouse}
          className="bottom-[5%] left-[11%] h-10 w-10 sm:bottom-[7%] sm:left-[14%]"
          floatClass="animate-auth-float-reverse motion-reduce:animate-none"
          delayClass="[animation-delay:0.15s]"
          chipClass="h-10 w-10 rounded-xl border-white/15 bg-white/10 text-sky-200/95 shadow-md"
        >
          <FileText className="h-4 w-4" strokeWidth={1.5} />
        </ProximityIconChip>
        <ProximityIconChip
          mouse={mouse}
          className="bottom-[13%] right-[6%] h-11 w-11 sm:bottom-[11%] sm:right-[4%]"
          floatClass="animate-auth-float motion-reduce:animate-none"
          delayClass="[animation-delay:0.55s]"
          chipClass="h-11 w-11 rounded-xl border-white/15 bg-white/10 text-violet-200/95 shadow-md"
        >
          <Settings className="h-5 w-5" strokeWidth={1.5} />
        </ProximityIconChip>
        <ProximityIconChip
          mouse={mouse}
          className="bottom-[22%] left-[6%] h-10 w-10 sm:bottom-[26%] sm:left-[9%]"
          floatClass="animate-auth-float motion-reduce:animate-none"
          delayClass="[animation-delay:0.9s]"
          chipClass="h-10 w-10 rounded-xl border-white/10 bg-white/5 text-amber-200/90 shadow-md"
        >
          <Boxes className="h-4 w-4" strokeWidth={1.5} />
        </ProximityIconChip>
        <ProximityIconChip
          mouse={mouse}
          className="bottom-[8%] right-[28%] h-10 w-10 sm:bottom-[4%] sm:right-[31%]"
          floatClass="animate-auth-float-reverse motion-reduce:animate-none"
          delayClass="[animation-delay:0.25s]"
          chipClass="h-10 w-10 rounded-xl border-white/10 bg-white/5 text-indigo-200/90 shadow-md"
        >
          <BarChart3 className="h-4 w-4" strokeWidth={1.5} />
        </ProximityIconChip>

        <div
          className="pointer-events-none relative z-10 w-full max-w-[300px] pb-2 pt-16 motion-reduce:animate-none animate-in fade-in zoom-in-95 duration-1000"
          aria-hidden
        >
          <div className="absolute inset-x-7 top-2 z-0 origin-bottom -rotate-2 scale-[0.88] opacity-48">
            <DecorativeOrderCard
              preset="production"
              breatheClass="motion-reduce:animate-none animate-auth-card-breathe [animation-delay:1.4s]"
            />
          </div>
          <div className="absolute inset-x-4 top-8 z-[1] origin-bottom rotate-[1.5deg] scale-[0.93] opacity-62">
            <DecorativeOrderCard
              preset="design"
              breatheClass="motion-reduce:animate-none animate-auth-card-breathe [animation-delay:0.7s]"
            />
          </div>
          <div className="relative z-10">
            <DecorativeOrderCard
              preset="hybrid"
              breatheClass="motion-reduce:animate-none animate-auth-card-breathe"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
