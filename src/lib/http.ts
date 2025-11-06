import axios from 'axios';

export const http = axios.create({
  baseURL: 'https://matriculas.udenar.edu.co',
  timeout: 20000,
  headers: {
    'User-Agent': 'Mozilla/5.0',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'es-ES,es;q=0.9',
    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
  },
  responseType: 'arraybuffer',
  validateStatus: s => s >= 200 && s < 300
});

