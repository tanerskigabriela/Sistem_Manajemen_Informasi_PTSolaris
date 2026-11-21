import type { Request } from 'express';

export interface RequestMeta {
  device: string;
  ip_address: string;
}

/**
 * Mengambil ringkasan perangkat dan IP client untuk sessions & activity_logs.
 * `device` selalu berisi string non-kosong (maks 150 karakter) karena
 * kolom app.sessions.device dan parameter @device di sp_record_login NOT NULL.
 */
export function getRequestMeta(req: Request): RequestMeta {
  const rawUa = req.get('user-agent')?.trim();
  const device = (rawUa && rawUa.length > 0 ? rawUa : 'Unknown Device').slice(
    0,
    150,
  );
  const ip_address = (req.ip ?? req.socket.remoteAddress ?? '0.0.0.0').slice(
    0,
    45,
  );

  return { device, ip_address };
}