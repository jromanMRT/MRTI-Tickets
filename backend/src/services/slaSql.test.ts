import { describe, expect, it } from 'vitest';
import { slaIsAtRiskSql, slaIsOverdueSql, slaStateCaseSql, SLA_DEADLINE_SQL, SLA_POLICY_RESOLUTION_SQL } from './slaSql';

describe('fragmentos SQL de SLA', () => {
  it('el estado vencido/en riesgo siempre exige que el ticket no esté pausado', () => {
    expect(slaIsOverdueSql()).toContain('t.sla_paused_since IS NULL');
    expect(slaIsAtRiskSql()).toContain('t.sla_paused_since IS NULL');
  });

  it('el vencimiento efectivo suma los minutos de la política y los pausados', () => {
    expect(SLA_DEADLINE_SQL).toContain('sp.resolution_minutes');
    expect(SLA_DEADLINE_SQL).toContain('t.sla_paused_minutes');
    expect(SLA_DEADLINE_SQL).toContain('t.sla_paused_since');
  });

  it('el CASE de estado revisa pausado antes que vencido/en riesgo, y completado antes que todo', () => {
    const sql = slaStateCaseSql("'RESOLVED','CLOSED'");
    const completedIndex = sql.indexOf("THEN 'completed'");
    const pausedIndex = sql.indexOf("THEN 'paused'");
    const overdueIndex = sql.indexOf("THEN 'overdue'");
    const atRiskIndex = sql.indexOf("THEN 'at_risk'");
    expect(completedIndex).toBeGreaterThan(-1);
    expect(completedIndex).toBeLessThan(pausedIndex);
    expect(pausedIndex).toBeLessThan(overdueIndex);
    expect(overdueIndex).toBeLessThan(atRiskIndex);
    expect(sql).toContain("'RESOLVED','CLOSED'");
  });

  it('la resolución de política de SLA prefiere categoría, luego área, luego la genérica', () => {
    expect(SLA_POLICY_RESOLUTION_SQL).toContain('priority_code = ?');
    expect(SLA_POLICY_RESOLUTION_SQL).toContain('category_id = ? OR category_id IS NULL');
    expect(SLA_POLICY_RESOLUTION_SQL).toContain('business_area_id = ? OR business_area_id IS NULL');
    const categoryOrderIndex = SLA_POLICY_RESOLUTION_SQL.indexOf('category_id IS NOT NULL');
    const areaOrderIndex = SLA_POLICY_RESOLUTION_SQL.indexOf('business_area_id IS NOT NULL) DESC');
    expect(categoryOrderIndex).toBeGreaterThan(-1);
    expect(categoryOrderIndex).toBeLessThan(areaOrderIndex);
  });
});
