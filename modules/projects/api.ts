import { supabase } from '../../lib/supabase';
import { insertFieldWithCategory } from '../fields/api';
import type { NewFieldInput } from '../fields/api';
import type { CaptureSlotInput } from '../capture/api';

export type CaptureMode = 'single' | 'multi';

export type Project = {
  id: string;
  name: string;
  color: string | null;
  created_at: string;
};

export async function fetchProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('id, name, color, created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function deleteProject(projectId: string): Promise<void> {
  const { error } = await supabase.from('projects').delete().eq('id', projectId);
  if (error) throw error;
}

export async function createProject(input: {
  name: string;
  color: string;
  fields: NewFieldInput[];
  captureMode: CaptureMode;
  captureSlots: CaptureSlotInput[];
}): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in.');

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .insert({ name: input.name, color: input.color, capture_mode: input.captureMode, owner_id: user.id })
    .select('id')
    .single();
  if (projectError) throw projectError;

  const projectId: string = project.id;

  // Single-shot projects get one auto-created, hidden slot; multi-shot projects use
  // whatever slots the researcher defined in the capture-plan builder.
  const slots = input.captureMode === 'single' ? [{ label: 'Photo' }] : input.captureSlots;
  const { error: slotsError } = await supabase.from('capture_slots').insert(
    slots.map((slot, index) => ({
      project_id: projectId,
      label: slot.label,
      target_angle_degrees: slot.targetAngleDegrees ?? null,
      sort_order: index,
    })),
  );
  if (slotsError) throw slotsError;

  for (let i = 0; i < input.fields.length; i++) {
    await insertFieldWithCategory(user.id, projectId, input.fields[i], i);
  }

  return projectId;
}
