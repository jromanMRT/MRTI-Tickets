import axios from 'axios';

const base = process.env.MRTI_INFRA_API_URL;
const TIMEOUT_MS = 4000;

// MRTI-Infra (MRTI-Obs) expone el dispositivo por id vía autoservicio
// (GET /api/self/devices/:id) -- corrige la deuda técnica anterior, que
// llamaba a /api/devices/:id, un endpoint que nunca existió (ver historial
// de este archivo). device.asset_id YA es el asset_uid de MRTI-Activos
// (Fase 6 de CORE_INFRA_MIGRATION_GUIDE.md: MRTI-Obs traduce device<->asset).
// Llamada de servicio: no hay usuario navegando en este flujo (evento
// automático de Agent Core), así que se usa la llave compartida.
export async function getDeviceInfo(deviceId: number) {
  if (!base) return null;
  try {
    const resp = await axios.get(`${base}/api/self/devices/${deviceId}`, {
      headers: { 'X-Service-Key': process.env.INTERNAL_SERVICE_KEY || '' },
      timeout: TIMEOUT_MS,
    });
    return resp.data?.data || null;
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.warn('MRTI-Infra fetch failed', err?.message || err);
    return null;
  }
}
