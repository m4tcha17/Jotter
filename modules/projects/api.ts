import { getCurrentUserId, getDb, newId, nowIso } from '../../lib/db';
import { insertFieldWithCategory } from '../fields/api';
import type { NewFieldInput } from '../fields/api';
import type { CaptureSlotInput } from '../capture/api';
import type { ManualExposureOptions, WhiteBalancePreset } from 'jotter-camera';

export type CaptureMode = 'single' | 'multi';

export type Project = {
  id: string;
  name: string;
  color: string | null;
  created_at: string;
};

export async function fetchProjects(): Promise<Project[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];

  const db = await getDb();
  return db.getAllAsync<Project>(
    'SELECT id, name, color, created_at FROM projects WHERE owner_id = ? ORDER BY created_at DESC',
    userId,
  );
}

export async function deleteProject(projectId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM projects WHERE id = ?', projectId);
}

export async function createProject(input: {
  name: string;
  color: string;
  fields: NewFieldInput[];
  captureMode: CaptureMode;
  captureSlots: CaptureSlotInput[];
  cameraSettings: ManualExposureOptions | null;
}): Promise<string> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Not signed in.');

  const db = await getDb();
  const projectId = newId();

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'INSERT INTO projects (id, owner_id, name, color, camera_iso, camera_shutter_speed_ns, camera_white_balance, capture_mode, created_at) ' +
        'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      projectId,
      userId,
      input.name,
      input.color,
      input.cameraSettings?.iso ?? null,
      input.cameraSettings?.shutterSpeedNs ?? null,
      input.cameraSettings?.whiteBalancePreset ?? null,
      input.captureMode,
      nowIso(),
    );

    // Single-shot projects get one auto-created, hidden slot; multi-shot projects use
    // whatever slots the researcher defined in the capture-plan builder.
    const slots = input.captureMode === 'single' ? [{ label: 'Photo' }] : input.captureSlots;
    for (let i = 0; i < slots.length; i++) {
      await db.runAsync(
        'INSERT INTO capture_slots (id, project_id, label, target_angle_degrees, sort_order) VALUES (?, ?, ?, ?, ?)',
        newId(),
        projectId,
        slots[i].label,
        slots[i].targetAngleDegrees ?? null,
        i,
      );
    }

    for (let i = 0; i < input.fields.length; i++) {
      await insertFieldWithCategory(userId, projectId, input.fields[i], i);
    }
  });

  return projectId;
}

export async function fetchProjectCameraSettings(projectId: string): Promise<ManualExposureOptions | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{
    camera_iso: number | null;
    camera_shutter_speed_ns: number | null;
    camera_white_balance: WhiteBalancePreset | null;
  }>('SELECT camera_iso, camera_shutter_speed_ns, camera_white_balance FROM projects WHERE id = ?', projectId);

  if (!row || row.camera_iso == null || row.camera_shutter_speed_ns == null || row.camera_white_balance == null) {
    return null;
  }
  return {
    iso: row.camera_iso,
    shutterSpeedNs: row.camera_shutter_speed_ns,
    whiteBalancePreset: row.camera_white_balance,
  };
}

export async function updateProjectCameraSettings(projectId: string, settings: ManualExposureOptions): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE projects SET camera_iso = ?, camera_shutter_speed_ns = ?, camera_white_balance = ? WHERE id = ?',
    settings.iso,
    settings.shutterSpeedNs,
    settings.whiteBalancePreset,
    projectId,
  );
}
