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

async function fetchProgramas(periodId: string) {
  const form = new URLSearchParams();
  form.append('rs', 'ajax_Cupos_estudiantes_refresh_id_periodosapiens');
  form.append('rst', '');
  form.append('rsrnd', Date.now().toString());
  form.append('rsargs[]', periodId);
  form.append('rsargs[]', '');
  form.append('rsargs[]', '');
  form.append('rsargs[]', '');
  form.append('rsargs[]', 'cod_carrera_cam_#fld#_cod_materia_cam_#fld#_grupo_cam');
  form.append('rsargs[]', '5449');

  const res = await http.post('/ocara2022/Cupos_estudiantes/', form.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' }
  });

  const body = iconv.decode(Buffer.from(res.data), 'ISO-8859-1');
  const m = body.match(/var\s+res\s*=\s*'([\s\S]*?)';/);
  if (!m) return NextResponse.json({ error: 'No se pudo interpretar la respuesta' }, { status: 502 });

  const jsStringLiteral = m[1];
  // Decodificar el string de JS (entre comillas simples) a texto JSON
  const jsonText = jsStringLiteral
    .replace(/\\\\/g, "\\")   // \\\\ -> \\
    .replace(/\\n/g, "\n")       // \n -> salto de línea
    .replace(/\\r/g, "\r")       // \r -> retorno
    .replace(/\\t/g, "\t")       // \t -> tab
    .replace(/\\\"/g, '"')       // \" -> "
    .replace(/\\\'/g, "'");      // \\' -> '

  let payload: AjaxPayload;
  try {
    let txt = jsonText.trim();
    if (txt.startsWith(':')) txt = txt.slice(1).trim();
    payload = JSON.parse(txt);
  } catch {
    return NextResponse.json({ error: 'JSON inválido en la respuesta', raw: jsonText.slice(0, 400) }, { status: 502 });
  }

  const fld = payload.fldList?.find((f) => f.fldName === 'cod_carrera_cam');
  if (!fld) return NextResponse.json({ programas: [] });

  const htmlOptions = String(fld.optList || '').replace(/<\\\s*\/\s*/g, '</');
  const $ = load(`<select>${htmlOptions}</select>`);
  const programas = $('option')
    .map((_, el) => {
      const value = ($(el).attr('value') || '').trim();
      const text = normalizeText($(el).text());
      if (!value) return null;
      // Parse: "34-INGENIERIA DE SISTEMAS(PASTO)"
      const m = text.match(/^\s*\d+\s*-\s*([^\(]+)\s*(?:\(([^\)]*)\))?/);
      const titulo = m?.[1]?.trim() || text;
      const sede = m?.[2]?.trim();
      const label = sede ? `${value} (${sede}) ${titulo}` : titulo;
      return { codigo: value, nombre: text, titulo, sede, label };
    })
    .get()
    .filter(Boolean);

  return NextResponse.json({ programas });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const periodId = searchParams.get('periodId');
  if (!periodId) {
    return NextResponse.json({ error: 'Falta periodId' }, { status: 400 });
  }
  return fetchProgramas(periodId);
}

export async function POST(req: Request) {
  let periodId = '';
  // Prefer JSON body { periodId }
  try {
    const body = await req.json().catch(() => null);
    if (body && typeof body.periodId === 'string') {
      periodId = body.periodId;
    }
  } catch {
    // ignore
  }
  // Fallback a x-www-form-urlencoded
  if (!periodId) {
    const text = await req.text().catch(() => '');
    if (text) {
      const sp = new URLSearchParams(text);
      const p = sp.get('periodId');
      if (p) periodId = p;
    }
  }
  if (!periodId) {
    return NextResponse.json({ error: 'Falta periodId' }, { status: 400 });
  }
  return fetchProgramas(periodId);
}
