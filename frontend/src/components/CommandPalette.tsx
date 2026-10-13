import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Command } from 'cmdk';
import {
  Home, ClipboardList, Plus, BookOpen, Clock, Search,
  Sun, Moon, ArrowRight,
} from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';

interface CommandPaletteProps {
  permissions: { can: (path: string, method?: string) => boolean };
  profile: { role?: string };
}

export function CommandPalette({ permissions, profile }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const [theme, setTheme] = useTheme();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const go = useCallback(
    (path: string) => {
      setOpen(false);
      navigate(path);
    },
    [navigate],
  );

  const toggleTheme = useCallback(() => {
    setOpen(false);
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Comando rápido"
      className="cmd-dialog"
    >
      <div className="cmd-header">
        <Search className="cmd-search-icon" />
        <Command.Input placeholder="Buscar página, acción…" className="cmd-input" />
        <kbd className="cmd-kbd">ESC</kbd>
      </div>

      <Command.List className="cmd-list">
        <Command.Empty className="cmd-empty">Sin resultados.</Command.Empty>

        <Command.Group heading="Navegación" className="cmd-group">
          {permissions.can('/') && (
            <Command.Item onSelect={() => go('/')} className="cmd-item">
              <Home className="cmd-icon" /> Resumen (Dashboard)
            </Command.Item>
          )}
          {permissions.can('/tickets') && (
            <Command.Item onSelect={() => go('/tickets')} className="cmd-item">
              <ClipboardList className="cmd-icon" /> Todos los tickets
            </Command.Item>
          )}
          {permissions.can('/tickets/new', 'POST') && (
            <Command.Item onSelect={() => go('/tickets/new')} className="cmd-item">
              <Plus className="cmd-icon" /> Crear nuevo ticket
            </Command.Item>
          )}
          {permissions.can('/knowledge-base') && (
            <Command.Item onSelect={() => go('/knowledge-base')} className="cmd-item">
              <BookOpen className="cmd-icon" /> Base de conocimiento
            </Command.Item>
          )}
          {profile.role === 'administrator' && (
            <Command.Item onSelect={() => go('/settings/sla-policies')} className="cmd-item">
              <Clock className="cmd-icon" /> Políticas de SLA
            </Command.Item>
          )}
        </Command.Group>

        <Command.Group heading="Acciones" className="cmd-group">
          <Command.Item onSelect={toggleTheme} className="cmd-item">
            {theme === 'dark' ? <Sun className="cmd-icon" /> : <Moon className="cmd-icon" />}
            {theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          </Command.Item>
          <Command.Item
            onSelect={() => { setOpen(false); window.location.href = '/'; }}
            className="cmd-item"
          >
            <ArrowRight className="cmd-icon" /> Ir al portal principal
          </Command.Item>
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  );
}
