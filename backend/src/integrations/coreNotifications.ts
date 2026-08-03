import axios from 'axios';

const notifyUrl = process.env.CORE_NOTIFICATION_URL;

// TODO(deuda técnica): MRTI-Infra no tiene un endpoint genérico de eventos
// externos — /api/notifications solo lista y marca como leídas sus propias
// alertas de monitoreo (tabla alerts), requiere JWT de usuario, y no acepta
// POSTs para crear notificaciones. Falla en silencio hoy. El único caller
// (agentEvents.ts) es código huérfano sin llamador real; ver TODO en
// mrtiInfraClient.ts antes de construir el endpoint del lado de MRTI-Infra.
export async function sendNotification(event: string, payload: any) {
  if (!notifyUrl) return false;
  try {
    await axios.post(notifyUrl, { event, payload });
    return true;
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.warn('Core notification failed', err?.message || err);
    return false;
  }
}
