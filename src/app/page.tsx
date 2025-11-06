"use client";
import { useEffect, useState } from "react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { ChevronDownIcon } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";

type Periodo = { codigo: string; nombre: string };
type Programa = { codigo: string; nombre: string; titulo?: string; sede?: string; label?: string };
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
  const [grupoSortKey, setGrupoSortKey] = useState<"grupo"|"sede"|"dia"|"ocupacion"|"docente">("grupo");
  const [grupoSortDir, setGrupoSortDir] = useState<"asc"|"desc">("asc");

  const sedeBadgeClass = (s?: string) => {
    const key = (s || "").toLowerCase();
    if (key.includes("pasto")) return "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200 border-emerald-300";
    if (key.includes("tumaco")) return "bg-sky-100 text-sky-900 dark:bg-sky-900/30 dark:text-sky-200 border-sky-300";
    if (key.includes("ipiales")) return "bg-violet-100 text-violet-900 dark:bg-violet-900/30 dark:text-violet-200 border-violet-300";
    if (key.includes("tuquerres")) return "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200 border-amber-300";
    if (key.includes("general")) return "bg-zinc-100 text-zinc-900 dark:bg-zinc-800/60 dark:text-zinc-200 border-zinc-300";
    return "bg-secondary text-secondary-foreground";
  };

  const dayOrder: Record<string, number> = { Lunes:1, Martes:2, Miércoles:3, Miercoles:3, Jueves:4, Viernes:5, Sábado:6, Sabado:6, Domingo:7 };
  const dayBadgeClass = (d: string) => {
    const k = d.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
    if (k.startsWith('lunes')) return 'bg-blue-100 text-blue-900 dark:bg-blue-900/30 dark:text-blue-200 border-transparent';
    if (k.startsWith('martes')) return 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200 border-transparent';
    if (k.startsWith('miercoles')) return 'bg-violet-100 text-violet-900 dark:bg-violet-900/30 dark:text-violet-200 border-transparent';
    if (k.startsWith('jueves')) return 'bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200 border-transparent';
    if (k.startsWith('viernes')) return 'bg-cyan-100 text-cyan-900 dark:bg-cyan-900/30 dark:text-cyan-200 border-transparent';
    if (k.startsWith('sabado')) return 'bg-rose-100 text-rose-900 dark:bg-rose-900/30 dark:text-rose-200 border-transparent';
    if (k.startsWith('domingo')) return 'bg-slate-200 text-slate-900 dark:bg-slate-800/60 dark:text-slate-200 border-transparent';
    return 'bg-secondary text-secondary-foreground';
  };
  const getFirstDayIndex = (gr: Grupo) => {
    const label = gr.mergedSlots?.[0] || gr.horario?.[0] || "";
    const day = label.split(":")[0]?.trim();
    return dayOrder[day] || 99;
  };
  const sedeOrder: Record<string, number> = { pasto: 1, tumaco: 2, ipiales: 3, tuquerres: 4, general: 9 };
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
    const normalize = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
    const nombre = normalize(mod?.nombre || "");
    const codigo = normalize(mod?.codigo || "");
    // Detectar Teórica por nombre o código (TEO, T, TEORICA, TEOR)
    if (nombre.includes("teor") || nombre.startsWith("teo") || codigo.includes("teo") || codigo === "t") return 1; // Teórica primero
    // Detectar Práctica/Laboratorio por nombre o código (PRA, P, PRACTICA, PRAC, LAB)
    if (
      nombre.includes("prac") || nombre.startsWith("pra") || nombre.includes("laboratorio") || nombre.includes("lab") ||
      codigo.includes("pra") || codigo.includes("lab") || codigo === "p" || codigo === "l"
    ) return 2; // Práctica/Lab después
    return 9; // otras al final
  };

  const sortedGrupos = [...grupos].sort((a, b) => {
    let va = 0, vb = 0; let sa = "", sb = "";
    switch (grupoSortKey) {
      case "grupo":
        va = getGrupoNumber(a); vb = getGrupoNumber(b); break;
      case "sede":
        sa = (a.sede || "").toLowerCase(); sb = (b.sede || "").toLowerCase();
        const oa = sedeOrder[sa.split('-').pop() || sa] ?? 99;
        const ob = sedeOrder[sb.split('-').pop() || sb] ?? 99;
        if (oa !== ob) return grupoSortDir === "asc" ? oa - ob : ob - oa;
        if (sa < sb) return grupoSortDir === "asc" ? -1 : 1;
        if (sa > sb) return grupoSortDir === "asc" ? 1 : -1;
        return 0;
      case "dia":
        va = getFirstDayIndex(a); vb = getFirstDayIndex(b); break;
      case "ocupacion":
        va = getOcupPct(a); vb = getOcupPct(b); break;
      case "docente":
        sa = getDocente(a); sb = getDocente(b);
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
    if (pct >= 1) return "bg-destructive text-white border-transparent dark:bg-destructive/80";
    if (pct >= 0.8)
      return "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200 border-transparent";
    return "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200 border-transparent";
  };

  // Extra safeguard: on mobile, blur any focused element when opening selection dialogs
  useEffect(() => {
    if (periodoOpen || programaOpen) {
      if (typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches) {
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
      const res = await fetch(`/api/programas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ periodId: value })
      });
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
      const res = await fetch(`/api/materias`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ programId: value, periodId: periodo })
      });
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
      const res = await fetch(`/api/modalidades`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ materiaId: value, programId: programa, periodId: periodo })
      });
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
        // Fetch grupos por cada modalidad seleccionada y combinar
        const res = await fetch(`/api/grupos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ modalidadId: mid, periodId: periodo, programId: programa, materiaId: materia })
        });
        const data = await res.json();
        if (Array.isArray(data.grupos)) {
          results.push(...data.grupos.map((g: Grupo) => ({ ...g, modalidadId: mid })));
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
    <div className="min-h-screen w-full bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-50">
      <div className="mx-auto max-w-3xl p-3">
        <Card className="p-3 gap-0">
          <CardHeader className="p-1">
            <CardTitle>Consulta de Cupos - UdeCupos</CardTitle>
          </CardHeader>
          <CardContent className="p-1">
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label>Periodo</Label>
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
                        ? periodos.find((p) => p.codigo === periodo)?.nombre || "Periodo"
                        : "Seleccione un periodo"}
                    </span>
                    <span className="text-muted-foreground"><ChevronDownIcon className="w-4 h-4" /></span>
                  </Button>
                  <Dialog open={periodoOpen} onOpenChange={setPeriodoOpen}>
                    <DialogContent className="p-0 gap-0" onOpenAutoFocus={(e) => e.preventDefault()}>
                      <DialogHeader className="px-4 pt-4 pb-2">
                        <DialogTitle>Seleccionar periodo</DialogTitle>
                      </DialogHeader>
                      <Command>
                        <CommandInput autoFocus={false} placeholder="Buscar periodo..." />
                        <CommandList>
                          <CommandEmpty>No se encontraron periodos</CommandEmpty>
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
                  <Select value={periodo} onValueChange={onPeriodoChange} disabled={loadingP}>
                    <SelectTrigger className="w-full h-auto min-h-9 items-start text-left">
                      <SelectValue className="whitespace-normal wrap-break-word md:line-clamp-2" placeholder="Seleccione un periodo" />
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
                        const sel = programas.find((g) => g.codigo === programa);
                        return sel ? `${sel.codigo} - ${(sel.titulo || sel.nombre.replace(/\([^)]*\)/g, "").replace(/\s+-\s*/g, "-")).trim()}` : "Seleccione un programa";
                      })()}
                    </span>
                    <span className="flex items-center gap-2 text-muted-foreground">
                      {(() => {
                        const sel = programas.find((g) => g.codigo === programa);
                        const sede = sel?.sede;
                        return sede ? (
                          <Badge className={sedeBadgeClass(sede)}>{sede}</Badge>
                        ) : null;
                      })()}
                      <ChevronDownIcon className="w-4 h-4" />
                    </span>
                  </Button>
                  <Dialog open={programaOpen} onOpenChange={setProgramaOpen}>
                    <DialogContent className="p-0 gap-0" onOpenAutoFocus={(e) => e.preventDefault()}>
                      <DialogHeader className="px-4 pt-4 pb-2">
                        <DialogTitle>Seleccionar programa</DialogTitle>
                      </DialogHeader>
                      <Command>
                        <CommandInput autoFocus={false} placeholder="Buscar programa..." />
                        <CommandList>
                          <CommandEmpty>No se encontraron programas</CommandEmpty>
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
                                  <span className="truncate">{g.codigo} - {g.titulo || g.nombre.replace(/\([^)]*\)/g, "").replace(/\s+-\s*/g, "-")}</span>
                                  {g.sede ? (
                                    <Badge className={sedeBadgeClass(g.sede)}>{g.sede}</Badge>
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
                  <Select value={programa} onValueChange={onProgramaChange} disabled={!periodo || loadingG}>
                    <SelectTrigger className="w-full h-auto min-h-9 items-start text-left">
                      <div className="flex w-full items-start justify-between gap-2">
                        <SelectValue className="whitespace-normal wrap-break-word md:line-clamp-2" placeholder="Seleccione un programa" />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      {programas.map((g, i) => (
                        <SelectItem key={`${g.codigo}-${i}`} value={g.codigo}>
                          <div className="flex w-full items-center justify-between gap-2">
                            <span className="truncate">
                              {g.codigo} - {g.titulo || g.nombre.replace(/\([^)]*\)/g, "").replace(/\s+-\s*/g, "-")}
                            </span>
                            {g.sede ? (
                              <Badge className={sedeBadgeClass(g.sede)}>{g.sede}</Badge>
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
                  <div className="text-sm text-muted-foreground">Cargando materias...</div>
                ) : !programa ? (
                  <div className="text-sm text-muted-foreground">Seleccione un programa</div>
                ) : materias.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No hay materias disponibles</div>
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
                            className={`cursor-pointer transition-shadow p-0 ${isSel ? "border-ring ring-2 ring-ring/50" : "hover:shadow-sm"}`}
                          >
                            <CardContent className="p-1 px-3">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-sm whitespace-normal wrap-break-word md:line-clamp-2">{m.nombre}</span>
                                {isSel ? (
                                  <Badge variant="default" className="bg-gray-600">Seleccionada</Badge>
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
                  <div className="text-sm text-muted-foreground">Cargando modalidades...</div>
                ) : !materia ? (
                  <div className="text-sm text-muted-foreground">Seleccione una materia</div>
                ) : modalidades.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No hay modalidades disponibles</div>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {modalidades.map((mo, i) => {
                      const selected = selectedModalidades.includes(mo.codigo);
                      return (
                        <Card
                          key={`${mo.codigo}-${i}`}
                          data-selected={selected}
                          onClick={() => toggleModalidad(mo.codigo)}
                          className={`cursor-pointer transition-shadow p-0 ${selected ? "border-ring ring-2 ring-ring/50" : "hover:shadow-sm"}`}
                        >
                          <CardContent className="px-3 py-2">
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-sm font-medium">{mo.nombre}</div>
                              {selected ? (
                                <Badge variant="default" className="bg-gray-600">Seleccionada</Badge>
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
                  Modalidades seleccionadas: {selectedModalidades.map((id) => modalidades.find((m) => m.codigo === id)?.nombre || id).join(', ')}
                </div>
              ) : null}

              <div className="grid gap-2">
                <Label>Grupo (horario)</Label>
                <div className="text-xs">
                  <div className="text-muted-foreground mb-1">Ordenar por:</div>
                  <div className="flex flex-col md:flex-row md:items-center gap-2">
                    <Select
                      value={grupoSortKey}
                      onValueChange={(v) => setGrupoSortKey(v as "grupo"|"sede"|"dia"|"ocupacion"|"docente")}
                    >
                      <SelectTrigger className="h-10 w-full md:h-8 md:w-[200px]"><SelectValue placeholder="Campo" /></SelectTrigger>
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
                      onValueChange={(v) => setGrupoSortDir(v as "asc"|"desc")}
                    >
                      <SelectTrigger className="h-10 w-full md:h-8 md:w-[160px]"><SelectValue placeholder="Dirección" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="asc">Ascendente</SelectItem>
                        <SelectItem value="desc">Descendente</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {loadingGpo ? (
                  <div className="text-sm text-muted-foreground">Cargando grupos...</div>
                ) : selectedModalidades.length === 0 ? (
                  <div className="text-sm text-muted-foreground">Seleccione una modalidad</div>
                ) : grupos.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No hay grupos disponibles</div>
                ) : (
                  <div className="grid gap-4">
                    {[...selectedModalidades]
                      .sort((a,b)=>{
                        const pa = getModalidadPriority(a);
                        const pb = getModalidadPriority(b);
                        if (pa !== pb) return pa - pb;
                        const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
                        const na = norm(modalidades.find(m=>m.codigo===a)?.nombre || '');
                        const nb = norm(modalidades.find(m=>m.codigo===b)?.nombre || '');
                        if (na < nb) return -1;
                        if (na > nb) return 1;
                        return 0;
                      })
                      .map((mid) => {
                      const nombre = modalidades.find((m) => m.codigo === mid)?.nombre || mid;
                      const list = sortedGrupos.filter((g) => g.modalidadId === mid);
                      if (!list.length) return null;
                      return (
                        <div key={mid}>
                          <div className="text-xs font-semibold text-muted-foreground uppercase mb-1">{nombre}</div>
                          <div className="grid gap-2">
                            {list.map((gr, i) => {
                              const selected = grupo === gr.codigo;
                              const titulo = gr.grupo ? `G${gr.grupo}` : `G${gr.codigo}`;
                              return (
                                <Card
                                  key={`${gr.codigo}-${i}`}
                                  data-selected={selected}
                                  onClick={() => setGrupo(gr.codigo)}
                                  className={`cursor-pointer transition-shadow p-0 ${selected ? "border-ring ring-2 ring-ring/50" : "hover:shadow-sm"}`}
                                >
                                  <CardContent className="p-3">
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="text-sm font-medium">
                                        <Badge className="align-middle inline-block bg-primary text-primary-foreground border-transparent">{titulo}</Badge>
                                        {gr.sede ? (
                                          <span className="ml-1 align-middle inline-block">
                                            <Badge className={sedeBadgeClass(gr.sede)}>{gr.sede}</Badge>
                                          </span>
                                        ) : null}
                                      </div>
                                      {gr.ocupacion ? (
                                        <Badge className={ocupacionBadgeClass(gr.ocupacion)}>
                                          {gr.ocupacion}
                                        </Badge>
                                      ) : null}
                                    </div>
                                    {(() => {
                                      const labels = gr.mergedSlots?.length ? gr.mergedSlots : (gr.horario || []);
                                      const byDay = new Map<string, string[]>();
                                      for (const l of labels) {
                                        const s = String(l);
                                        const [dRaw, restRaw] = s.split(":");
                                        const d = (dRaw || "").trim();
                                        const rest = (restRaw || "").trim();
                                        if (!d) continue;
                                        if (!byDay.has(d)) byDay.set(d, []);
                                        if (rest) byDay.get(d)!.push(rest);
                                      }
                                      const entries = Array.from(byDay.entries());
                                      return entries.length ? (
                                        <div className="mt-1 flex gap-1 overflow-x-auto whitespace-nowrap">
                                          {entries.map(([d, segs]) => (
                                            <Badge key={d} className={`${dayBadgeClass(d)} inline-flex whitespace-nowrap`}>
                                              {d}
                                              {segs.length ? `: ${segs.join(" · ")}` : ""}
                                            </Badge>
                                          ))}
                                        </div>
                                      ) : null;
                                    })()}
                                    {gr.docentes ? (
                                      <div className="text-xs font-semibold text-gray-700 dark:text-gray-200 mt-1">Docente:{" "}{gr.docentes}</div>
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
                <div className="text-sm text-red-600 dark:text-red-400">{error}</div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
