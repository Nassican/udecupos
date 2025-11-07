"use client";
import { useState, useEffect } from "react";
import React from "react";
import {
  Users,
  CalendarDays,
  Clock,
  MapPin,
  User as UserIcon,
  Minus,
  Plus,
  Palette,
  Type as TypeIcon,
  X as XIcon,
} from "lucide-react";
import { Popover, PopoverContent, PopoverAnchor } from "@/components/ui/popover";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

export type TimetableEntry = {
  id: string;
  day: string; // Lunes..Domingo
  startMin: number; // minutes from 00:00
  endMin: number; // minutes from 00:00
  title: string;
  subtitle?: string;
  color?: string; // CSS color string
  teacher?: string;
  cupos?: string;
  location?: string;
};

type Overrides = Record<
  string,
  Partial<{
    showDay: boolean;
    showHours: boolean;
    showTeacher: boolean;
    showCupos: boolean;
    showLugar: boolean;
    fontScale: number;
    bgColor: string;
    textColor: string;
  }>
>;

const DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const DAY_INDEX: Record<string, number> = {
  Lunes: 0,
  Martes: 1,
  Miércoles: 2,
  Miercoles: 2,
  Jueves: 3,
  Viernes: 4,
  Sábado: 5,
  Sabado: 5,
  Domingo: 6,
};

function minutesToLabel(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const ampm = h >= 12 ? "PM" : "AM";
  const hh = h % 12 || 12;
  return `${hh}:${m.toString().padStart(2, "0")} ${ampm}`;
}

