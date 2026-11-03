export function notify(title, body) {
  window.electronAPI?.showCustomNotification(title, body);
}

export function uploadErrorMessage(err, fallback = 'Could not upload your file.') {
  if (err?.message === 'Quota check failed' || err?.message === 'Quota exceeded') {
    return 'You have exceeded your storage quota. Please upgrade your plan or delete some files.';
  }
  return err?.message || fallback;
}
