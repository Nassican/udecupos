"use client";
import { useState, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
import React from "react";
import {
  Minus,
  Plus,
  Palette,
  Type as TypeIcon,
  X as XIcon,
  Download,
} from "lucide-react";
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
  materiaKey?: string;
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
const DAY_INITIALS = ["L", "M", "M", "J", "V", "S"]; // Iniciales para móvil
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
      const raw =
        typeof window !== "undefined" &&
        localStorage.getItem("tt_overrides_v1");
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
  const [activeDayIdx, setActiveDayIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
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

  // Las pestañas en móvil se controlan de forma manual por el usuario

  const handleExport = (format: "png" | "jpeg" = "png") => {
    const dpi = 2;
    const headerH = 32;
    const hourColW = 80;
    const hourHeight = HOUR_PX;
    // Exportar SIEMPRE todos los días, incluso en móvil
    const showDays = DAYS.map((_, i) => i);
    const daysCount = showDays.length;
    let targetWidth = 0;
    if (containerRef.current) {
      const w = containerRef.current.clientWidth || 0;
      targetWidth = Math.max(w, hourColW + daysCount * 140);
    } else {
      targetWidth = hourColW + daysCount * 160;
    }
    const gridW = Math.max(100, targetWidth - hourColW);
    const colW = Math.floor(gridW / daysCount);
    const width = hourColW + colW * daysCount;
    const height = headerH + (totalMin / 60) * hourHeight;

    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(width * dpi);
    canvas.height = Math.floor(height * dpi);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpi, dpi);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    // Header background
    ctx.fillStyle = "rgba(0,0,0,0.04)";
    ctx.fillRect(0, 0, width, headerH);
    ctx.strokeStyle = "#e5e7eb";
    ctx.beginPath();
    ctx.moveTo(0, headerH + 0.5);
    ctx.lineTo(width, headerH + 0.5);
    ctx.stroke();

    // Fonts
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#111827";
    ctx.font =
      "bold 12px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    ctx.fillText("Hora", 8, headerH / 2);

    // Header day labels
    ctx.font =
      "600 12px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    showDays.forEach((di, i) => {
      const x = hourColW + i * colW;
      const label = DAYS[di];
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = "#111827";
      ctx.fillText(label, x + colW / 2 - tw / 2, headerH / 2);
      ctx.strokeStyle = "#e5e7eb";
      ctx.beginPath();
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, height);
      ctx.stroke();
    });

    // Time labels and grid lines
    ctx.font = "10px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    for (let i = 0; i < hoursCount; i++) {
      const y0 = headerH + i * hourHeight;
      ctx.strokeStyle = "#e5e7eb";
      ctx.beginPath();
      ctx.moveTo(0, y0 + 0.5);
      ctx.lineTo(width, y0 + 0.5);
      ctx.stroke();
      const label = minutesToLabel(visStartMin + i * 60);
      ctx.fillStyle = "#6b7280";
      ctx.fillText(label, 8, y0 + 10);
    }
    // Right border line
    ctx.strokeStyle = "#e5e7eb";
    ctx.beginPath();
    ctx.moveTo(hourColW + colW * daysCount + 0.5, 0);
    ctx.lineTo(hourColW + colW * daysCount + 0.5, height);
    ctx.stroke();

    // Draw events
    const drawTextLines = (
      x: number,
      y: number,
      w: number,
      h: number,
      lines: string[],
      fontSize = 11
    ) => {
      const pad = 4;
      const maxWidth = Math.max(0, w - pad * 2);
      let wrapped: Array<{ text: string; bold: boolean; size: number }> = [];
      const wrap = (
        text: string,
        font: string,
        size: number,
        bold: boolean
      ) => {
        ctx.font = `${
          bold ? "bold " : ""
        }${size}px system-ui, -apple-system, Segoe UI, Roboto, sans-serif`;
        const words = (text || "").split(/\s+/);
        let line = "";
        for (let i = 0; i < words.length; i++) {
          const test = line ? `${line} ${words[i]}` : words[i];
          if (ctx.measureText(test).width <= maxWidth) {
            line = test;
          } else {
            if (line) wrapped.push({ text: line, bold, size });
            line = words[i];
          }
        }
        if (line) wrapped.push({ text: line, bold, size });
      };

      // First line bold
      const first = lines[0] || "";
      wrap(first, "system", fontSize, true);
      // Others normal and slightly smaller
      for (let i = 1; i < lines.length; i++)
        wrap(lines[i], "system", fontSize - 1, false);

      // If contents exceed available height, try shrinking, then truncate with ellipsis
      const computeHeight = (arr: typeof wrapped) =>
        arr.reduce((acc, ln) => acc + ln.size + 2, 0);
      let totalH = computeHeight(wrapped);
      let fs = fontSize;
      while (totalH > h - pad * 2 && fs > 9) {
        fs -= 1;
        wrapped = [];
        wrap(first, "system", fs, true);
        for (let i = 1; i < lines.length; i++)
          wrap(lines[i], "system", fs - 1, false);
        totalH = computeHeight(wrapped);
      }
      if (totalH > h - pad * 2) {
        // Truncate last lines to fit
        const out: typeof wrapped = [];
        let used = 0;
        for (let i = 0; i < wrapped.length; i++) {
          const ln = wrapped[i];
          if (used + ln.size + 2 <= h - pad * 2) {
            out.push(ln);
            used += ln.size + 2;
          } else {
            // Add ellipsis to last available line if there is space
            if (out.length > 0) {
              const last = out[out.length - 1];
              ctx.font = `${last.bold ? "bold " : ""}${
                last.size
              }px system-ui, -apple-system, Segoe UI, Roboto, sans-serif`;
              let txt = last.text;
              while (
                ctx.measureText(txt + "…").width > maxWidth &&
                txt.length > 0
              ) {
                txt = txt.slice(0, -1);
              }
              out[out.length - 1] = { ...last, text: txt + "…" };
            }
            break;
          }
        }
        wrapped = out;
      }

      // Draw centered
      ctx.textBaseline = "top";
      ctx.textAlign = "center";
      ctx.fillStyle = "#111827";
      let offsetY = 0;
      const cx = x + w / 2;
      for (const ln of wrapped) {
        ctx.font = `${ln.bold ? "bold " : ""}${
          ln.size
        }px system-ui, -apple-system, Segoe UI, Roboto, sans-serif`;
        ctx.fillText(ln.text, cx, y + pad + offsetY);
        offsetY += ln.size + 2;
      }
      // Restore alignment
      ctx.textAlign = "start";
    };

    showDays.forEach((di, i) => {
      const colX = hourColW + i * colW;
      const list = layoutByDay[di] || [];
      list.forEach((ev) => {
        const o = {
          ...options,
          ...(overrides[ev.id] || {}),
        } as NonNullable<typeof options>;
        const topPx = headerH + ((ev.startMin - visStartMin) / 60) * hourHeight;
        const heightPx = ((ev.endMin - ev.startMin) / 60) * hourHeight;
        const laneWidth = colW / Math.max(1, ev.lanes);
        const leftX = colX + ev.lane * laneWidth;

        const key = ev.materiaKey || ev.id + (ev.title || "");
        let hash = 0;
        for (let i = 0; i < key.length; i++)
          hash = (hash * 31 + key.charCodeAt(i)) | 0;
        const hue = Math.abs(hash) % 360;
        const useMono = o?.monochrome === true;
        const usePastel = o?.pastel !== false;
        const pastelBg = `hsl(${hue} 70% 88%)`;
        const monoL = 82 + (Math.abs(hash) % 10);
        const monoBg = `hsl(0 0% ${monoL}%)`;
        const bg = useMono
          ? monoBg
          : usePastel
          ? pastelBg
          : (overrides[ev.id]?.bgColor as string) || ev.color || "#60a5fa";
        const border = useMono
          ? `hsl(0 0% ${Math.max(55, monoL - 18)}%)`
          : usePastel
          ? `hsl(${hue} 55% 70%)`
          : "#1f2937";

        ctx.fillStyle = bg as string;
        ctx.strokeStyle = border as string;
        const h = Math.max(12, heightPx - 2);
        ctx.fillRect(leftX + 1, topPx + 1, laneWidth - 2, h);
        ctx.strokeRect(leftX + 1, topPx + 1, laneWidth - 2, h);

        const modMatch = (ev.title || "").match(/^\[([TP])\]\s*(.*)$/);
        const mod = modMatch ? modMatch[1] : undefined;
        const titleRest = modMatch ? modMatch[2] : ev.title;
        const firstLine = [mod ? `[${mod}]` : undefined, titleRest]
          .filter(Boolean)
          .join(" ");
        const lines: string[] = [firstLine];
        if (o?.showCupos && ev.cupos) lines.push(`Cupos: ${ev.cupos}`);
        if (o?.showDay) lines.push(`${DAYS[di]}`);
        if (o?.showHours !== false)
          lines.push(
            `${minutesToLabel(ev.startMin)} - ${minutesToLabel(ev.endMin)}`
          );
        if (o?.showLugar && ev.location) lines.push(`${ev.location}`);
        if (o?.showTeacher && ev.teacher) lines.push(`${ev.teacher}`);
        drawTextLines(
          leftX + 1,
          topPx + 1,
          laneWidth - 2,
          h,
          lines,
          11 * Math.max(0.6, Math.min(2, o?.fontScale ?? baseFont))
        );
      });
    });

    const dataUrl = canvas.toDataURL(`image/${format}`);
    const a = document.createElement("a");
    a.download = `horario-semana.${format}`;
    a.href = dataUrl;
    a.click();
  };

  const handleExportXLSX = () => {
    const slotMin = 60;
    const totalSlots = Math.ceil((visEndMin - visStartMin) / slotMin);
    const rows = totalSlots + 1; // +1 header

    // Helpers
    const toA1 = (r: number, c: number) => {
      // r,c zero-based
      const colToLetters = (n: number) => {
        let s = "";
        n++;
        while (n) {
          const m = (n - 1) % 26;
          s = String.fromCharCode(65 + m) + s;
          n = Math.floor((n - 1) / 26);
        }
        return s;
      };
      return `${colToLetters(c)}${r + 1}`;
    };
    const hexFromHsl = (h: number, s: number, l: number) => {
      const ss = s / 100,
        ll = l / 100;
      const c = (1 - Math.abs(2 * ll - 1)) * ss;
      const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
      const m = ll - c / 2;
      let r = 0,
        g = 0,
        b = 0;
      const hh = Math.floor(h / 60) % 6;
      if (hh === 0) {
        r = c;
        g = x;
        b = 0;
      } else if (hh === 1) {
        r = x;
        g = c;
        b = 0;
      } else if (hh === 2) {
        r = 0;
        g = c;
        b = x;
      } else if (hh === 3) {
        r = 0;
        g = x;
        b = c;
      } else if (hh === 4) {
        r = x;
        g = 0;
        b = c;
      } else {
        r = c;
        g = 0;
        b = x;
      }
      const toHex = (v: number) =>
        Math.round((v + m) * 255)
          .toString(16)
          .padStart(2, "0");
      return `${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
    };

    // Calculate lanes per day to allocate subcolumns
    const laneCapByDay = DAYS.map((_, di) => {
      const list = layoutByDay[di] || [];
      let max = 1;
      for (const e of list) max = Math.max(max, e.lanes || 1);
      return max;
    });
    const dayColStart: number[] = [];
    let acc = 1; // column 0 is Hora
    for (let di = 0; di < DAYS.length; di++) {
      dayColStart[di] = acc;
      acc += laneCapByDay[di];
    }
    const totalDayCols = acc - 1;
    const cols = 1 + totalDayCols; // +1 Hora

    const wb = XLSX.utils.book_new();
    const ws: XLSX.WorkSheet = {};
    const wsMap = ws as unknown as Record<string, unknown>;
    const merges: XLSX.Range[] = [];

    // Initialize grid with empty cells
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const a1 = toA1(r, c);
        wsMap[a1] = { v: "", t: "s" } as unknown;
      }
    }

    // Header (row 0): "Hora" and days merged across their lane subcolumns
    wsMap[toA1(0, 0)] = {
      v: "Hora",
      t: "s",
      s: {
        font: { bold: true },
        fill: { patternType: "solid", fgColor: { rgb: "F3F4F6" } },
        alignment: { horizontal: "center", vertical: "center", wrapText: true },
      },
    } as unknown;
    for (let di = 0; di < DAYS.length; di++) {
      const startC = dayColStart[di];
      const width = laneCapByDay[di];
      // Style each header cell in the group and set value on the first
      for (let c = 0; c < width; c++) {
        wsMap[toA1(0, startC + c)] = {
          v: c === 0 ? DAYS[di] : "",
          t: "s",
          s: {
            font: { bold: true },
            fill: { patternType: "solid", fgColor: { rgb: "F3F4F6" } },
            alignment: { horizontal: "center", vertical: "center", wrapText: true },
          },
        } as unknown;
      }
      if (width > 1) {
        merges.push({ s: { r: 0, c: startC }, e: { r: 0, c: startC + width - 1 } });
      }
    }
    // Reinforce centering and wrapping across the entire header row (including merged regions)
    type CellAlignment = { horizontal?: string; vertical?: string; wrapText?: boolean };
    type CellStyle = { alignment?: CellAlignment };
    type StyleCell = XLSX.CellObject & { s?: CellStyle };
    for (let c = 0; c < cols; c++) {
      const a1 = toA1(0, c);
      const existing = wsMap[a1] as StyleCell | undefined;
      const cell: StyleCell = existing || ({} as StyleCell);
      const s: CellStyle = cell.s || {};
      s.alignment = s.alignment || {};
      s.alignment.horizontal = "center";
      s.alignment.vertical = "center";
      s.alignment.wrapText = true;
      cell.s = s;
      if (typeof (cell as XLSX.CellObject).v === "undefined") (cell as XLSX.CellObject).v = "";
      wsMap[a1] = cell as unknown as Record<string, unknown>;
    }

    // Hour labels and empty cell borders
    for (let s = 0; s < totalSlots; s++) {
      const r = 1 + s;
      const min = visStartMin + s * slotMin;
      const showHour = min % 60 === 0;
      const label = showHour ? minutesToLabel(min) : "";
      wsMap[toA1(r, 0)] = {
        v: label,
        t: "s",
        s: {
          font: { color: { rgb: "6B7280" } },
          alignment: { horizontal: "center", vertical: "center", wrapText: true },
        },
      } as unknown;
      for (let c = 1; c < cols; c++) {
        const a1 = toA1(r, c);
        wsMap[a1] = {
          v: "",
          t: "s",
          s: {
            border: {
              top: { style: "thin", color: { rgb: "E5E7EB" } },
              left: { style: "thin", color: { rgb: "E5E7EB" } },
              right: { style: "thin", color: { rgb: "E5E7EB" } },
              bottom: { style: "thin", color: { rgb: "E5E7EB" } },
            },
            alignment: { horizontal: "center", vertical: "center", wrapText: true },
          },
        } as unknown;
      }
    }

    // Place events with merges and styles using lane subcolumns
    for (let di = 0; di < DAYS.length; di++) {
      const list = (layoutByDay[di] || [])
        .slice()
        .sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
      for (const ev of list) {
        const startSlot = Math.max(
          0,
          Math.floor((ev.startMin - visStartMin) / slotMin)
        );
        const endSlot = Math.min(
          totalSlots,
          Math.ceil((ev.endMin - visStartMin) / slotMin)
        );
        const span = Math.max(1, endSlot - startSlot);
        const r0 = 1 + startSlot;
        const r1 = r0 + span - 1;
        const c0 = dayColStart[di] + (ev.lane || 0);
        merges.push({ s: { r: r0, c: c0 }, e: { r: r1, c: c0 } });

        // Compute colors similar to on-screen
        const key = ev.materiaKey || ev.id + (ev.title || "");
        let hash = 0;
        for (let j = 0; j < key.length; j++) hash = (hash * 31 + key.charCodeAt(j)) | 0;
        const hue = Math.abs(hash) % 360;
        const useMono = options?.monochrome === true;
        const usePastel = options?.pastel !== false;
        const monoL = 82 + (Math.abs(hash) % 10);
        const bgHex = useMono
          ? hexFromHsl(0, 0, monoL)
          : usePastel
          ? hexFromHsl(hue, 70, 88)
          : (ev.color || "60A5FA").replace("#", "").toUpperCase();
        const borderHex = useMono
          ? hexFromHsl(0, 0, Math.max(55, monoL - 18))
          : usePastel
          ? hexFromHsl(hue, 55, 70)
          : "1F2937";

        const modMatch = (ev.title || "").match(/^\[([TP])\]\s*(.*)$/);
        const mod = modMatch ? modMatch[1] : undefined;
        const titleRest = modMatch ? modMatch[2] : ev.title;
        const firstLine = [mod ? `[${mod}]` : undefined, titleRest]
          .filter(Boolean)
          .join(" ");
        const parts: string[] = [firstLine];
        if (options?.showCupos && ev.cupos) parts.push(`Cupos: ${ev.cupos}`);
        if (options?.showHours !== false)
          parts.push(
            `${minutesToLabel(ev.startMin)} - ${minutesToLabel(ev.endMin)}`
          );
        if (options?.showLugar && ev.location) parts.push(`${ev.location}`);
        if (options?.showTeacher && ev.teacher) parts.push(`${ev.teacher}`);

        const a1 = toA1(r0, c0);
        const style = {
          alignment: { horizontal: "center", vertical: "center", wrapText: true },
          font: { color: { rgb: "111827" }, bold: false },
          fill: { patternType: "solid", fgColor: { rgb: bgHex } },
          border: {
            top: { style: "thin", color: { rgb: borderHex } },
            left: { style: "thin", color: { rgb: borderHex } },
            right: { style: "thin", color: { rgb: borderHex } },
            bottom: { style: "thin", color: { rgb: borderHex } },
          },
        } as const;
        wsMap[a1] = { v: parts.join("\n"), t: "s", s: style } as unknown;
        // Apply same style to the rest of merged cells to enforce centering/wrap across apps
        for (let rr = r0 + 1; rr <= r1; rr++) {
          wsMap[toA1(rr, c0)] = { v: "", t: "s", s: style } as unknown;
        }
      }
    }

    wsMap["!merges"] = merges as unknown;
    wsMap["!cols"] = [
      { wpx: 100 },
      ...Array.from({ length: totalDayCols }, () => ({ wpx: 160 })),
    ] as unknown;
    wsMap["!rows"] = Array.from({ length: rows }, (_, i) =>
      i === 0 ? { hpx: 32 } : { hpx: 22 }
    ) as unknown;
    const ref = `${toA1(0, 0)}:${toA1(rows - 1, cols - 1)}`;
    wsMap["!ref"] = ref as unknown;

    XLSX.utils.book_append_sheet(wb, ws, "Horario");
    const out = XLSX.write(wb, { bookType: "xlsx", type: "array", cellStyles: true as unknown as boolean } as XLSX.WritingOptions);
    const blob = new Blob([out], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "horario.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      ref={containerRef}
      className="timetable w-full rounded-md border overflow-visible"
      onClick={() => {
        setSelectedId(null);
        setSelectedMeta(null);
      }}
    >
      <div className="flex items-center justify-between gap-2 p-2 sticky top-0 z-30 bg-background/80 backdrop-blur">
        <div className="text-sm font-medium">Horario</div>
        <div className="flex items-center gap-2">
          <button
            className="flex items-center gap-1 px-2 py-1 rounded border text-xs hover:bg-black/5"
            onClick={(e) => {
              e.stopPropagation();
              handleExport("png");
            }}
            aria-label="Exportar como imagen"
          >
            <Download className="h-4 w-4" />
            Exportar
          </button>
          <button
            className="flex items-center gap-1 px-2 py-1 rounded border text-xs hover:bg-black/5"
            onClick={(e) => {
              e.stopPropagation();
              handleExportXLSX();
            }}
            aria-label="Exportar a Excel"
          >
            <Download className="h-4 w-4" />
            Excel
          </button>
        </div>
      </div>
      <div
        className="grid sticky top-10 z-20"
        style={{
          gridTemplateColumns: isSmall
            ? `80px minmax(0, 1fr)`
            : `80px repeat(${DAYS.length}, minmax(0, 1fr))`,
        }}
      >
        <div className="bg-muted/80 backdrop-blur px-2 h-8 flex items-center text-xs font-medium sticky left-0 z-30">
          Hora
        </div>
        {isSmall
          ? [DAYS[activeDayIdx]].map((d) => (
              <div
                key={d}
                className="bg-muted/80 backdrop-blur px-2 h-8 flex items-center justify-center text-xs font-medium text-center truncate"
              >
                {d}
              </div>
            ))
          : DAYS.map((d) => (
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
          gridTemplateColumns: isSmall
            ? `80px minmax(0, 1fr)`
            : `80px repeat(${DAYS.length}, minmax(0, 1fr))`,
          height: `${(totalMin / 60) * HOUR_PX}px`,
        }}
      >
        {/* Time labels (sticky left) */}
        <div className="border-r sticky left-0 z-10 bg-background">
          <div>
            {Array.from({ length: hoursCount }).map((_, i) => (
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
        {(isSmall ? [activeDayIdx] : DAYS.map((_, i) => i)).map((idx) => (
          <div key={idx} className="relative border-l">
            {/* Hour lines */}
            {Array.from({ length: hoursCount }).map((_, i) => (
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
              const key = ev.materiaKey || ev.id + (ev.title || "");
              const matKey = `mk:${key}`;
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
                : (overrides[matKey]?.bgColor as string) ||
                  (overrides[ev.id]?.bgColor as string) ||
                  ev.color ||
                  "#60a5fa";
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
                      (overrides[matKey]?.bgColor as string) ??
                      (overrides[ev.id]?.bgColor as string) ??
                      bg,
                    color:
                      (overrides[matKey]?.textColor as string) ??
                      (overrides[ev.id]?.textColor as string) ??
                      "#111827",
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
            {selectedMeta && selectedMeta.dayIdx === idx
              ? (() => {
                  const id = selectedMeta.id;
                  const ev = (layoutByDay[idx] || []).find((e) => e.id === id);
                  if (!ev) return null;
                  const o = (overrides[id] || {}) as NonNullable<
                    Overrides[string]
                  >;
                  const base = (options || {}) as NonNullable<typeof options>;
                  const cur = (layoutByDay[idx] || []).find((e) => e.id === id);
                  const mk = `mk:${
                    cur?.materiaKey || cur?.id + (cur?.title || "")
                  }`;
                  const effShowDay = (o.showDay ??
                    base?.showDay ??
                    false) as boolean;
                  const effShowHours = (o.showHours ??
                    base?.showHours ??
                    true) as boolean;
                  const effShowTeacher = (o.showTeacher ??
                    base?.showTeacher ??
                    false) as boolean;
                  const effShowCupos = (o.showCupos ??
                    base?.showCupos ??
                    false) as boolean;
                  const effShowLugar = (o.showLugar ??
                    base?.showLugar ??
                    false) as boolean;
                  const containerPx = (totalMin / 60) * HOUR_PX;
                  const heightPx = ((ev.endMin - ev.startMin) / 60) * HOUR_PX;
                  const EST = isSmall ? 260 : 220;
                  const belowTop = selectedMeta.topPx + heightPx + 8;
                  const placeBelow = belowTop + EST <= containerPx;
                  const topPxPanel = placeBelow
                    ? belowTop
                    : Math.max(0, selectedMeta.topPx - EST - 8);
                  const placeLeft =
                    !isSmall &&
                    selectedMeta.leftPct + selectedMeta.widthPct > 70;
                  const panelStyle: React.CSSProperties = {
                    position: "absolute",
                    top: `${topPxPanel}px`,
                    ...(isSmall
                      ? { left: 4, right: 4 }
                      : placeLeft
                      ? { right: 4 }
                      : { left: 4 }),
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
                  const effFontScale = (o.fontScale ??
                    base?.fontScale ??
                    baseFont) as number;
                  const font = Math.max(0.6, Math.min(2, effFontScale));
                  // Compute effective colors to display in pickers (match the block rendering)
                  const keyForColor =
                    cur?.materiaKey || ev.id + (ev.title || "");
                  let hash = 0;
                  for (let i = 0; i < keyForColor.length; i++)
                    hash = (hash * 31 + keyForColor.charCodeAt(i)) | 0;
                  const hue = Math.abs(hash) % 360;
                  const useMono = base?.monochrome === true;
                  const usePastel = base?.pastel !== false; // default true
                  const monoL = 82 + (Math.abs(hash) % 10);
                  const hslToHex = (h: number, s: number, l: number) => {
                    const ss = s / 100;
                    const ll = l / 100;
                    const c = (1 - Math.abs(2 * ll - 1)) * ss;
                    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
                    const m = ll - c / 2;
                    let r = 0,
                      g = 0,
                      b = 0;
                    const hh = Math.floor(h / 60) % 6;
                    if (hh === 0) {
                      r = c;
                      g = x;
                      b = 0;
                    } else if (hh === 1) {
                      r = x;
                      g = c;
                      b = 0;
                    } else if (hh === 2) {
                      r = 0;
                      g = c;
                      b = x;
                    } else if (hh === 3) {
                      r = 0;
                      g = x;
                      b = c;
                    } else if (hh === 4) {
                      r = x;
                      g = 0;
                      b = c;
                    } else {
                      r = c;
                      g = 0;
                      b = x;
                    }
                    const toHex = (v: number) =>
                      Math.round((v + m) * 255)
                        .toString(16)
                        .padStart(2, "0");
                    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
                  };
                  const derivedHex = useMono
                    ? hslToHex(0, 0, monoL)
                    : usePastel
                    ? hslToHex(hue, 70, 88)
                    : ev.color || "#60a5fa";
                  const effBgColor =
                    (overrides[mk]?.bgColor as string) ??
                    (o.bgColor as string) ??
                    derivedHex;
                  const effTextColor =
                    (overrides[mk]?.textColor as string) ??
                    (o.textColor as string) ??
                    "#111827";
                  return (
                    <>
                      {isSmall ? (
                        <div
                          className="absolute inset-0 z-30"
                          onClick={() => {
                            setSelectedId(null);
                            setSelectedMeta(null);
                          }}
                        />
                      ) : null}
                      <div
                        className={`rounded-md border bg-white shadow p-2 space-y-2 ${
                          isSmall ? "text-[13px]" : "text-xs"
                        }`}
                        style={panelStyle}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-medium truncate">
                            {ev.title || ev.id}
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              className="px-2 py-1 rounded border hover:bg-black/5"
                              onClick={() =>
                                setOverrides((prev) => {
                                  const next = { ...prev } as typeof prev;
                                  delete next[id];
                                  return next;
                                })
                              }
                            >
                              Restablecer
                            </button>
                            <button
                              aria-label="Cerrar"
                              className="p-2 rounded hover:bg-black/5"
                              onClick={() => {
                                setSelectedId(null);
                                setSelectedMeta(null);
                              }}
                            >
                              <XIcon className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {DAYS[idx]} · {minutesToLabel(ev.startMin)} -{" "}
                          {minutesToLabel(ev.endMin)}
                        </div>
                        <Separator />
                        <div className="grid grid-cols-2 gap-2">
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={effShowDay}
                              onChange={(e) =>
                                apply({ showDay: e.currentTarget.checked })
                              }
                            />
                            <span>Día</span>
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={effShowHours}
                              onChange={(e) =>
                                apply({ showHours: e.currentTarget.checked })
                              }
                            />
                            <span>Horas</span>
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={effShowTeacher}
                              onChange={(e) =>
                                apply({ showTeacher: e.currentTarget.checked })
                              }
                            />
                            <span>Docente</span>
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={effShowCupos}
                              onChange={(e) =>
                                apply({ showCupos: e.currentTarget.checked })
                              }
                            />
                            <span>Cupos</span>
                          </label>
                          <label className="flex items-center gap-2 col-span-2">
                            <input
                              type="checkbox"
                              checked={effShowLugar}
                              onChange={(e) =>
                                apply({ showLugar: e.currentTarget.checked })
                              }
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
                              onClick={() =>
                                apply({
                                  fontScale: Math.max(0.6, effFontScale - 0.1),
                                })
                              }
                            >
                              <Minus className="h-4 w-4" />
                            </button>
                            <div className="w-10 text-center">
                              {font.toFixed(1)}x
                            </div>
                            <button
                              className="p-2 rounded hover:bg-black/5"
                              onClick={() =>
                                apply({
                                  fontScale: Math.min(2, effFontScale + 0.1),
                                })
                              }
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
                              value={effBgColor}
                              onChange={(e) => {
                                const val = (e.target as HTMLInputElement)
                                  .value;
                                setOverrides((prev) => ({
                                  ...prev,
                                  [mk]: { ...(prev[mk] || {}), bgColor: val },
                                }));
                              }}
                              style={
                                isSmall ? { width: 36, height: 36 } : undefined
                              }
                            />
                            <span>Fondo</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={effTextColor}
                              onChange={(e) => {
                                const val = (e.target as HTMLInputElement)
                                  .value;
                                setOverrides((prev) => ({
                                  ...prev,
                                  [mk]: { ...(prev[mk] || {}), textColor: val },
                                }));
                              }}
                              style={
                                isSmall ? { width: 36, height: 36 } : undefined
                              }
                            />
                            <span>Texto</span>
                          </div>
                        </div>
                      </div>
                    </>
                  );
                })()
              : null}
          </div>
        ))}
      </div>
      {isSmall ? (
        <div className="sticky bottom-0 z-30 bg-background/80 backdrop-blur border-t">
          <div className="grid grid-cols-6 gap-0">
            {DAY_INITIALS.map((label, i) => (
              <button
                key={i}
                className={`aspect-square w-full flex items-center justify-center rounded-none border border-t-0 ${
                  activeDayIdx === i ? "bg-black/5" : "hover:bg-black/5"
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveDayIdx(i);
                }}
                aria-label={`Día ${DAYS[i]}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
