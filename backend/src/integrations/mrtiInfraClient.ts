import axios from 'axios';

const base = process.env.MRTI_INFRA_API_URL;

// TODO(deuda técnica): /api/devices/:id nunca existió en MRTI-Infra (que expone
// dispositivos vía /api/db/devices, con UUID en vez de id numérico), y nada
// llama hoy al webhook que invoca esta función — falla en silencio y no
// bloquea la creación del ticket. No implementar hasta definir con MRTI-Infra
// un endpoint autenticado por clave de servicio y el esquema real de id de
// equipo que usará quien dispare ese webhook.
export async function getDeviceInfo(deviceId: number) {
  if (!base) return null;
  try {
    const resp = await axios.get(`${base}/api/devices/${deviceId}`);
    return resp.data?.data || null;
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.warn('MRTI-Infra fetch failed', err?.message || err);
    return null;
  }
}
