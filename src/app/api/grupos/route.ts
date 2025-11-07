import { NextResponse } from 'next/server';
import { http } from '../../../lib/http';
import { getCache, setCache } from '../../../lib/cache';
import iconv from 'iconv-lite';
import { load } from 'cheerio';

function normalizeText(s: string) {
  try {
    return Buffer.from(s, 'latin1').toString('utf8').trim();
  } catch {
    return s.trim();
  }
}

type FldItem = {
  row: string;
  fldName: string;
  fldType: string;
  numLinha: string;
  valList?: unknown;
  optList?: string;
};

type AjaxPayload = {
  fldList?: FldItem[];
};

type ParsedGrupo = {
  codigo: string;
  nombre: string;
  grupo?: string;
  ocupacion?: string; // e.g., 36/40
  sede?: string;      // e.g., 4-PASTO
  horario?: string[]; // time slots raw array
  docentes?: string;
  label?: string;     // short label for UI
  parsedSlots?: { dia: string; desde: string; hasta: string; ampm?: string; aula?: string; label: string }[];
  mergedSlots?: string[];
};

async function fetchGrupos(modalidadId: string, periodId: string, programId: string, materiaId: string, scriptInit?: string, forceRefresh?: boolean) {
  const cacheKey = `grupos:${modalidadId}:${periodId}:${programId}:${materiaId}:${scriptInit || ''}`;
  if (!forceRefresh) {
    const cached = getCache<{ grupos: Array<{ codigo: string; nombre: string }> }>(cacheKey);
    if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'public, max-age=300', 'X-Cache': 'HIT' } });
  }
  const form = new URLSearchParams();
  form.append('rs', 'ajax_Cupos_estudiantes_refresh_tipo_modalidad');
  form.append('rst', '');
  form.append('rsrnd', Date.now().toString());
  form.append('rsargs[]', modalidadId); // tipo_modalidad
  form.append('rsargs[]', periodId);    // id_periodosapiens
  form.append('rsargs[]', programId);   // cod_carrera_cam
  form.append('rsargs[]', materiaId);   // cod_materia_cam
  form.append('rsargs[]', 'grupo_cam');
  form.append('rsargs[]', scriptInit || ''); // script_case_init (a veces vacío)

  const res = await http.post('/ocara2022/Cupos_estudiantes/', form.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' }
  });

  const body = iconv.decode(Buffer.from(res.data), 'ISO-8859-1');
  const m = body.match(/var\s+res\s*=\s*'([\s\S]*?)';/);
  if (!m) return NextResponse.json({ error: 'No se pudo interpretar la respuesta' }, { status: 502 });

  const jsStringLiteral = m[1];
  const jsonText = jsStringLiteral
    .replace(/\\\\/g, "\\")
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\\"/g, '"')
    .replace(/\\\'/g, "'");

  let payload: AjaxPayload;
  try {
    let txt = jsonText.trim();
    if (txt.startsWith(':')) txt = txt.slice(1).trim();
    payload = JSON.parse(txt);
  } catch {
    return NextResponse.json({ error: 'JSON inválido en la respuesta', raw: jsonText.slice(0, 400) }, { status: 502 });
  }

  const fld = payload.fldList?.find((f) => f.fldName === 'grupo_cam');
  if (!fld) return NextResponse.json({ grupos: [] });

  const htmlOptions = String(fld.optList || '').replace(/<\\\s*\/\s*/g, '</');
  const $ = load(`<select>${htmlOptions}</select>`);
  const grupos: ParsedGrupo[] = $('option')
    .map((_, el) => {
      const value = ($(el).attr('value') || '').trim();
      const raw = normalizeText($(el).text());
      if (!value) return null;

      // Intentar extraer: Grupo:<n>  <ocupacion>-->X-<sede>-  Horario:<slots>  Docente(s):<docentes>
      const out: ParsedGrupo = { codigo: value, nombre: raw };
      try {
        const grupoMatch = raw.match(/Grupo:\s*(\S+)/i);
        const occMatch = raw.match(/\s(\d+\s*\/\s*\d+)\s*-->/);
        const sedeMatch = raw.match(/-->\s*([^\-]+-[^-]+)-/); // ejemplo: 4-PASTO-
        const horarioPart = raw.split(/Horario:/i)[1]?.split(/Docente\(s\):/i)[0]?.trim() || '';
        const docentesPart = raw.split(/Docente\(s\):/i)[1]?.trim() || '';

        // Extraer segmentos tipo: Dia:HH - HH(AM|PM)(Aula)
        const dayNames = '(Lunes|Martes|Miércoles|Miercoles|Jueves|Viernes|Sábado|Sabado|Domingo)';
        const segRegex = new RegExp(`${dayNames}:\\s*([^\n\r]+?)\\)`, 'g');
        const matches: { dia: string; texto: string }[] = [];
        let mSeg: RegExpExecArray | null;
        while ((mSeg = segRegex.exec(horarioPart)) !== null) {
          matches.push({ dia: mSeg[1], texto: mSeg[2] + ')' });
        }

        type Slot = { dia: string; desde: string; hasta: string; ampm?: string; aula?: string; label: string };
        const parsedSlots: Slot[] = matches.map(({ dia, texto }) => {
          // ejemplo texto: "10 - 11AM(A204-... )" o "2 - 3PM(A204-...)"
          const aulaMatch = texto.match(/\(([^\)]*)\)/);
          const aulaRaw = aulaMatch?.[1]?.trim();
          const aula = aulaRaw && aulaRaw !== '-' ? aulaRaw : undefined;
          const tMatch = texto.match(/(\d{1,2})\s*-\s*(\d{1,2})\s*(AM|PM)/i);
          const desde = tMatch ? tMatch[1] : '';
          const hasta = tMatch ? tMatch[2] : '';
          const ampm = tMatch ? tMatch[3].toUpperCase() : undefined;
          const label = `${dia}: ${desde}-${hasta}${ampm ? ampm : ''}${aula ? ` (${aula})` : ''}`;
          return { dia, desde, hasta, ampm, aula, label };
        }).filter(s => s.desde && s.hasta);

        function toMinutes(h: string, ampm?: string) {
          let n = parseInt(h, 10);
          if (!isFinite(n)) return 0;
          if (ampm?.toUpperCase() === 'PM' && n < 12) n += 12;
          if (ampm?.toUpperCase() === 'AM' && n === 12) n = 0;
          return n * 60;
        }

        const orderDay: Record<string, number> = { Lunes:1, Martes:2, 'Miércoles':3, Miercoles:3, Jueves:4, Viernes:5, Sábado:6, Sabado:6, Domingo:7 };
        parsedSlots.sort((a, b) => (orderDay[a.dia]||9) - (orderDay[b.dia]||9) || toMinutes(a.desde, a.ampm) - toMinutes(b.desde, b.ampm));

        // Merge contiguous en mismo dia. Si falta aula en el tramo actual, se infiere del anterior.
        const mergedSlots: Slot[] = [];
        for (const s of parsedSlots) {
          const last = mergedSlots[mergedSlots.length - 1];
          const sameDay = !!last && last.dia === s.dia;
          // Resolver aula actual: si viene vacío y es mismo día, heredar del último tramo
          const resolvedAula = s.aula || (sameDay ? last?.aula : undefined);
          const lastAula = last?.aula;
          const sameAula = !!last && (lastAula || '') === (resolvedAula || '');
          const contiguous = !!last && toMinutes(last.hasta, s.ampm) === toMinutes(s.desde, s.ampm);
          if (last && sameDay && sameAula && contiguous) {
            last.hasta = s.hasta;
            last.ampm = s.ampm || last.ampm;
            // Asegurar que el aula quede propagada si estaba ausente
            if (!last.aula && resolvedAula) last.aula = resolvedAula;
            last.label = `${last.dia}: ${last.desde}-${last.hasta}${last.ampm ? last.ampm : ''}${last.aula ? ` (${last.aula})` : ''}`;
          } else {
            const withResolved: Slot = {
              ...s,
              aula: resolvedAula,
              label: `${s.dia}: ${s.desde}-${s.hasta}${s.ampm ? s.ampm : ''}${resolvedAula ? ` (${resolvedAula})` : ''}`,
            };
            mergedSlots.push(withResolved);
          }
        }

        out.grupo = grupoMatch ? grupoMatch[1] : undefined;
        out.ocupacion = occMatch ? occMatch[1].replace(/\s/g, '') : undefined;
        out.sede = sedeMatch ? sedeMatch[1].trim() : undefined; // p.ej. 4-PASTO
        out.horario = parsedSlots.map(s => s.label);
        out.parsedSlots = parsedSlots;
        out.mergedSlots = mergedSlots.map(s => s.label);
        out.docentes = docentesPart;

        // Etiqueta corta para UI: G<grupo> (<ocupacion>) • <primer tramo> • <docente>
        const firstSlot = out.mergedSlots?.[0] || out.horario?.[0] || '';
        const docenteCorto = docentesPart.split(',')[0] || docentesPart;
        const g = out.grupo || value;
        const occ = out.ocupacion ? ` (${out.ocupacion})` : '';
        const slot = firstSlot ? ` • ${firstSlot}` : '';
        const doc = docenteCorto ? ` • ${docenteCorto}` : '';
        out.label = `G${g}${occ}${slot}${doc}`.trim();
      } catch {
        // si falla el parseo, dejamos solo codigo/nombre
      }

      return out;
    })
    .get()
    .filter(Boolean);

  const out = { grupos };
  setCache(cacheKey, out);
  return NextResponse.json(out, { headers: { 'Cache-Control': 'public, max-age=300', 'X-Cache': 'MISS' } });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const modalidadId = searchParams.get('modalidadId');
  const periodId = searchParams.get('periodId');
  const programId = searchParams.get('programId');
  const materiaId = searchParams.get('materiaId');
  const scriptInit = searchParams.get('scriptInit') || undefined;
  const forceRefresh = (() => {
    const r = (searchParams.get('refresh') || '').toLowerCase();
    return r === '1' || r === 'true';
  })();
  if (!modalidadId || !periodId || !programId || !materiaId) {
    return NextResponse.json({ error: 'Faltan modalidadId, periodId, programId o materiaId' }, { status: 400 });
  }
  return fetchGrupos(modalidadId, periodId, programId, materiaId, scriptInit, forceRefresh);
}

