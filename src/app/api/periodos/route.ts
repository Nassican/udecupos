import { NextResponse } from 'next/server';
import { http } from '../../../lib/http';
import { getCache, setCache } from '../../../lib/cache';
import iconv from 'iconv-lite';
import { load } from 'cheerio';

export async function GET() {
  const cacheKey = 'periodos';
  const cached = getCache<{ periodos: Array<{ codigo: string; nombre: string }> }>(cacheKey);
  if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'public, max-age=300', 'X-Cache': 'HIT' } });
  const res = await http.get('/ocara2022/Cupos_estudiantes/');
  const html = iconv.decode(Buffer.from(res.data), 'ISO-8859-1');
  const $ = load(html);

  const select = $('#id_sc_field_id_periodosapiens').length
    ? $('#id_sc_field_id_periodosapiens')
    : $('select[name="id_periodosapiens"]');

  const items = select
    .find('option')
    .map((_, el) => {
      const value = ($(el).attr('value') || '').trim();
      const text = $(el).text().trim();
      return value ? { codigo: value, nombre: text } : null;
    })
    .get()
    .filter(Boolean);
  const payload = { periodos: items };
  setCache(cacheKey, payload);
  return NextResponse.json(payload, { headers: { 'Cache-Control': 'public, max-age=300', 'X-Cache': 'MISS' } });
}
