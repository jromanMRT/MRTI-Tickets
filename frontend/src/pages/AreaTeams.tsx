import { FormEvent, useEffect, useState } from 'react';
import api from '../services/api';

interface BusinessArea { id: number; name: string; code: string }
interface Person { id: string; full_name: string; role: string }
interface Member { user_id: string; user_name?: string; created_at: string }

export default function AreaTeams() {
  const [areas, setAreas] = useState<BusinessArea[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [selectedArea, setSelectedArea] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([api.get('/business-areas'), api.get('/assignees')])
      .then(([areaResponse, peopleResponse]) => {
        const nextAreas = areaResponse.data.data || [];
        setAreas(nextAreas); setPeople(peopleResponse.data.data || []);
        if (nextAreas.length) setSelectedArea(String(nextAreas[0].id));
      }).catch((requestError) => setError(requestError.response?.data?.error?.message || 'No se pudo cargar la configuración'));
  }, []);

  useEffect(() => {
    if (!selectedArea) return;
    api.get(`/business-areas/${selectedArea}/members`)
      .then((response) => { setMembers(response.data.data || []); setError(''); })
      .catch((requestError) => setError(requestError.response?.data?.error?.message || 'No se pudo cargar el equipo'));
  }, [selectedArea]);

  async function addMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    const form = event.currentTarget;
    const personId = String(new FormData(form).get('person_id') || '');
    const person = people.find((item) => item.id === personId);
    if (!person) { setBusy(false); return; }
    try {
      await api.post(`/business-areas/${selectedArea}/members`, { user_id: person.id, user_name: person.full_name });
      const response = await api.get(`/business-areas/${selectedArea}/members`);
      setMembers(response.data.data || []); form.reset();
    } catch (requestError: any) {
      setError(requestError.response?.data?.error?.message || 'No se pudo agregar a la persona');
    } finally { setBusy(false); }
  }

  async function removeMember(member: Member) {
    setBusy(true); setError('');
    try {
      await api.delete(`/business-areas/${selectedArea}/members/${encodeURIComponent(member.user_id)}`);
      setMembers((current) => current.filter((item) => item.user_id !== member.user_id));
    } catch (requestError: any) {
      setError(requestError.response?.data?.error?.message || 'No se pudo quitar a la persona');
    } finally { setBusy(false); }
  }

  const available = people.filter((person) => !members.some((member) => member.user_id === person.id));
  const areaName = areas.find((area) => String(area.id) === selectedArea)?.name || 'área';

  return <div className="page-stack narrow">
    <div className="page-header"><div><p className="eyebrow">Seguridad por área</p><h1>Equipos de atención</h1><p className="subtitle">Sólo estas personas podrán ver y resolver los tickets enviados a su área.</p></div></div>
    {error && <div className="form-error">{error}</div>}
    <section className="panel area-team-panel">
      <label>Área de atención<select value={selectedArea} onChange={(event) => setSelectedArea(event.target.value)}>{areas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}</select></label>
      <form className="area-team-add" onSubmit={addMember}>
        <label>Agregar integrante<select name="person_id" required defaultValue=""><option value="" disabled>Seleccionar persona</option>{available.map((person) => <option key={person.id} value={person.id}>{person.full_name} · {person.role}</option>)}</select></label>
        <button className="button" disabled={busy || !available.length}>{available.length ? 'Agregar al equipo' : 'No hay personas disponibles'}</button>
      </form>
      <div className="area-member-list"><h2>Integrantes de {areaName} <span className="count">{members.length}</span></h2>
        {members.length ? members.map((member) => <div key={member.user_id}><span><strong>{member.user_name || member.user_id}</strong><small>Puede consultar, comentar, asignar y resolver tickets de {areaName}.</small></span><button className="button ghost" type="button" disabled={busy} onClick={() => void removeMember(member)}>Quitar</button></div>) : <div className="empty-state compact"><h2>Sin integrantes</h2><p>Ningún operador podrá ver los tickets de esta área hasta agregar al menos una persona. Los administradores globales conservan acceso.</p></div>}
      </div>
    </section>
  </div>;
}