export async function POST(req: Request) {
  let modalidadId = '';
  let periodId = '';
  let programId = '';
  let materiaId = '';
  let scriptInit: string | undefined;
  try {
    const body = await req.json().catch(() => null);
    if (body) {
      if (typeof body.modalidadId === 'string') modalidadId = body.modalidadId;
      if (typeof body.periodId === 'string') periodId = body.periodId;
      if (typeof body.programId === 'string') programId = body.programId;
      if (typeof body.materiaId === 'string') materiaId = body.materiaId;
      if (typeof body.scriptInit === 'string') scriptInit = body.scriptInit;
    }
  } catch { }
  if (!modalidadId || !periodId || !programId || !materiaId) {
    const text = await req.text().catch(() => '');
    if (text) {
      const sp = new URLSearchParams(text);
      modalidadId = sp.get('modalidadId') || modalidadId;
      periodId = sp.get('periodId') || periodId;
      programId = sp.get('programId') || programId;
      materiaId = sp.get('materiaId') || materiaId;
      scriptInit = sp.get('scriptInit') || scriptInit;
    }
  }
  if (!modalidadId || !periodId || !programId || !materiaId) {
    return NextResponse.json({ error: 'Faltan modalidadId, periodId, programId o materiaId' }, { status: 400 });
  }
  return fetchGrupos(modalidadId, periodId, programId, materiaId, scriptInit);
}
