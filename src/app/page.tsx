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
  const [materiaOpen, setMateriaOpen] = useState(false);
  const [modalidades, setModalidades] = useState<Modalidad[]>([]);
  const [modalidad, setModalidad] = useState<string>("");
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [grupo, setGrupo] = useState<string>("");
  const [loadingP, setLoadingP] = useState(false);
  const [loadingG, setLoadingG] = useState(false);
  const [loadingM, setLoadingM] = useState(false);
  const [loadingMod, setLoadingMod] = useState(false);
  const [loadingGpo, setLoadingGpo] = useState(false);
  const [error, setError] = useState<string>("");

  const sedeBadgeClass = (s?: string) => {
    const key = (s || "").toLowerCase();
    if (key.includes("pasto")) return "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200 border-transparent";
    if (key.includes("tumaco")) return "bg-sky-100 text-sky-900 dark:bg-sky-900/30 dark:text-sky-200 border-transparent";
    if (key.includes("ipiales")) return "bg-violet-100 text-violet-900 dark:bg-violet-900/30 dark:text-violet-200 border-transparent";
    if (key.includes("tuquerres")) return "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200 border-transparent";
    if (key.includes("general")) return "bg-zinc-100 text-zinc-900 dark:bg-zinc-800/60 dark:text-zinc-200 border-transparent";
    return "bg-secondary text-secondary-foreground";
  };

  // Extra safeguard: on mobile, blur any focused element when opening selection dialogs
  useEffect(() => {
    if (periodoOpen || programaOpen || materiaOpen) {
      if (typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches) {
        setTimeout(() => {
          const el = document.activeElement as HTMLElement | null;
          el?.blur?.();
        }, 0);
      }
    }
  }, [periodoOpen, programaOpen, materiaOpen]);

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
    setModalidad("");
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
    setModalidad("");
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
    setModalidad("");
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

  const onModalidadChange = async (value: string) => {
    setModalidad(value);
    setGrupos([]);
    setGrupo("");
    if (!value || !periodo || !programa || !materia) return;
    try {
      setLoadingGpo(true);
      const res = await fetch(`/api/grupos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modalidadId: value, periodId: periodo, programId: programa, materiaId: materia })
      });
      const data = await res.json();
      setGrupos(data.grupos || []);
    } catch {
      setError("No se pudieron cargar los grupos");
    } finally {
      setLoadingGpo(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-50">
      <div className="mx-auto max-w-3xl p-6">
        <Card>
          <CardHeader>
            <CardTitle>Consulta de Cupos - Demo</CardTitle>
          </CardHeader>
          <CardContent>
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
                {/* Mobile: Dialog + Command */}
                <div className="block md:hidden">
                  <Button
                    variant="outline"
                    onClick={() => setMateriaOpen(true)}
                    disabled={!programa || loadingM}
                    className="w-full h-auto min-h-9 items-start justify-between text-left whitespace-normal wrap-break-word font-normal"
                  >
                    <span className="p-0">
                      {materia
                        ? materias.find((m) => m.codigo === materia)?.nombre || "Materia"
                        : "Seleccione una materia"}
                    </span>
                    <span className="text-muted-foreground"><ChevronDownIcon className="w-4 h-4" /></span>
                  </Button>
                  <Dialog open={materiaOpen} onOpenChange={setMateriaOpen}>
                    <DialogContent className="p-0 gap-0" onOpenAutoFocus={(e) => e.preventDefault()}>
                      <DialogHeader className="px-4 pt-4 pb-2">
                        <DialogTitle>Seleccionar materia</DialogTitle>
                      </DialogHeader>
                      <Command>
                        <CommandInput autoFocus={false} placeholder="Buscar materia..." />
                        <CommandList>
                          <CommandEmpty>No se encontraron materias</CommandEmpty>
                          <CommandGroup>
                            {materias.map((m, i) => (
                              <CommandItem
                                key={`${m.codigo}-${i}`}
                                value={m.nombre}
                                onSelect={() => {
                                  setMateriaOpen(false);
                                  onMateriaChange(m.codigo);
                                }}
                              >
                                {m.nombre}
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
                  <Select value={materia} onValueChange={onMateriaChange} disabled={!programa || loadingM}>
                    <SelectTrigger className="w-full h-auto min-h-9 items-start text-left">
                      <SelectValue className="whitespace-normal wrap-break-word md:line-clamp-2" placeholder="Seleccione una materia" />
                    </SelectTrigger>
                    <SelectContent>
                      {materias.map((m, i) => (
                        <SelectItem key={`${m.codigo}-${i}`} value={m.codigo}>
                          {m.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Modalidad</Label>
                <Select value={modalidad} onValueChange={onModalidadChange} disabled={!materia || loadingMod}>
                  <SelectTrigger className="w-full h-auto min-h-9 items-start text-left">
                    <SelectValue className="whitespace-normal wrap-break-word" placeholder="Seleccione una modalidad" />
                  </SelectTrigger>
                  <SelectContent>
                    {modalidades.map((mo, i) => (
                      <SelectItem key={`${mo.codigo}-${i}`} value={mo.codigo}>
                        {mo.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>Grupo (horario)</Label>
                {loadingGpo ? (
                  <div className="text-sm text-muted-foreground">Cargando grupos...</div>
                ) : !modalidad ? (
                  <div className="text-sm text-muted-foreground">Seleccione una modalidad</div>
                ) : grupos.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No hay grupos disponibles</div>
                ) : (
                  <div className="grid gap-2">
                    {grupos.map((gr, i) => {
                      const selected = grupo === gr.codigo;
                      const titulo = gr.grupo ? `G${gr.grupo}` : `G${gr.codigo}`;
                      const horarioFull = gr.mergedSlots?.length
                        ? gr.mergedSlots.join(" • ")
                        : gr.horario?.join(" • ") || "";
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
                                {titulo}
                                {gr.sede ? (
                                  <span className="text-muted-foreground"> • {gr.sede}</span>
                                ) : null}
                              </div>
                              {gr.ocupacion ? (
                                <Badge
                                  variant={gr.ocupacion.endsWith("/20") && gr.ocupacion.startsWith("20") ? "destructive" : "secondary"}
                                >
                                  {gr.ocupacion}
                                </Badge>
                              ) : null}
                            </div>
                            {horarioFull ? (
                              <div className="text-xs text-muted-foreground mt-1">{horarioFull}</div>
                            ) : null}
                            {gr.docentes ? (
                              <div className="text-xs text-muted-foreground">{gr.docentes}</div>
                            ) : null}
                          </CardContent>
                        </Card>
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
