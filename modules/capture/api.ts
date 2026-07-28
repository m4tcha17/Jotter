import { supabase } from '../../lib/supabase';

export type CaptureSlotInput = {
  label: string;
  targetAngleDegrees?: number;
};

export type CaptureSlot = {
  id: string;
  label: string;
  target_angle_degrees: number | null;
  sort_order: number;
};

export async function fetchCaptureSlots(projectId: string): Promise<CaptureSlot[]> {
  const { data, error } = await supabase
    .from('capture_slots')
    .select('id, label, target_angle_degrees, sort_order')
    .eq('project_id', projectId)
    .order('sort_order');
  if (error) throw error;
  return data ?? [];
}
