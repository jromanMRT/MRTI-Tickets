import axios from 'axios';
import jwt from 'jsonwebtoken';

type IntrospectResult = { active: boolean; user?: any };

export async function introspectToken(token: string): Promise<IntrospectResult> {
  const profileUrl = process.env.AUTH_PROFILE_URL;
  if (profileUrl) {
    try {
      const resp = await axios.get(profileUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const profile = resp.data?.profile;
      if (!profile) return { active: false };
      const roleNames: Record<string, string> = {
        administrator: 'Administrador',
        supervisor: 'Supervisor',
        technician: 'Técnico',
        viewer: 'Consulta',
      };
      return {
        active: true,
        user: {
          ...profile,
          name: profile.full_name,
          roles: [roleNames[profile.role] || profile.role],
        },
      };
    } catch {
      return { active: false };
    }
  }

  const introspectUrl = process.env.CORE_INTROSPECT_URL;
  if (introspectUrl) {
    try {
      const resp = await axios.post(introspectUrl, { token });
      return resp.data;
    } catch {
      return { active: false };
    }
  }

  // Fallback: verify locally with a public key if provided
  const pubKey = process.env.JWT_PUBLIC_KEY;
  if (pubKey) {
    try {
      const decoded = jwt.verify(token, pubKey as string);
      return { active: true, user: decoded };
    } catch {
      return { active: false };
    }
  }

  return { active: false };
}

export async function getTicketContext(token: string): Promise<any> {
  const contextUrl = process.env.AUTH_TICKET_CONTEXT_URL
    || process.env.AUTH_PROFILE_URL?.replace(/\/me$/, '/ticket-context');
  if (!contextUrl) return null;
  const response = await axios.get(contextUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data || null;
}
