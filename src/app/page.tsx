"use client";
import { useEffect, useRef, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { ChevronDownIcon, Loader2, Plus, Minus } from "lucide-react";
import Timetable, { TimetableEntry } from "@/components/Timetable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";

type Periodo = { codigo: string; nombre: string };
type Programa = {
  codigo: string;
  nombre: string;
  titulo?: string;
  sede?: string;
  label?: string;
};
type Materia = { codigo: string; nombre: string };
type Modalidad = { codigo: string; nombre: string };
type Grupo = {
  codigo: string;
  nombre: string;
  grupo?: string;
  ocupacion?: string; // e.g. "15/20"
  sede?: string;
  horario?: string[];
  parsedSlots?: Array<{
    dia: string;
    desde: string;
    hasta: string;
    ampm: string;
    aula: string;
    label: string;
  }>;
  mergedSlots?: string[];
  docentes?: string;
  label?: string;
  modalidadId?: string;
  programId?: string;
  periodId?: string;
  materiaId?: string;
  materiaName?: string;
};

export default function Home() {
  const [periodos, setPeriodos] = useState<Periodo[]>([]);
  const [periodo, setPeriodo] = useState<string>("");
  const [periodoOpen, setPeriodoOpen] = useState(false);
  const [programas, setProgramas] = useState<Programa[]>([]);
  const [programa, setPrograma] = useState<string>("");
  const [programaOpen, setProgramaOpen] = useState(false);
  const [materias, setMaterias] = useState<Materia[]>([]);
  const [materia, setMateria] = useState<string>("");
  const [materiaQuery, setMateriaQuery] = useState("");
  const [modalidades, setModalidades] = useState<Modalidad[]>([]);
  const [selectedModalidades, setSelectedModalidades] = useState<string[]>([]);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [grupo, setGrupo] = useState<string>("");
  const [loadingP, setLoadingP] = useState(false);
  const [loadingG, setLoadingG] = useState(false);
  const [loadingM, setLoadingM] = useState(false);
  const [loadingMod, setLoadingMod] = useState(false);
  const [loadingGpo, setLoadingGpo] = useState(false);
  const [error, setError] = useState<string>("");
  const [grupoSortKey, setGrupoSortKey] = useState<
    "grupo" | "sede" | "dia" | "ocupacion" | "docente"
  >("grupo");
  const [grupoSortDir, setGrupoSortDir] = useState<"asc" | "desc">("asc");
  const leftColRef = useRef<HTMLDivElement | null>(null);
  const rightColRef = useRef<HTMLDivElement | null>(null);
  const [matchLeftHeight, setMatchLeftHeight] = useState<number | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);
  const [selectedGrupoIds, setSelectedGrupoIds] = useState<string[]>([]);
  const [selectedGroupsMap, setSelectedGroupsMap] = useState<
    Record<string, Grupo>
  >({});
  const [showDay, setShowDay] = useState(false);
  const [showHours, setShowHours] = useState(false);
  const [showTeacher, setShowTeacher] = useState(false);
  const [showCupos, setShowCupos] = useState(false);
  const [showLugar, setShowLugar] = useState(false);
  const [fontScale, setFontScale] = useState(1);
  const [showTimetable, setShowTimetable] = useState(false);
  const [mostrarOpen, setMostrarOpen] = useState(false);

  const sedeBadgeClass = (s?: string) => {
    const key = (s || "").toLowerCase();
    if (key.includes("pasto"))
      return "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200 border-emerald-300";
    if (key.includes("tumaco"))
      return "bg-sky-100 text-sky-900 dark:bg-sky-900/30 dark:text-sky-200 border-sky-300";
    if (key.includes("ipiales"))
      return "bg-violet-100 text-violet-900 dark:bg-violet-900/30 dark:text-violet-200 border-violet-300";
    if (key.includes("tuquerres"))
      return "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200 border-amber-300";
    if (key.includes("general"))
      return "bg-zinc-100 text-zinc-900 dark:bg-zinc-800/60 dark:text-zinc-200 border-zinc-300";
    return "bg-secondary text-secondary-foreground";
  };

  const groupKey = (g: Grupo) => {
    // Composite key with full context to avoid colisiones entre materias/modalidades
    return `${g.periodId || periodo}|${g.programId || programa}|${
      g.materiaId || materia
    }|${g.modalidadId || ""}|${g.codigo}`;
  };
  const isGrupoSelected = (key: string) => selectedGrupoIds.includes(key);
  const toggleGrupoSelected = (g: Grupo) => {
    const key = groupKey(g);
    setSelectedGrupoIds((prev) =>
      prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key]
    );
    setSelectedGroupsMap((prev) => {
      const next = { ...prev } as Record<string, Grupo>;
      if (key in next) {
        delete next[key];
      } else {
        next[key] = g;
      }
      return next;
    });
  };

  // Persist/restore selection
  useEffect(() => {
    try {
      const ids = JSON.parse(
        localStorage.getItem("selectedGrupoIdsV2") || "[]"
      );
      const map = JSON.parse(
        localStorage.getItem("selectedGroupsMapV2") || "{}"
      );
      if (Array.isArray(ids)) setSelectedGrupoIds(ids);
      if (map && typeof map === "object") setSelectedGroupsMap(map);
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(
        "selectedGrupoIdsV2",
        JSON.stringify(selectedGrupoIds)
      );
      localStorage.setItem(
        "selectedGroupsMapV2",
        JSON.stringify(selectedGroupsMap)
      );
    } catch {}
  }, [selectedGrupoIds, selectedGroupsMap]);

  // Track breakpoint and sync right column height to left on desktop
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(min-width: 768px)");
    const handle = () => setIsDesktop(mq.matches);
    handle();
    mq.addEventListener("change", handle);
    return () => mq.removeEventListener("change", handle);
  }, []);

  useEffect(() => {
    if (!isDesktop) {
      setMatchLeftHeight(null);
      return;
    }
    const measure = () => {
      const h = leftColRef.current?.offsetHeight || null;
      setMatchLeftHeight(h);
    };
    measure();
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => measure());
      if (leftColRef.current) ro.observe(leftColRef.current);
    }
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("resize", measure);
      if (ro) ro.disconnect();
    };
  }, [isDesktop]);

  function hourToMinutes(hh: string, ampm?: string) {
    let h = parseInt(hh, 10);
    if (!isFinite(h)) return 0;
    if (ampm) {
      const ap = ampm.toUpperCase();
      if (ap === "PM" && h < 12) h += 12;
      if (ap === "AM" && h === 12) h = 0;
    }
    return h * 60;
  }

  function parseHM(val: string | undefined): [number, number] {
    const s = String(val || "").trim();
    const m = s.match(/^(\d{1,2})(?::(\d{2}))?$/);
    if (!m) return [parseInt(s || "0", 10) || 0, 0];
    const h = parseInt(m[1] || "0", 10) || 0;
    const mm = parseInt(m[2] || "0", 10) || 0;
    return [h, mm];
  }

  function parseRangeMinutes(
    desde: string,
    hasta: string,
    label?: string,
    defaultAmpm?: string
  ): { start: number; end: number } {
    const clean = (s: string) => String(s || "").trim();
    const L = clean(label || "");
    const durMatch = L.match(/\((\d+)\s*horas?\)/i);
    // 1) Prefer explicit desde/hasta when defaultAmpm is provided
    if (defaultAmpm) {
      const [sh, sm] = parseHM(clean(desde));
      const [eh, em] = parseHM(clean(hasta));
      const ap = defaultAmpm.toUpperCase();
      let start = hourToMinutes(String(sh), ap) + sm;
      let end = hourToMinutes(String(eh), ap) + em;
      if (ap === "PM" && end <= start) {
        // Typical case: 9-1 with PM means 9AM-1PM
        start = hourToMinutes(String(sh), "AM") + sm;
      }
      if (ap === "AM" && end <= start) {
        // Typical case: 11-1 with AM means 11AM-1PM
        end = hourToMinutes(String(eh), "PM") + em;
      }
      if (durMatch && end <= start) {
        const dh = parseInt(durMatch[1], 10);
        if (isFinite(dh) && dh > 0) end = start + dh * 60;
      }
      return { start, end };
    }
    // 2) Label-based parsing
    // Case: both AM/PM present
    const mBoth = L.match(
      /(\d{1,2})(?::(\d{2}))?\s*(AM|PM)\s*-\s*(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/i
    );
    if (mBoth) {
      const sh = parseInt(mBoth[1] || "0", 10);
      const sm = parseInt(mBoth[2] || "0", 10);
      const eh = parseInt(mBoth[4] || "0", 10);
      const em = parseInt(mBoth[5] || "0", 10);
      const sap = mBoth[3].toUpperCase();
      const eap = mBoth[6].toUpperCase();
      const start = hourToMinutes(String(sh), sap) + sm;
      const end = hourToMinutes(String(eh), eap) + em;
      return { start, end };
    }
    // Case: only end AM/PM present (e.g., "9-1PM")
    const mEnd = L.match(
      /(\d{1,2})(?::(\d{2}))?\s*-\s*(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/i
    );
    if (mEnd) {
      const sh = parseInt(mEnd[1] || "0", 10);
      const sm = parseInt(mEnd[2] || "0", 10);
      const eh = parseInt(mEnd[3] || "0", 10);
      const em = parseInt(mEnd[4] || "0", 10);
      const eap = mEnd[5].toUpperCase();
      // Infer start AM/PM: if end is PM and start > end => start is AM (e.g., 9-1PM => 9AM-1PM), else same as end
      const sap = eap === "PM" && sh > eh ? "AM" : eap;
      const start = hourToMinutes(String(sh), sap) + sm;
      const end = hourToMinutes(String(eh), eap) + em;
      return { start, end };
    }
    // Case: no AM/PM but plain range in label, e.g., "9-11" or "9:30-11:15"
    const mNoAp = L.match(
      /(\d{1,2})(?::(\d{2}))?\s*-\s*(\d{1,2})(?::(\d{2}))?/
    );
    if (mNoAp) {
      const sh = parseInt(mNoAp[1] || "0", 10);
      const sm = parseInt(mNoAp[2] || "0", 10);
      const eh = parseInt(mNoAp[3] || "0", 10);
      const em = parseInt(mNoAp[4] || "0", 10);
      const ap = (defaultAmpm || "").toUpperCase();
      let start: number;
      let end: number;
      if (ap === "AM" || ap === "PM") {
        start = hourToMinutes(String(sh), ap) + sm;
        end = hourToMinutes(String(eh), ap) + em;
        if (ap === "PM" && end <= start) {
          // If PM and end <= start, assume start was AM (rare). Fallback to raw hours to avoid midnight.
          start = sh * 60 + sm;
          end = eh * 60 + em;
        }
      } else {
        // No AM/PM context: treat as 24h-style within daytime
        start = sh * 60 + sm;
        end = eh * 60 + em;
      }
      if (durMatch && (!defaultAmpm || !/AM|PM/i.test(defaultAmpm))) {
        const dh = parseInt(durMatch[1], 10);
        if (isFinite(dh) && dh > 0) end = start + dh * 60;
      }
      return { start, end };
    }
    // 3) Fallback: no AM/PM anywhere; use desde/hasta literally
    const [sh, sm] = parseHM(clean(desde));
    const [eh, em] = parseHM(clean(hasta));
    const start = sh * 60 + sm;
    let end = eh * 60 + em;
    if (durMatch && end <= start) {
      const dh = parseInt(durMatch[1], 10);
      if (isFinite(dh) && dh > 0) end = start + dh * 60;
    }
    return { start, end };
  }

  const timetableEntries: TimetableEntry[] = (() => {
    type Raw = {
      id: string;
      day: string;
      startMin: number;
      endMin: number;
      title: string;
      subtitle?: string;
      color: string;
      materiaKey: string;
      teacher?: string;
      cupos?: string;
      location?: string;
    };
    const raws: Raw[] = [];
    const sel = new Set(selectedGrupoIds);
    const palette = [
      "#60a5fa",
      "#f59e0b",
      "#34d399",
      "#f472b6",
      "#a78bfa",
      "#f87171",
      "#22d3ee",
      "#84cc16",
    ]; // sky, amber, emerald, pink, violet, red, cyan, lime
    const colorFor = (key: string) => {
      let hash = 0;
      for (let i = 0; i < key.length; i++)
        hash = (hash * 31 + key.charCodeAt(i)) | 0;
      const idx = Math.abs(hash) % palette.length;
      return palette[idx];
    };
    const normalize = (s: string) =>
      s
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toLowerCase();
    for (const key of sel) {
      const g = selectedGroupsMap[key];
      if (!g) continue;
      const slots = (
        g.parsedSlots && g.parsedSlots.length ? g.parsedSlots : []
      ).slice();
      const materiaKey = `${g.periodId}|${g.programId}|${g.materiaId}`; // Color por materia, estable
      const color = colorFor(materiaKey);
      const modName = normalize(
        modalidades.find((m) => m.codigo === g.modalidadId)?.nombre || ""
      );
      const isTeo =
        modName.includes("teor") ||
        modName.startsWith("teo") ||
        (g.modalidadId || "").toLowerCase() === "t";
      const isPra =
        modName.includes("prac") ||
        modName.includes("laboratorio") ||
        modName.includes("lab") ||
        ["p", "l"].includes((g.modalidadId || "").toLowerCase());
      const modLetter = isTeo ? "T" : isPra ? "P" : "";
      for (const s of slots) {
        const { start: startMin, end: endMin } = parseRangeMinutes(
          s.desde,
          s.hasta,
          s.label,
          s.ampm
        );
        if (!(endMin > startMin)) continue;
        const day = s.dia;
        const groupText = g.grupo ? `G${g.grupo}` : `G${g.codigo}`;
        const materiaName =
          g.materiaName ||
          materias.find((mm) => mm.codigo === g.materiaId)?.nombre ||
          "";
        const title = modLetter
          ? `[${modLetter}] ${groupText} - ${materiaName}`
          : `${groupText} - ${materiaName}`;
        const subtitle = g.docentes || g.sede || undefined;
        const location =
          s.aula ||
          (() => {
            const m = (s.label || "").match(/\(([^)]+)\)/);
            return m ? m[1] : undefined;
          })();
        raws.push({
          id: `${key}-${day}-${s.desde}-${s.hasta}`,
          day,
          startMin,
          endMin,
          title,
          subtitle,
          color,
          materiaKey,
          teacher: g.docentes,
          cupos: g.ocupacion,
          location,
        });
      }
    }
    // Compactar: unir bloques consecutivos/solapados por mismo día y misma materia
    const byDayMateria: Record<string, Raw[]> = {};
    for (const r of raws) {
      const k = `${r.day}|${r.materiaKey}`;
      (byDayMateria[k] ||= []).push(r);
    }
    const merged: Raw[] = [];
    for (const k in byDayMateria) {
      const arr = byDayMateria[k].sort(
        (a, b) => a.startMin - b.startMin || a.endMin - b.endMin
      );
      let cur: Raw | null = null;
      for (const ev of arr) {
        if (!cur) {
          cur = { ...ev };
          continue;
        }
        // Merge if overlapping or adjacent (<= 5 min gap)
        if (ev.startMin <= cur.endMin + 5) {
          cur.endMin = Math.max(cur.endMin, ev.endMin);
          // Mantener título del primero (compacto). Combinar docentes/cupos si son distintos.
          if (ev.teacher && ev.teacher !== cur.teacher) {
            const a = new Set(
              String(cur.teacher || "")
                .split(" · ")
                .filter(Boolean)
            );
            String(ev.teacher)
              .split(" · ")
              .filter(Boolean)
              .forEach((t) => a.add(t));
            cur.teacher = Array.from(a).join(" · ");
          }
          if (ev.cupos && ev.cupos !== cur.cupos) {
            const a = new Set(
              String(cur.cupos || "")
                .split(" / ")
                .filter(Boolean)
            );
            String(ev.cupos)
              .split(" / ")
              .filter(Boolean)
              .forEach((t) => a.add(t));
            cur.cupos = Array.from(a).join(" / ");
          }
          if (ev.location && ev.location !== cur.location) {
            const a = new Set(
              String(cur.location || "")
                .split(" · ")
                .filter(Boolean)
            );
            String(ev.location)
              .split(" · ")
              .filter(Boolean)
              .forEach((t) => a.add(t));
            cur.location = Array.from(a).join(" · ");
          }
        } else {
          merged.push(cur);
          cur = { ...ev };
        }
      }
      if (cur) merged.push(cur);
    }
    return merged.map((m) => ({
      id: m.id,
      day: m.day,
      startMin: m.startMin,
      endMin: m.endMin,
      title: m.title,
      subtitle: m.subtitle,
      color: m.color,
      teacher: m.teacher,
      cupos: m.cupos,
      location: m.location,
      materiaKey: m.materiaKey,
    }));
  })();

  const refreshGrupos = async () => {
    if (!periodo || !programa || !materia) return;
    if (selectedModalidades.length === 0) return;
    try {
      setLoadingGpo(true);
      const results: Grupo[] = [];
      for (const mid of selectedModalidades) {
        const params = new URLSearchParams({
          modalidadId: mid,
          periodId: periodo,
          programId: programa,
          materiaId: materia,
          refresh: "1",
        });
        const res = await fetch(`/api/grupos?${params.toString()}`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (Array.isArray(data.grupos)) {
          const mName = materias.find((m) => m.codigo === materia)?.nombre;
          results.push(
            ...data.grupos.map((g: Grupo) => ({
              ...g,
              modalidadId: mid,
              periodId: periodo,
              programId: programa,
              materiaId: materia,
              materiaName: mName,
            }))
          );
        }
      }
      setGrupos(results);
    } catch {
      setError("No se pudieron cargar los grupos");
    } finally {
      setLoadingGpo(false);
    }
  };

  const dayOrder: Record<string, number> = {
    Lunes: 1,
    Martes: 2,
    Miércoles: 3,
    Miercoles: 3,
    Jueves: 4,
    Viernes: 5,
    Sábado: 6,
    Sabado: 6,
    Domingo: 7,
  };
  const dayBadgeClass = (d: string) => {
    const k = d
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase();
    if (k.startsWith("lunes"))
      return "bg-blue-100 text-blue-900 dark:bg-blue-900/30 dark:text-blue-200 border-transparent";
    if (k.startsWith("martes"))
      return "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200 border-transparent";
    if (k.startsWith("miercoles"))
      return "bg-violet-100 text-violet-900 dark:bg-violet-900/30 dark:text-violet-200 border-transparent";
    if (k.startsWith("jueves"))
      return "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200 border-transparent";
    if (k.startsWith("viernes"))
      return "bg-cyan-100 text-cyan-900 dark:bg-cyan-900/30 dark:text-cyan-200 border-transparent";
    if (k.startsWith("sabado"))
      return "bg-rose-100 text-rose-900 dark:bg-rose-900/30 dark:text-rose-200 border-transparent";
    if (k.startsWith("domingo"))
      return "bg-slate-200 text-slate-900 dark:bg-slate-800/60 dark:text-slate-200 border-transparent";
    return "bg-secondary text-secondary-foreground";
  };
  const getFirstDayIndex = (gr: Grupo) => {
    const label = gr.mergedSlots?.[0] || gr.horario?.[0] || "";
    const day = label.split(":")[0]?.trim();
    return dayOrder[day] || 99;
  };
  const sedeOrder: Record<string, number> = {
    pasto: 1,
    tumaco: 2,
    ipiales: 3,
    tuquerres: 4,
    general: 9,
  };
  const getGrupoNumber = (gr: Grupo) => {
    const g = gr.grupo || gr.codigo;
    const n = parseInt(String(g).replace(/\D+/g, ""), 10);
    return isFinite(n) ? n : 0;
  };
  const getOcupPct = (gr: Grupo) => {
    const m = (gr.ocupacion || "").match(/(\d+)\s*\/\s*(\d+)/);
    if (!m) return 0;
    const a = parseInt(m[1], 10);
    const t = Math.max(parseInt(m[2], 10), 1);
    return a / t;
  };
  const getDocente = (gr: Grupo) => (gr.docentes || "").toLowerCase();
  const getModalidadPriority = (id: string) => {
    const mod = modalidades.find((m) => m.codigo === id);
    const normalize = (s: string) =>
      s
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toLowerCase();
    const nombre = normalize(mod?.nombre || "");
    const codigo = normalize(mod?.codigo || "");
    // Detectar Teórica por nombre o código (TEO, T, TEORICA, TEOR)
    if (
      nombre.includes("teor") ||
      nombre.startsWith("teo") ||
      codigo.includes("teo") ||
      codigo === "t"
    )
      return 1; // Teórica primero
    // Detectar Práctica/Laboratorio por nombre o código (PRA, P, PRACTICA, PRAC, LAB)
    if (
      nombre.includes("prac") ||
      nombre.startsWith("pra") ||
      nombre.includes("laboratorio") ||
      nombre.includes("lab") ||
      codigo.includes("pra") ||
      codigo.includes("lab") ||
      codigo === "p" ||
      codigo === "l"
    )
      return 2; // Práctica/Lab después
    return 9; // otras al final
  };

  const sortedGrupos = [...grupos].sort((a, b) => {
    let va = 0,
      vb = 0;
    let sa = "",
      sb = "";
    switch (grupoSortKey) {
      case "grupo":
        va = getGrupoNumber(a);
        vb = getGrupoNumber(b);
        break;
      case "sede":
        sa = (a.sede || "").toLowerCase();
        sb = (b.sede || "").toLowerCase();
        const oa = sedeOrder[sa.split("-").pop() || sa] ?? 99;
        const ob = sedeOrder[sb.split("-").pop() || sb] ?? 99;
        if (oa !== ob) return grupoSortDir === "asc" ? oa - ob : ob - oa;
        if (sa < sb) return grupoSortDir === "asc" ? -1 : 1;
        if (sa > sb) return grupoSortDir === "asc" ? 1 : -1;
        return 0;
      case "dia":
        va = getFirstDayIndex(a);
        vb = getFirstDayIndex(b);
        break;
      case "ocupacion":
        va = getOcupPct(a);
        vb = getOcupPct(b);
        break;
      case "docente":
        sa = getDocente(a);
        sb = getDocente(b);
        if (sa < sb) return grupoSortDir === "asc" ? -1 : 1;
        if (sa > sb) return grupoSortDir === "asc" ? 1 : -1;
        return 0;
    }
    if (va < vb) return grupoSortDir === "asc" ? -1 : 1;
    if (va > vb) return grupoSortDir === "asc" ? 1 : -1;
    return 0;
  });

  const ocupacionBadgeClass = (ocup?: string) => {
    // Expect formats like "15/20", "37/37", etc.
    const m = (ocup || "").match(/(\d+)\s*\/\s*(\d+)/);
    if (!m) return "bg-secondary text-secondary-foreground";
    const actual = parseInt(m[1] || "0", 10);
    const total = Math.max(parseInt(m[2] || "0", 10), 1);
    const pct = actual / total;
    if (pct >= 1)
      return "bg-destructive text-white border-transparent dark:bg-destructive/80";
    if (pct >= 0.8)
      return "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200 border-transparent";
    return "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200 border-transparent";
  };

  // Extra safeguard: on mobile, blur any focused element when opening selection dialogs
  useEffect(() => {
    if (periodoOpen || programaOpen) {
      if (
        typeof window !== "undefined" &&
        window.matchMedia("(max-width: 767px)").matches
      ) {
        setTimeout(() => {
          const el = document.activeElement as HTMLElement | null;
          el?.blur?.();
        }, 0);
      }
    }
  }, [periodoOpen, programaOpen]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoadingP(true);
        const res = await fetch("/api/periodos");
        const data = await res.json();
        setPeriodos(data.periodos || []);
      } catch {
        setError("No se pudieron cargar los periodos");
      } finally {
        setLoadingP(false);
      }
    };
    load();
  }, []);

  const onPeriodoChange = async (value: string) => {
    setPeriodo(value);
    setProgramas([]);
    setPrograma("");
    setMaterias([]);
    setMateria("");
    setModalidades([]);
    setSelectedModalidades([]);
    setGrupos([]);
    setGrupo("");
    if (!value) return;
    try {
      setLoadingG(true);
      const res = await fetch(
        `/api/programas?periodId=${encodeURIComponent(value)}`
      );
      const data = await res.json();
      setProgramas(data.programas || []);
    } catch {
      setError("No se pudieron cargar los programas");
    } finally {
      setLoadingG(false);
    }
  };

  const onProgramaChange = async (value: string) => {
    setPrograma(value);
    setMaterias([]);
    setMateria("");
    setModalidades([]);
    setSelectedModalidades([]);
    if (!value || !periodo) return;
    try {
      setLoadingM(true);
      const params = new URLSearchParams({
        programId: value,
        periodId: periodo,
      });
      const res = await fetch(`/api/materias?${params.toString()}`);
      const data = await res.json();
      setMaterias(data.materias || []);
    } catch {
      setError("No se pudieron cargar las materias");
    } finally {
      setLoadingM(false);
    }
  };

  const onMateriaChange = async (value: string) => {
    setMateria(value);
    setModalidades([]);
    setSelectedModalidades([]);
    setGrupos([]);
    setGrupo("");
    if (!value || !periodo || !programa) return;
    try {
      setLoadingMod(true);
      const params = new URLSearchParams({
        materiaId: value,
        programId: programa,
        periodId: periodo,
      });
      const res = await fetch(`/api/modalidades?${params.toString()}`);
      const data = await res.json();
      setModalidades(data.modalidades || []);
    } catch {
      setError("No se pudieron cargar las modalidades");
    } finally {
      setLoadingMod(false);
    }
  };

  const toggleModalidad = async (value: string) => {
    // Toggle selection of modalidad and fetch groups for all selected modalidades
    const next = selectedModalidades.includes(value)
      ? selectedModalidades.filter((m) => m !== value)
      : [...selectedModalidades, value];
    setSelectedModalidades(next);
    setGrupo("");
    if (!periodo || !programa || !materia) return;
    if (next.length === 0) {
      setGrupos([]);
      return;
    }
    try {
      setLoadingGpo(true);
      const results: Grupo[] = [];
      for (const mid of next) {
        const params = new URLSearchParams({
          modalidadId: mid,
          periodId: periodo,
          programId: programa,
          materiaId: materia,
        });
        const res = await fetch(`/api/grupos?${params.toString()}`);
        const data = await res.json();
        if (Array.isArray(data.grupos)) {
          const mName = materias.find((m) => m.codigo === materia)?.nombre;
          results.push(
            ...data.grupos.map((g: Grupo) => ({
              ...g,
              modalidadId: mid,
              periodId: periodo,
              programId: programa,
              materiaId: materia,
              materiaName: mName,
            }))
          );
        }
      }
      setGrupos(results);
    } catch {
      setError("No se pudieron cargar los grupos");
    } finally {
      setLoadingGpo(false);
    }
  };

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-50">
      <div className="mx-auto max-w-7xl p-3">
        <Card className="p-3 gap-0">
          <CardHeader className="p-1">
            <CardTitle>Consulta de Cupos - UdeCupos</CardTitle>
          </CardHeader>
          <CardContent className="p-1">
            <div className="grid gap-4 md:grid-cols-2">
              <div ref={leftColRef} className="grid pr-2 gap-2">
                <div className="grid gap-2">
                  <Label>Periodo</Label>
                  {loadingP ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Cargando
                      periodos...
                    </div>
                  ) : null}
                  {/* Mobile: Dialog + Command */}
                  <div className="block md:hidden">
                    <Button
                      variant="outline"
                      onClick={() => setPeriodoOpen(true)}
                      disabled={loadingP}
                      className="w-full h-auto min-h-9 items-start justify-between text-left whitespace-normal wrap-break-word font-normal"
                    >
                      <span className="p-0">
                        {periodo
                          ? periodos.find((p) => p.codigo === periodo)
                              ?.nombre || "Periodo"
                          : "Seleccione un periodo"}
                      </span>
                      <span className="text-muted-foreground">
                        <ChevronDownIcon className="w-4 h-4" />
                      </span>
                    </Button>
                    <Dialog open={periodoOpen} onOpenChange={setPeriodoOpen}>
                      <DialogContent
                        className="p-0 gap-0"
                        onOpenAutoFocus={(e) => e.preventDefault()}
                      >
                        <DialogHeader className="px-4 pt-4 pb-2">
                          <DialogTitle>Seleccionar periodo</DialogTitle>
                        </DialogHeader>
                        <Command>
                          <CommandInput
                            autoFocus={false}
                            placeholder="Buscar periodo..."
                          />
                          <CommandList>
                            <CommandEmpty>
                              No se encontraron periodos
                            </CommandEmpty>
                            <CommandGroup>
                              {periodos.map((p, i) => (
                                <CommandItem
                                  key={`${p.codigo}-${i}`}
                                  value={p.nombre}
                                  onSelect={() => {
                                    setPeriodoOpen(false);
                                    onPeriodoChange(p.codigo);
                                  }}
                                >
                                  {p.nombre}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </DialogContent>
                    </Dialog>
                  </div>
                  {/* Desktop: Select */}
                  <div className="hidden md:block">
                    <Select
                      value={periodo}
                      onValueChange={onPeriodoChange}
                      disabled={loadingP}
                    >
                      <SelectTrigger className="w-full h-auto min-h-9 items-start text-left">
                        <SelectValue
                          className="whitespace-normal wrap-break-word md:line-clamp-2"
                          placeholder="Seleccione un periodo"
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {periodos.map((p, i) => (
                          <SelectItem key={`${p.codigo}-${i}`} value={p.codigo}>
                            {p.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label>Programa</Label>
                  {/* Mobile: Dialog + Command */}
                  <div className="block md:hidden">
                    <Button
                      variant="outline"
                      onClick={() => setProgramaOpen(true)}
                      disabled={!periodo || loadingG}
                      className="w-full h-auto min-h-9 items-start justify-between text-left whitespace-normal wrap-break-word font-normal"
                    >
                      <span className="p-0">
                        {(() => {
                          const sel = programas.find(
                            (g) => g.codigo === programa
                          );
                          return sel
                            ? `${sel.codigo} - ${(
                                sel.titulo ||
                                sel.nombre
                                  .replace(/\([^)]*\)/g, "")
                                  .replace(/\s+-\s*/g, "-")
                              ).trim()}`
                            : "Seleccione un programa";
                        })()}
                      </span>
                      <span className="flex items-center gap-2 text-muted-foreground">
                        {(() => {
                          const sel = programas.find(
                            (g) => g.codigo === programa
                          );
                          const sede = sel?.sede;
                          return sede ? (
                            <Badge className={sedeBadgeClass(sede)}>
                              {sede}
                            </Badge>
                          ) : null;
                        })()}
                        <ChevronDownIcon className="w-4 h-4" />
                      </span>
                    </Button>
                    <Dialog open={programaOpen} onOpenChange={setProgramaOpen}>
                      <DialogContent
                        className="p-0 gap-0"
                        onOpenAutoFocus={(e) => e.preventDefault()}
                      >
                        <DialogHeader className="px-4 pt-4 pb-2">
                          <DialogTitle>Seleccionar programa</DialogTitle>
                        </DialogHeader>
                        <Command>
                          <CommandInput
                            autoFocus={false}
                            placeholder="Buscar programa..."
                          />
                          <CommandList>
                            <CommandEmpty>
                              No se encontraron programas
                            </CommandEmpty>
                            <CommandGroup>
                              {programas.map((g, i) => (
                                <CommandItem
                                  key={`${g.codigo}-${i}`}
                                  value={g.titulo || g.nombre}
                                  onSelect={() => {
                                    setProgramaOpen(false);
                                    onProgramaChange(g.codigo);
                                  }}
                                >
                                  <div className="flex w-full items-center justify-between gap-2">
                                    <span className="truncate">
                                      {g.codigo} -{" "}
                                      {g.titulo ||
                                        g.nombre
                                          .replace(/\([^)]*\)/g, "")
                                          .replace(/\s+-\s*/g, "-")}
                                    </span>
                                    {g.sede ? (
                                      <Badge className={sedeBadgeClass(g.sede)}>
                                        {g.sede}
                                      </Badge>
                                    ) : null}
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </DialogContent>
                    </Dialog>
                  </div>
                  {/* Desktop: Select */}
                  <div className="hidden md:block">
                    <Select
                      value={programa}
                      onValueChange={onProgramaChange}
                      disabled={!periodo || loadingG}
                    >
                      <SelectTrigger className="w-full h-auto min-h-9 items-start text-left">
                        <div className="flex w-full items-start justify-between gap-2">
                          <SelectValue
                            className="whitespace-normal wrap-break-word md:line-clamp-2"
                            placeholder="Seleccione un programa"
                          />
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        {programas.map((g, i) => (
                          <SelectItem key={`${g.codigo}-${i}`} value={g.codigo}>
                            <div className="flex w-full items-center justify-between gap-2">
                              <span className="truncate">
                                {g.codigo} -{" "}
                                {g.titulo ||
                                  g.nombre
                                    .replace(/\([^)]*\)/g, "")
                                    .replace(/\s+-\s*/g, "-")}
                              </span>
                              {g.sede ? (
                                <Badge className={sedeBadgeClass(g.sede)}>
                                  {g.sede}
                                </Badge>
                              ) : null}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label>Materia</Label>
                  {loadingM ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Cargando
                      materias...
                    </div>
                  ) : !programa ? (
                    <div className="text-sm text-muted-foreground">
                      Seleccione un programa
                    </div>
                  ) : materias.length === 0 ? (
                    <div className="text-sm text-muted-foreground">
                      No hay materias disponibles
                    </div>
                  ) : (
                    <>
                      <Input
                        value={materiaQuery}
                        onChange={(e) => setMateriaQuery(e.target.value)}
                        placeholder="Buscar materia..."
                        className="h-9"
                      />
                      <ScrollArea className="h-56 sm:h-64 md:h-72 w-full rounded-md border">
                        <div className="p-2 grid gap-2 grid-cols-1">
                          {materias
                            .filter((m) => {
                              const q = materiaQuery.trim().toLowerCase();
                              if (!q) return true;
                              const nombre = (m.nombre || "").toLowerCase();
                              const codigo = (m.codigo || "").toLowerCase();
                              return nombre.includes(q) || codigo.includes(q);
                            })
                            .map((m, i) => {
                              const isSel = materia === m.codigo;
                              return (
                                <Card
                                  key={`${m.codigo}-${i}`}
                                  data-selected={isSel}
                                  onClick={() => onMateriaChange(m.codigo)}
                                  className={`cursor-pointer transition-shadow p-0 ${
                                    isSel
                                      ? "border-ring ring-2 ring-ring/50"
                                      : "hover:shadow-sm"
                                  }`}
                                >
                                  <CardContent className="p-1 px-3">
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-sm whitespace-normal wrap-break-word md:line-clamp-2">
                                        {m.nombre}
                                      </span>
                                      {isSel ? (
                                        <Badge
                                          variant="default"
                                          className="bg-gray-600"
                                        >
                                          Seleccionada
                                        </Badge>
                                      ) : null}
                                    </div>
                                  </CardContent>
                                </Card>
                              );
                            })}
                        </div>
                      </ScrollArea>
                    </>
                  )}
                </div>

                <div className="grid gap-2">
                  <Label>Modalidad</Label>
                  {loadingMod ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Cargando
                      modalidades...
                    </div>
                  ) : !materia ? (
                    <div className="text-sm text-muted-foreground">
                      Seleccione una materia
                    </div>
                  ) : modalidades.length === 0 ? (
                    <div className="text-sm text-muted-foreground">
                      No hay modalidades disponibles
                    </div>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {modalidades.map((mo, i) => {
                        const selected = selectedModalidades.includes(
                          mo.codigo
                        );
                        return (
                          <Card
                            key={`${mo.codigo}-${i}`}
                            data-selected={selected}
                            onClick={() => toggleModalidad(mo.codigo)}
                            className={`cursor-pointer transition-shadow p-0 ${
                              selected
                                ? "border-ring ring-2 ring-ring/50"
                                : "hover:shadow-sm"
                            }`}
                          >
                            <CardContent className="px-3 py-2">
                              <div className="flex items-center justify-between gap-2">
                                <div className="text-sm font-medium">
                                  {mo.nombre}
                                </div>
                                {selected ? (
                                  <Badge
                                    variant="default"
                                    className="bg-gray-600"
                                  >
                                    Seleccionada
                                  </Badge>
                                ) : null}
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </div>
                {selectedModalidades.length ? (
                  <div className="text-xs text-muted-foreground">
                    <div className="font-normal">
                      Modalidades seleccionadas:{" "}
                      {selectedModalidades
                        .map(
                          (id) =>
                            modalidades.find((m) => m.codigo === id)?.nombre ||
                            id
                        )
                        .join(", ")}
                    </div>
                  </div>
                ) : null}
              </div>
              <div
                ref={rightColRef}
                className="pl-0"
                style={
                  isDesktop && matchLeftHeight
                    ? { maxHeight: matchLeftHeight, overflowY: "auto" }
                    : undefined
                }
              >
                <div className="grid gap-2">
                  <Label>Grupo (horario)</Label>
                  <div className="text-xs">
                    <div className="text-muted-foreground mb-1">
                      Ordenar por:
                    </div>
                    <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2">
                      <Select
                        value={grupoSortKey}
                        onValueChange={(v) =>
                          setGrupoSortKey(
                            v as
                              | "grupo"
                              | "sede"
                              | "dia"
                              | "ocupacion"
                              | "docente"
                          )
                        }
                      >
                        <SelectTrigger className="h-10 w-full sm:h-9 sm:w-[200px]">
                          <SelectValue placeholder="Campo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="grupo">Número de grupo</SelectItem>
                          <SelectItem value="sede">Sede</SelectItem>
                          <SelectItem value="dia">Días</SelectItem>
                          <SelectItem value="ocupacion">Cupos</SelectItem>
                          <SelectItem value="docente">Docente</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select
                        value={grupoSortDir}
                        onValueChange={(v) =>
                          setGrupoSortDir(v as "asc" | "desc")
                        }
                      >
                        <SelectTrigger className="h-10 w-full sm:h-9 sm:w-[160px]">
                          <SelectValue placeholder="Dirección" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="asc">Ascendente</SelectItem>
                          <SelectItem value="desc">Descendente</SelectItem>
                        </SelectContent>
                      </Select>
                      <div className="sm:flex-1" />
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowTimetable((prev) => {
                            const next = !prev;
                            if (!prev && typeof window !== "undefined") {
                              setTimeout(
                                () =>
                                  document
                                    .getElementById("horario")
                                    ?.scrollIntoView({ behavior: "smooth" }),
                                0
                              );
                            }
                            return next;
                          });
                        }}
                        className="h-8"
                      >
                        {showTimetable
                          ? "Ocultar horario"
                          : "Ver/Hacer horario"}
                      </Button>
                      {selectedModalidades.length > 0 ? (
                        <Button
                          variant="outline"
                          onClick={refreshGrupos}
                          disabled={loadingGpo}
                          className="h-8"
                        >
                          {loadingGpo ? (
                            <span className="inline-flex items-center gap-2">
                              <Loader2 className="h-4 w-4 animate-spin" />{" "}
                              Actualizando…
                            </span>
                          ) : (
                            <span>Actualizar grupos</span>
                          )}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  {loadingGpo ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Cargando
                      grupos...
                    </div>
                  ) : selectedModalidades.length === 0 ? (
                    <div className="text-sm text-muted-foreground">
                      Seleccione una modalidad
                    </div>
                  ) : grupos.length === 0 ? (
                    <div className="text-sm text-muted-foreground">
                      No hay grupos disponibles
                    </div>
                  ) : (
                    <div className="grid gap-4 grid-cols-1">
                      {[...selectedModalidades]
                        .sort((a, b) => {
                          const pa = getModalidadPriority(a);
                          const pb = getModalidadPriority(b);
                          if (pa !== pb) return pa - pb;
                          const norm = (s: string) =>
                            s
                              .normalize("NFD")
                              .replace(/\p{Diacritic}/gu, "")
                              .toLowerCase();
                          const na = norm(
                            modalidades.find((m) => m.codigo === a)?.nombre ||
                              ""
                          );
                          const nb = norm(
                            modalidades.find((m) => m.codigo === b)?.nombre ||
                              ""
                          );
                          if (na < nb) return -1;
                          if (na > nb) return 1;
                          return 0;
                        })
                        .map((mid) => {
                          const nombre =
                            modalidades.find((m) => m.codigo === mid)?.nombre ||
                            mid;
                          const list = sortedGrupos.filter(
                            (g) => g.modalidadId === mid
                          );
                          if (!list.length) return null;
                          return (
                            <div key={mid} className="min-w-0">
                              <div className="text-xs font-semibold text-muted-foreground uppercase mb-1">
                                {nombre}
                              </div>
                              <div className="grid grid-cols-1 gap-2">
                                {list.map((gr, i) => {
                                  const key = groupKey(gr);
                                  const selected = grupo === gr.codigo;
                                  const titulo = gr.grupo
                                    ? `G${gr.grupo}`
                                    : `G${gr.codigo}`;
                                  return (
                                    <Card
                                      key={`${gr.codigo}-${i}`}
                                      data-selected={selected}
                                      className={`relative cursor-pointer transition-shadow p-0 ${
                                        selected
                                          ? "border-ring ring-2 ring-ring/50"
                                          : "hover:shadow-sm"
                                      } ${
                                        isGrupoSelected(key)
                                          ? "border border-emerald-500 bg-emerald-50/40 dark:bg-emerald-900/10"
                                          : ""
                                      }`}
                                    >
                                      <CardContent className="p-3">
                                        <div className="flex items-center justify-between gap-2">
                                          <div className="text-sm font-medium">
                                            <Badge className="align-middle inline-block bg-primary text-primary-foreground border-transparent">
                                              {titulo}
                                            </Badge>
                                            {gr.sede ? (
                                              <span className="ml-1 align-middle inline-block">
                                                <Badge
                                                  className={sedeBadgeClass(
                                                    gr.sede
                                                  )}
                                                >
                                                  {gr.sede}
                                                </Badge>
                                              </span>
                                            ) : null}
                                          </div>
                                          <div className="flex items-center gap-2">
                                            {gr.ocupacion ? (
                                              <Badge
                                                className={ocupacionBadgeClass(
                                                  gr.ocupacion
                                                )}
                                              >
                                                {gr.ocupacion}
                                              </Badge>
                                            ) : null}
                                            <Button
                                              size="icon"
                                              variant="ghost"
                                              aria-label={
                                                isGrupoSelected(key)
                                                  ? "Quitar del horario"
                                                  : "Agregar al horario"
                                              }
                                              onClick={() =>
                                                toggleGrupoSelected({
                                                  ...gr,
                                                  periodId: periodo,
                                                  programId: programa,
                                                  materiaId: materia,
                                                })
                                              }
                                            >
                                              {isGrupoSelected(key) ? (
                                                <Minus className="h-4 w-4" />
                                              ) : (
                                                <Plus className="h-4 w-4" />
                                              )}
                                            </Button>
                                          </div>
                                        </div>
                                        {(() => {
                                          const labels = gr.mergedSlots?.length
                                            ? gr.mergedSlots
                                            : gr.horario || [];
                                          const byDay = new Map<
                                            string,
                                            string[]
                                          >();
                                          for (const l of labels) {
                                            const s = String(l);
                                            const [dRaw, restRaw] =
                                              s.split(":");
                                            const d = (dRaw || "").trim();
                                            const rest = (restRaw || "").trim();
                                            if (!d) continue;
                                            if (!byDay.has(d)) byDay.set(d, []);
                                            if (rest) byDay.get(d)!.push(rest);
                                          }
                                          const entries = Array.from(
                                            byDay.entries()
                                          );
                                          return entries.length ? (
                                            <div className="mt-1 grid gap-1 grid-cols-1 sm:grid-cols-2">
                                              {entries.map(([d, segs]) => (
                                                <Badge
                                                  key={d}
                                                  className={`${dayBadgeClass(
                                                    d
                                                  )} w-full justify-start`}
                                                >
                                                  {d}
                                                  {segs.length
                                                    ? `: ${segs.join(" · ")}`
                                                    : ""}
                                                </Badge>
                                              ))}
                                            </div>
                                          ) : null;
                                        })()}
                                        {gr.docentes ? (
                                          <div className="text-xs font-semibold text-gray-700 dark:text-gray-200 mt-1">
                                            Docente: {gr.docentes}
                                          </div>
                                        ) : null}
                                      </CardContent>
                                    </Card>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>

                {error ? (
                  <div className="text-sm text-red-600 dark:text-red-400">
                    {error}
                  </div>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>
        {/* Segunda fila: Horario a pantalla completa */}
        {showTimetable ? (
          <div id="horario" className="mt-4">
            <Card className="flex flex-col p-2 gap-0">
              <CardHeader className="p-2 m-0">
                <CardTitle className="p-0 ">Mi Horario</CardTitle>
              </CardHeader>
              <CardContent className="p-2 flex flex-col gap-2">
                <div className="flex items-center gap-2 flex-wrap justify-between">
                  <Badge variant="outline">
                    Grupos seleccionados: {selectedGrupoIds.length}
                  </Badge>
                  {selectedGrupoIds.length > 0 ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedGrupoIds([]);
                        setSelectedGroupsMap({});
                      }}
                    >
                      Limpiar
                    </Button>
                  ) : null}
                  <div className="hidden md:flex items-center gap-1 ml-2 text-xs">
                    <span className="text-muted-foreground">Mostrar:</span>
                    <Button
                      size="sm"
                      variant={showTeacher ? "default" : "outline"}
                      onClick={() => setShowTeacher((v) => !v)}
                    >
                      Docente
                    </Button>
                    <Button
                      size="sm"
                      variant={showCupos ? "default" : "outline"}
                      onClick={() => setShowCupos((v) => !v)}
                    >
                      Cupos
                    </Button>
                    <Button
                      size="sm"
                      variant={showDay ? "default" : "outline"}
                      onClick={() => setShowDay((v) => !v)}
                    >
                      Día
                    </Button>
                    <Button
                      size="sm"
                      variant={showHours ? "default" : "outline"}
                      onClick={() => setShowHours((v) => !v)}
                    >
                      Horas
                    </Button>
                    <Button
                      size="sm"
                      variant={showLugar ? "default" : "outline"}
                      onClick={() => setShowLugar((v) => !v)}
                    >
                      Lugar
                    </Button>
                  </div>
                  <div className="flex md:hidden items-center gap-1 ml-2 text-xs">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setMostrarOpen(true)}
                    >
                      Mostrar
                    </Button>
                    <Dialog open={mostrarOpen} onOpenChange={setMostrarOpen}>
                      <DialogContent
                        className="p-4 gap-3"
                        onOpenAutoFocus={(e) => e.preventDefault()}
                      >
                        <DialogHeader>
                          <DialogTitle>Mostrar</DialogTitle>
                        </DialogHeader>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={showTeacher}
                              onChange={(e) =>
                                setShowTeacher(e.currentTarget.checked)
                              }
                            />
                            <span>Docente</span>
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={showCupos}
                              onChange={(e) =>
                                setShowCupos(e.currentTarget.checked)
                              }
                            />
                            <span>Cupos</span>
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={showDay}
                              onChange={(e) =>
                                setShowDay(e.currentTarget.checked)
                              }
                            />
                            <span>Día</span>
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={showHours}
                              onChange={(e) =>
                                setShowHours(e.currentTarget.checked)
                              }
                            />
                            <span>Horas</span>
                          </label>
                          <label className="flex items-center gap-2 col-span-2">
                            <input
                              type="checkbox"
                              checked={showLugar}
                              onChange={(e) =>
                                setShowLugar(e.currentTarget.checked)
                              }
                            />
                            <span>Lugar</span>
                          </label>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                  <div className="flex items-center gap-1 ml-2 text-xs">
                    <span className="text-muted-foreground">Tamaño:</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setFontScale((v) =>
                          Math.max(0.75, +(v - 0.1).toFixed(2))
                        )
                      }
                    >
                      A-
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setFontScale((v) =>
                          Math.min(1.75, +(v + 0.1).toFixed(2))
                        )
                      }
                    >
                      A+
                    </Button>
                  </div>
                  <div className="ml-auto">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        window.scrollTo({ top: 0, behavior: "smooth" })
                      }
                    >
                      Volver arriba
                    </Button>
                  </div>
                </div>
                <div>
                  <Timetable
                    entries={timetableEntries}
                    startHour={7}
                    endHour={22}
                    options={{
                      showDay,
                      showHours,
                      showTeacher,
                      showCupos,
                      showLugar,
                      fontScale,
                    }}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        ) : null}
      </div>
    </div>
  );
}
