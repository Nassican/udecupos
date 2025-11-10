"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export type MostrarControlsProps = {
  className?: string;
  size?: "sm" | "default";
  showTeacher: boolean;
  showCupos: boolean;
  showDay: boolean;
  showHours: boolean;
  showLugar: boolean;
  onToggleTeacher: () => void;
  onToggleCupos: () => void;
  onToggleDay: () => void;
  onToggleHours: () => void;
  onToggleLugar: () => void;
};

export default function MostrarControls(props: MostrarControlsProps) {
  const {
    className,
    size = "sm",
    showTeacher,
    showCupos,
    showDay,
    showHours,
    showLugar,
    onToggleTeacher,
    onToggleCupos,
    onToggleDay,
    onToggleHours,
    onToggleLugar,
  } = props;
  const [open, setOpen] = useState(false);

  return (
    <div className={className}>
      <div className="hidden md:flex items-center gap-1 text-xs">
        <span className="text-muted-foreground">Mostrar:</span>
        <Button size={size} variant={showTeacher ? "default" : "outline"} onClick={onToggleTeacher}>
          Docente
        </Button>
        <Button size={size} variant={showCupos ? "default" : "outline"} onClick={onToggleCupos}>
          Cupos
        </Button>
        <Button size={size} variant={showDay ? "default" : "outline"} onClick={onToggleDay}>
          Día
        </Button>
        <Button size={size} variant={showHours ? "default" : "outline"} onClick={onToggleHours}>
          Horas
        </Button>
        <Button size={size} variant={showLugar ? "default" : "outline"} onClick={onToggleLugar}>
          Lugar
        </Button>
      </div>
      <div className="flex md:hidden items-center gap-1 text-xs">
        <Button size={size} variant="outline" onClick={() => setOpen(true)}>
          Mostrar
        </Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="p-4 gap-3" onOpenAutoFocus={(e) => e.preventDefault()}>
            <DialogHeader>
              <DialogTitle>Mostrar</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={showTeacher} onChange={onToggleTeacher} />
                <span>Docente</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={showCupos} onChange={onToggleCupos} />
                <span>Cupos</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={showDay} onChange={onToggleDay} />
                <span>Día</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={showHours} onChange={onToggleHours} />
                <span>Horas</span>
              </label>
              <label className="flex items-center gap-2 col-span-2">
                <input type="checkbox" checked={showLugar} onChange={onToggleLugar} />
                <span>Lugar</span>
              </label>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
