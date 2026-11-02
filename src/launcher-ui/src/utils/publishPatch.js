export function formatBytes(bytes = 0) {
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${unit === 0 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}

export function formatEta(seconds) {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return '';
  if (seconds < 10) return 'a few seconds left';
  const mins = Math.round(seconds / 60);
  if (mins < 1) return `${Math.round(seconds)}s left`;
  if (mins < 60) return `${mins} min left`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ${mins % 60}m left`;
}

export function patchStatusLabel(progress) {
  if (!progress?.totalBytes) return 'Uploading patches…';
  const size = `${formatBytes(progress.uploadedBytes)} / ${formatBytes(progress.totalBytes)}`;
  const eta = formatEta(progress.etaSeconds);
  return eta ? `Uploading patches ${size} · ${eta}` : `Uploading patches ${size}`;
}

export async function publishPatch(file, { gameId, version, sessionId, onProgress }) {
  const api = window.electronAPI;
  if (!api?.publishGameBuild || !api.getPathForFile || !file) return;
  const zipPath = api.getPathForFile(file);
  if (!zipPath) return;
  onProgress?.({ uploadedBytes: 0, totalBytes: 0 });
  const onPatch = progress => {
    if (!progress.gameId || progress.gameId === gameId) onProgress?.(progress);
  };
  const unsubscribe = api.onPatchUploadProgress?.(onPatch);
  try {
    await api.publishGameBuild({ zipPath, gameId, version, sessionId });
  } finally {
    unsubscribe?.();
  }
}
