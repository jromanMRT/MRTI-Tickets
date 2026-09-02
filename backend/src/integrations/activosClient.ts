import axios from 'axios';

const base = process.env.MRTI_ACTIVOS_API_URL;
const TIMEOUT_MS = 4000;

export type AssetSummary = {
  id: number;
  asset_uid: string;
  center_code: string;
  descripcion: string | null;
  tipo: string | null;
  marca: string | null;
  modelo: string | null;
  service_tag: string | null;
  numero_serie: string | null;
  estado: string | null;
  unidad: string | null;
  empresa: string | null;
  usuario_asignado: string | null;
  physical_area_id: string | null;
};

type ValidateResult =
  | { status: 'valid'; asset: AssetSummary }
  | { status: 'not_found' }
  | { status: 'unavailable' };

// Autoservicio de Activos (GET /api/activos-self/uid/:assetUid) -- no exige
// el módulo completo de Activos, solo una sesión válida o la llave de
// servicio compartida. Nunca lanza: "no disponible" no debe bloquear la
// creación de un ticket (el asset_uid se guarda igual, sin verificar, y
// queda pendiente de conciliación); "no existe" sí se traduce en rechazo
// explícito en quien llama -- nunca se inventa una coincidencia.
export async function validateAssetUid(assetUid: string, opts: { userToken?: string } = {}): Promise<ValidateResult> {
  if (!base) return { status: 'unavailable' };
  const headers: Record<string, string> = opts.userToken
    ? { Authorization: `Bearer ${opts.userToken}` }
    : { 'X-Service-Key': process.env.INTERNAL_SERVICE_KEY || '' };
  try {
    const resp = await axios.get(`${base}/api/activos-self/uid/${encodeURIComponent(assetUid)}`, {
      headers,
      timeout: TIMEOUT_MS,
      validateStatus: () => true,
    });
    if (resp.status === 200 && resp.data?.data) return { status: 'valid', asset: resp.data.data };
    if (resp.status === 404) return { status: 'not_found' };
    return { status: 'unavailable' };
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.warn('MRTI-Activos fetch failed', err?.message || err);
    return { status: 'unavailable' };
  }
}
