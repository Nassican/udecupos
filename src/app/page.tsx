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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Periodo = { codigo: string; nombre: string };
type Programa = { codigo: string; nombre: string };
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
  const [programas, setProgramas] = useState<Programa[]>([]);
  const [programa, setPrograma] = useState<string>("");
  const [materias, setMaterias] = useState<Materia[]>([]);
  const [materia, setMateria] = useState<string>("");
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
                <Select value={periodo} onValueChange={onPeriodoChange} disabled={loadingP}>
                  <SelectTrigger className="w-full h-auto min-h-9 items-start text-left">
                    <SelectValue className="whitespace-normal wrap-break-word" placeholder="Seleccione un periodo" />
                  </SelectTrigger>
                  <SelectContent>
                    {periodos.map((p) => (
                      <SelectItem key={p.codigo} value={p.codigo}>
                        {p.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>Programa</Label>
                <Select value={programa} onValueChange={onProgramaChange} disabled={!periodo || loadingG}>
                  <SelectTrigger className="w-full h-auto min-h-9 items-start text-left">
                    <SelectValue className="whitespace-normal wrap-break-word" placeholder="Seleccione un programa" />
                  </SelectTrigger>
                  <SelectContent>
                    {programas.map((g) => (
                      <SelectItem key={g.codigo} value={g.codigo}>
                        {g.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>Materia</Label>
                <Select value={materia} onValueChange={onMateriaChange} disabled={!programa || loadingM}>
                  <SelectTrigger className="w-full h-auto min-h-9 items-start text-left">
                    <SelectValue className="whitespace-normal wrap-break-word" placeholder="Seleccione una materia" />
                  </SelectTrigger>
                  <SelectContent>
                    {materias.map((m) => (
                      <SelectItem key={m.codigo} value={m.codigo}>
                        {m.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>Modalidad</Label>
                <Select value={modalidad} onValueChange={onModalidadChange} disabled={!materia || loadingMod}>
                  <SelectTrigger className="w-full h-auto min-h-9 items-start text-left">
                    <SelectValue className="whitespace-normal wrap-break-word" placeholder="Seleccione una modalidad" />
                  </SelectTrigger>
                  <SelectContent>
                    {modalidades.map((mo) => (
                      <SelectItem key={mo.codigo} value={mo.codigo}>
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
                    {grupos.map((gr) => {
                      const selected = grupo === gr.codigo;
                      const titulo = gr.grupo ? `G${gr.grupo}` : `G${gr.codigo}`;
                      const horarioFull = gr.mergedSlots?.length
                        ? gr.mergedSlots.join(" • ")
                        : gr.horario?.join(" • ") || "";
                      return (
                        <Card
                          key={gr.codigo}
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
