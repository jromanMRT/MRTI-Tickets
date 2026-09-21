import { useEffect, useState } from 'react';

interface PortalApplication { code: string; name: string; url: string }

function applicationHref(application: PortalApplication) {
  if (application.code !== 'agent-core') return application.url;
  return `${application.url}#token=${encodeURIComponent(localStorage.getItem('auth_token') || '')}&theme=${encodeURIComponent(localStorage.getItem('mrti_theme') || '')}`;
}

export function ModuleSwitcher() {
  const [applications, setApplications] = useState<PortalApplication[]>([]);
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) return;
    fetch('/api/portal/v1/applications', { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then(({ data }) => setApplications(Array.isArray(data) ? data : []))
      .catch(() => setApplications([]));
  }, []);
  return <label className="header-module-switcher"><span>Cambiar módulo</span><select value="" onChange={(event) => { if (event.target.value) window.location.assign(event.target.value); }} aria-label="Cambiar de módulo"><option value="" disabled>MRTI Tickets</option><option value="/mi-espacio">Mi espacio</option>{applications.filter((application) => application.code !== 'tickets').map((application) => <option key={application.code} value={applicationHref(application)}>{application.name}</option>)}</select></label>;
}
