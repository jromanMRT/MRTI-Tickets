import { z } from 'zod';

export const ticketSchema = z.object({
  title: z.string().min(1, 'El título es obligatorio').max(255, 'Máximo 255 caracteres'),
  description: z.string().optional(),
  business_area_id: z.string().min(1, 'Selecciona un área'),
  category_id: z.string().min(1, 'Selecciona una categoría'),
  subcategory_id: z.string().optional(),
  priority_code: z.string(),
  affected_device_id: z.string().optional(),
});

export type TicketFormData = z.infer<typeof ticketSchema>;

export const commentSchema = z.object({
  content: z.string().min(1, 'El comentario no puede estar vacío'),
  is_private: z.boolean(),
});

export type CommentFormData = z.infer<typeof commentSchema>;

export const statusChangeSchema = z.object({
  status: z.string().min(1, 'Selecciona un estado'),
  comment: z.string().optional(),
});

export type StatusChangeFormData = z.infer<typeof statusChangeSchema>;

export const assignSchema = z.object({
  assignee: z.string().min(1, 'Selecciona un responsable'),
});

export type AssignFormData = z.infer<typeof assignSchema>;

export const articleSchema = z.object({
  title: z.string().min(1, 'El título es obligatorio'),
  body: z.string().min(1, 'El contenido es obligatorio'),
  category_id: z.string().optional(),
  subcategory_id: z.string().optional(),
  status: z.enum(['draft', 'published']),
});

export type ArticleFormData = z.infer<typeof articleSchema>;

export const slaPolicySchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio'),
  priority_code: z.enum(['P1', 'P2', 'P3', 'P4']),
  first_response_minutes: z.number().min(0, 'Mínimo 0 minutos'),
  resolution_minutes: z.number().min(1, 'Mínimo 1 minuto'),
  business_area_id: z.string().optional(),
  category_id: z.string().optional(),
});

export type SlaPolicyFormData = z.infer<typeof slaPolicySchema>;
