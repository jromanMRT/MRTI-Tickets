import axios from 'axios';

const base = process.env.MRTI_INFRA_API_URL;

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
