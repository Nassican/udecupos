"use client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Minus, Plus } from "lucide-react";

export type GroupLike = {
  codigo: string;
  grupo?: string;
  sede?: string;
  ocupacion?: string;
  mergedSlots?: string[];
  horario?: string[];
  docentes?: string;
};

export type GroupCardProps = {
  gr: GroupLike;
  keyId: string;
  titulo: string;
  isActiveSelected: boolean; // highlight ring if selected in list
  isInHorario: boolean; // whether added to timetable
  sedeBadgeClass: (s?: string) => string;
  ocupacionBadgeClass: (s?: string) => string;
  dayBadgeClass?: (d: string) => string;
  onToggleClick: () => void;
};

export default function GroupCard({
  gr,
  keyId,
  titulo,
  isActiveSelected,
  isInHorario,
  sedeBadgeClass,
  ocupacionBadgeClass,
  dayBadgeClass,
  onToggleClick,
}: GroupCardProps) {
  const labels = gr.mergedSlots?.length ? gr.mergedSlots : gr.horario || [];
  const byDay = new Map<string, string[]>();
  for (const l of labels) {
    const s = String(l || "");
    const [dRaw, restRaw] = s.split(":");
    const d = (dRaw || "").trim();
    const rest = (restRaw || "").trim();
    if (!d) continue;
    if (!byDay.has(d)) byDay.set(d, []);
    if (rest) byDay.get(d)!.push(rest);
  }
  const dayEntries = Array.from(byDay.entries());

  return (
    <Card
      key={keyId}
      data-selected={isActiveSelected}
      className={`relative cursor-pointer transition-shadow p-0 ${
        isActiveSelected ? "border-ring ring-2 ring-ring/50" : "hover:shadow-sm"
      } ${isInHorario ? "border border-emerald-500 bg-emerald-50/40 dark:bg-emerald-900/10" : ""}`}
    >
      <CardContent className="p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-medium">
            <Badge className="align-middle inline-block bg-primary text-primary-foreground border-transparent">
              {titulo}
            </Badge>
            {gr.sede ? (
              <span className="ml-1 align-middle inline-block">
                <Badge className={sedeBadgeClass(gr.sede)}>{gr.sede}</Badge>
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            {gr.ocupacion ? (
              <Badge className={ocupacionBadgeClass(gr.ocupacion)}>
                {gr.ocupacion}
              </Badge>
            ) : null}
            <Button
              size="icon"
              variant="ghost"
              aria-label={isInHorario ? "Quitar del horario" : "Agregar al horario"}
              onClick={(e) => {
                e.stopPropagation();
                onToggleClick();
              }}
            >
              {isInHorario ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        {dayEntries.length ? (
          <div className="mt-1 grid gap-1 grid-cols-1 sm:grid-cols-2">
            {dayEntries.map(([d, segs]) => (
              <Badge
                key={d}
                className={`${dayBadgeClass ? dayBadgeClass(d) : ""} w-full justify-start`}
              >
                {d}
                {segs.length ? `: ${segs.join(" · ")}` : ""}
              </Badge>
            ))}
          </div>
        ) : null}
        {gr.docentes ? (
          <div className="text-xs font-semibold text-gray-700 dark:text-gray-200 mt-1">
            Docente: {gr.docentes}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
