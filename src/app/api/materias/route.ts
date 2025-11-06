import { NextResponse } from 'next/server';
import { http } from '../../../lib/http';
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

async function fetchMaterias(programId: string, periodId: string) {
  const form = new URLSearchParams();
  form.append('rs', 'ajax_Cupos_estudiantes_refresh_cod_carrera_cam');
  form.append('rst', '');
  form.append('rsrnd', Date.now().toString());
  form.append('rsargs[]', programId); // cod_carrera_cam
  form.append('rsargs[]', periodId);  // id_periodosapiens
  form.append('rsargs[]', '');        // cod_materia_cam
  form.append('rsargs[]', '');        // tipo_modalidad
  form.append('rsargs[]', 'cod_materia_cam_#fld#_tipo_modalidad_#fld#_grupo_cam'); // nmgp_refresh_fields
  form.append('rsargs[]', '5449');    // script_case_init

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

  const fld = payload.fldList?.find((f) => f.fldName === 'cod_materia_cam');
  if (!fld) return NextResponse.json({ materias: [] });

  const htmlOptions = String(fld.optList || '').replace(/<\\\s*\/\s*/g, '</');
  const $ = load(`<select>${htmlOptions}</select>`);
  const materias = $('option')
    .map((_, el) => {
      const value = ($(el).attr('value') || '').trim();
      const text = normalizeText($(el).text());
      if (!value) return null;
      // Parse: "NOMBRE(1234)" -> titulo
      const m = text.match(/^\s*([^\(]+)\s*\(([^\)]*)\)\s*$/);
      const titulo = m?.[1]?.trim() || text;
      const label = titulo;
      return { codigo: value, nombre: text, titulo, label };
    })
    .get()
    .filter(Boolean);

  return NextResponse.json({ materias });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const programId = searchParams.get('programId');
  const periodId = searchParams.get('periodId');
  if (!programId || !periodId) {
    return NextResponse.json({ error: 'Faltan programId o periodId' }, { status: 400 });
  }
  return fetchMaterias(programId, periodId);
}

export async function POST(req: Request) {
  let programId = '';
  let periodId = '';
  // Prefer JSON body { programId, periodId }
  try {
    const body = await req.json().catch(() => null);
    if (body) {
      if (typeof body.programId === 'string') programId = body.programId;
      if (typeof body.periodId === 'string') periodId = body.periodId;
    }
  } catch {
    // ignore
  }
  // Fallback a x-www-form-urlencoded
  if (!programId || !periodId) {
    const text = await req.text().catch(() => '');
    if (text) {
      const sp = new URLSearchParams(text);
      const p1 = sp.get('programId');
      const p2 = sp.get('periodId');
      if (p1) programId = p1;
      if (p2) periodId = p2;
    }
  }
  if (!programId || !periodId) {
    return NextResponse.json({ error: 'Faltan programId o periodId' }, { status: 400 });
  }
  return fetchMaterias(programId, periodId);
}
