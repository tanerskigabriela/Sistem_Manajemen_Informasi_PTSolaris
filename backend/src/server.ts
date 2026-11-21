import path from 'path';
import dotenv from 'dotenv';

// Muat .env dari root repositori terlebih dahulu, lalu fallback ke backend/.env bila ada
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

import app from './app';
import { closeAllPools } from './db/pool';

const PORT = Number(process.env.PORT ?? 3000);

const server = app.listen(PORT, () => {
  console.log(`[Solaris] Server berjalan di http://localhost:${PORT}`);
  console.log(`[Solaris] API v1  : http://localhost:${PORT}/api/v1`);
  console.log(`[Solaris] Swagger : http://localhost:${PORT}/docs`);
});

async function shutdown(signal: string): Promise<void> {
  console.log(`[Solaris] Menerima sinyal ${signal}, menutup server...`);
  server.close(async () => {
    try {
      await closeAllPools();
    } catch (error) {
      console.error('[Solaris] Gagal menutup connection pool:', error);
    } finally {
      process.exit(0);
    }
  });
}

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});
