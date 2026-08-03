import axios from 'axios';

const notifyUrl = process.env.CORE_NOTIFICATION_URL;

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