export default function Timetable({
  entries,
  startHour = 7,
  endHour = 22,
  options,
}: {
  entries: TimetableEntry[];
  startHour?: number;
  endHour?: number;
  options?: {
    showDay?: boolean;
    showHours?: boolean;
    showTeacher?: boolean;
    showCupos?: boolean;
    showLugar?: boolean;
    fontScale?: number;
    monochrome?: boolean;
    pastel?: boolean;
  };
}) {
  const HOUR_PX = 32; // pixels per hour
  const baseFont = Math.max(0.75, Math.min(1.75, options?.fontScale ?? 1));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Overrides>(() => {
    try {
      const raw = typeof window !== "undefined" && localStorage.getItem("tt_overrides_v1");
      if (raw) {
        const parsed = JSON.parse(raw) as Overrides;
        if (parsed && typeof parsed === "object") return parsed;
      }
    } catch {}
    return {};
  });
  const [selectedMeta, setSelectedMeta] = useState<null | {
    dayIdx: number;
    topPx: number;
    leftPct: number;
    widthPct: number;
    id: string;
  }>(null);
  const [isSmall, setIsSmall] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 640px)");
    const handler = () => setIsSmall(mq.matches);
    handler();
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  // Persistencia de overrides en localStorage
  useEffect(() => {
    try {
      localStorage.setItem("tt_overrides_v1", JSON.stringify(overrides));
    } catch {}
  }, [overrides]);
  // Cerrar con tecla Escape
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedId(null);
        setSelectedMeta(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const hardStartMin = startHour * 60;
  const hardEndMin = endHour * 60;
  // Ventana visible fija: de startHour a endHour (no se encoge por contenido)
  const visStartMin = hardStartMin;
  const visEndMin = hardEndMin;
  const totalMin = visEndMin - visStartMin;
  const hoursCount = (visEndMin - visStartMin) / 60;

  // Agrupar por día
  const byDay: Record<number, TimetableEntry[]> = {};
  for (const e of entries) {
    const idx = DAY_INDEX[e.day] ?? -1;
    if (idx < 0) continue;
    if (!byDay[idx]) byDay[idx] = [];
    // Clamp
    const s = Math.max(e.startMin, visStartMin);
    const t = Math.min(e.endMin, visEndMin);
    if (t <= s) continue;
    byDay[idx].push({ ...e, startMin: s, endMin: t });
  }

  // Para cada día, asignar "lanes" usando sweep-line, afectando solo a bloques concurrentes
  const layoutByDay: Record<
    number,
    Array<TimetableEntry & { lane: number; lanes: number }>
  > = {};
  for (const d of Object.keys(byDay)) {
    const dayIdx = parseInt(d, 10);
    const list = (byDay[dayIdx] || [])
      .slice()
      .sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
    const placed: Array<TimetableEntry & { lane: number; lanes: number }> = [];
    const active: Array<{
      ref: TimetableEntry & { lane: number; lanes: number };
    }> = [];

    for (const ev of list) {
      // Retirar eventos que ya terminaron
      for (let i = active.length - 1; i >= 0; i--) {
        if (active[i].ref.endMin <= ev.startMin) active.splice(i, 1);
      }
      // Buscar menor lane libre
      const used = new Set(active.map((a) => a.ref.lane));
      let lane = 0;
      while (used.has(lane)) lane++;
      const p = { ...ev, lane, lanes: Math.max(1, active.length + 1) };
      placed.push(p);
      active.push({ ref: p });
      // Actualizar lanes de todos los activos al máximo actual
      const concurrent = active.length;
      for (const a of active) a.ref.lanes = Math.max(a.ref.lanes, concurrent);
    }
    layoutByDay[dayIdx] = placed;
  }

  return (
    <div
      className="timetable w-full rounded-md border overflow-visible"
      onClick={() => {
        setSelectedId(null);
        setSelectedMeta(null);
      }}
    >
      {/* Header days */}
      <div
        className="grid sticky top-0 z-20"
        style={{
          gridTemplateColumns: `80px repeat(${DAYS.length}, minmax(0, 1fr))`,
        }}
      >
        <div className="bg-muted/80 backdrop-blur px-2 h-8 flex items-center text-xs font-medium sticky left-0 z-30">
          Hora
        </div>
        {DAYS.map((d) => (
          <div
            key={d}
            className="bg-muted/80 backdrop-blur px-2 h-8 flex items-center justify-center text-xs font-medium text-center truncate"
          >
            {d}
          </div>
        ))}
      </div>
      <div
        className="relative grid"
        style={{
          gridTemplateColumns: `80px repeat(${DAYS.length}, minmax(0, 1fr))`,
          height: `${(totalMin / 60) * HOUR_PX}px`,
        }}
      >
        {/* Time labels (sticky left) */}
        <div className="border-r sticky left-0 z-10 bg-background">
          <div>
            {Array.from({ length: hoursCount + 1 }).map((_, i) => (
              <div
                key={i}
                className="border-b text-[10px] text-muted-foreground"
                style={{ height: `${HOUR_PX}px` }}
              >
                <div className="translate-y-1 px-1">
                  {minutesToLabel(visStartMin + i * 60)}
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* Day columns */}
        {DAYS.map((d, idx) => (
          <div key={d} className="relative border-l">
            {/* Hour lines */}
            {Array.from({ length: hoursCount + 1 }).map((_, i) => (
              <div
                key={i}
                className="border-b"
                style={{ height: `${HOUR_PX}px` }}
              />
            ))}
            {/* Events */}
            {(layoutByDay[idx] || []).map((ev) => {
              const o = {
                ...options,
                ...(overrides[ev.id] || {}),
              } as NonNullable<typeof options>;
              const topPx = ((ev.startMin - visStartMin) / 60) * HOUR_PX;
              const heightPx = ((ev.endMin - ev.startMin) / 60) * HOUR_PX;
              const laneWidth = 100 / Math.max(1, ev.lanes);
              const leftPct = ev.lane * laneWidth;
              // Color de fondo: pastel por defecto, o monocromático si se solicita
              const key = ev.id + (ev.title || "");
              let hash = 0;
              for (let i = 0; i < key.length; i++)
                hash = (hash * 31 + key.charCodeAt(i)) | 0;
              const hue = Math.abs(hash) % 360;
              const useMono = o?.monochrome === true;
              const usePastel = o?.pastel !== false; // default true
              const pastelBg = `hsl(${hue} 70% 88%)`;
              const pastelBorder = `hsl(${hue} 55% 70%)`;
              const monoL = 82 + (Math.abs(hash) % 10);
              const monoBg = `hsl(0 0% ${monoL}%)`;
              const monoBorder = `hsl(0 0% ${Math.max(55, monoL - 18)}%)`;
              const bg = useMono
                ? monoBg
                : usePastel
                ? pastelBg
                : ev.color || "#60a5fa";
              const border = useMono
                ? monoBorder
                : usePastel
                ? pastelBorder
                : "#1f2937";
              const modMatch = (ev.title || "").match(/^\[([TP])\]\s*(.*)$/);
              const mod = modMatch ? modMatch[1] : undefined;
              const titleRest = modMatch ? modMatch[2] : ev.title;
              const firstLine = [mod ? `[${mod}]` : undefined, titleRest]
                .filter(Boolean)
                .join(" ");
              const lines: string[] = [];
              if (o?.showCupos && ev.cupos) lines.push(`Cupos: ${ev.cupos}`);
              if (o?.showDay) lines.push(`${DAYS[idx]}`);
              if (o?.showHours !== false)
                lines.push(
                  `${minutesToLabel(ev.startMin)} - ${minutesToLabel(
                    ev.endMin
                  )}`
                );
              if (o?.showLugar && ev.location) lines.push(`${ev.location}`);
              if (o?.showTeacher && ev.teacher) lines.push(`${ev.teacher}`);
              const hasOverlap = ev.lanes > 1;
              const effFont = Math.max(
                0.6,
                Math.min(2, o?.fontScale ?? baseFont)
              );
              return (
                <div
                  key={ev.id}
                  className={`absolute shadow-sm p-1 whitespace-normal wrap-break-word w-full overflow-hidden box-border text-center flex items-center justify-center cursor-pointer ${
                    selectedId === ev.id ? "ring-2 ring-black/40" : ""
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    const on = selectedId === ev.id ? null : ev.id;
                    setSelectedId(on);
                    setSelectedMeta(
                      on
                        ? {
                            dayIdx: idx,
                            topPx,
                            leftPct,
                            widthPct: laneWidth,
                            id: ev.id,
                          }
                        : null
                    );
                  }}
                  style={{
                    top: `${topPx + 1}px`,
                    height: `${Math.max(12, heightPx - 2)}px`,
                    left: `${leftPct}%`,
                    width: `${laneWidth}%`,
                    backgroundColor:
                      (overrides[ev.id]?.bgColor as string) ?? bg,
                    color: (overrides[ev.id]?.textColor as string) ?? "#111827",
                    fontSize: `${11 * effFont}px`,
                    lineHeight: 1.15,
                    outline: `1px solid ${border}`,
                  }}
                >
                  <div className="flex flex-col items-center justify-center w-full">
                    <div className="font-semibold leading-tight">
                      {firstLine}
                    </div>
                    {lines.map((txt, i) => (
                      <div key={i} className="leading-tight">
                        {txt}
                      </div>
                    ))}
                  </div>
                  {hasOverlap ? (
                    <div className="absolute right-0 top-0 h-full w-[3px] bg-red-500/70" />
                  ) : null}
                </div>
              );
            })}
            {selectedMeta && selectedMeta.dayIdx === idx ? (
              (() => {
                const id = selectedMeta.id;
                const ev = (layoutByDay[idx] || []).find((e) => e.id === id);
                if (!ev) return null;
                const o = (overrides[id] || {}) as NonNullable<Overrides[string]>;
                const containerPx = (totalMin / 60) * HOUR_PX;
                const heightPx = ((ev.endMin - ev.startMin) / 60) * HOUR_PX;
                const EST = isSmall ? 260 : 220;
                const belowTop = selectedMeta.topPx + heightPx + 8;
                const placeBelow = belowTop + EST <= containerPx;
                const topPxPanel = placeBelow
                  ? belowTop
                  : Math.max(0, selectedMeta.topPx - EST - 8);
                const placeLeft = !isSmall && (selectedMeta.leftPct + selectedMeta.widthPct > 70);
                const panelStyle: React.CSSProperties = {
                  position: "absolute",
                  top: `${topPxPanel}px`,
                  ...(isSmall ? { left: 4, right: 4 } : placeLeft ? { right: 4 } : { left: 4 }),
                  zIndex: 40,
                  width: isSmall ? undefined : 260,
                  maxWidth: isSmall ? undefined : 320,
                  maxHeight: isSmall ? 320 : 260,
                  overflowY: "auto",
                };
                const apply = (patch: Partial<NonNullable<typeof o>>) =>
                  setOverrides((prev) => ({
                    ...prev,
                    [id]: { ...(prev[id] || {}), ...patch },
                  }));
                const font = Math.max(0.6, Math.min(2, o.fontScale ?? baseFont));
                return (
                  <>
                    {isSmall ? (
                      <div
                        className="absolute inset-0 z-30"
                        onClick={() => { setSelectedId(null); setSelectedMeta(null); }}
                      />
                    ) : null}
                    <div
                      className={`rounded-md border bg-white shadow p-2 space-y-2 ${isSmall ? "text-[13px]" : "text-xs"}`}
                      style={panelStyle}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-medium truncate">{ev.title || ev.id}</div>
                        <div className="flex items-center gap-1">
                          <button
                            className="px-2 py-1 rounded border hover:bg-black/5"
                            onClick={() => setOverrides((prev) => {
                              const next = { ...prev } as typeof prev;
                              delete next[id];
                              return next;
                            })}
                          >
                            Restablecer
                          </button>
                          <button
                            aria-label="Cerrar"
                            className="p-2 rounded hover:bg-black/5"
                            onClick={() => { setSelectedId(null); setSelectedMeta(null); }}
                          >
                            <XIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {DAYS[idx]} · {minutesToLabel(ev.startMin)} - {minutesToLabel(ev.endMin)}
                      </div>
                      <Separator />
                      <div className="grid grid-cols-2 gap-2">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={o.showDay ?? false}
                            onChange={(e) => apply({ showDay: e.currentTarget.checked })}
                          />
                          <span>Día</span>
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={o.showHours ?? true}
                            onChange={(e) => apply({ showHours: e.currentTarget.checked })}
                          />
                          <span>Horas</span>
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={o.showTeacher ?? false}
                            onChange={(e) => apply({ showTeacher: e.currentTarget.checked })}
                          />
                          <span>Docente</span>
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={o.showCupos ?? false}
                            onChange={(e) => apply({ showCupos: e.currentTarget.checked })}
                          />
                          <span>Cupos</span>
                        </label>
                        <label className="flex items-center gap-2 col-span-2">
                          <input
                            type="checkbox"
                            checked={o.showLugar ?? false}
                            onChange={(e) => apply({ showLugar: e.currentTarget.checked })}
                          />
                          <span>Lugar</span>
                        </label>
                      </div>
                      <Separator />
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <TypeIcon className="h-4 w-4" />
                          <button
                            className="p-2 rounded hover:bg-black/5"
                            onClick={() => apply({ fontScale: Math.max(0.6, (o.fontScale ?? baseFont) - 0.1) })}
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <div className="w-10 text-center">{font.toFixed(1)}x</div>
                          <button
                            className="p-2 rounded hover:bg-black/5"
                            onClick={() => apply({ fontScale: Math.min(2, (o.fontScale ?? baseFont) + 0.1) })}
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <Palette className="h-4 w-4" />
                          <input
                            type="color"
                            value={(o.bgColor as string) ?? "#ffffff"}
                            onChange={(e) => apply({ bgColor: e.currentTarget.value })}
                            style={isSmall ? { width: 36, height: 36 } : undefined}
                          />
                          <span>Fondo</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={(o.textColor as string) ?? "#111827"}
                            onChange={(e) => apply({ textColor: e.currentTarget.value })}
                            style={isSmall ? { width: 36, height: 36 } : undefined}
                          />
                          <span>Texto</span>
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()
            ) : null}
        </div>
      ))}
    </div>
  </div>
);
}
