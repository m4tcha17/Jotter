import { getDb } from '../../lib/db';

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
  const db = await getDb();
  return db.getAllAsync<CaptureSlot>(
    'SELECT id, label, target_angle_degrees, sort_order FROM capture_slots WHERE project_id = ? ORDER BY sort_order',
    projectId,
  );
}
