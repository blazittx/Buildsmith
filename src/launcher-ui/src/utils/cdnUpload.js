const CDN_UPLOAD_URL = 'https://cdn.diabolical.services/generateUploadUrl';

function putFile(url, file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    if (onProgress) {
      xhr.upload.addEventListener('progress', event => {
        if (event.lengthComputable) onProgress((event.loaded / event.total) * 100);
      });
    }
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error('Failed to upload file'));
    xhr.onerror = () => reject(new Error('Failed to upload file'));
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    xhr.send(file);
  });
}

export async function uploadToCdn(file, { sessionID, fields = {}, onProgress } = {}) {
  const res = await fetch(CDN_UPLOAD_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(sessionID ? { sessionID } : {}),
    },
    body: JSON.stringify({
      fileExt: file.name.split('.').pop(),
      contentType: file.type,
      size_bytes: file.size,
      ...fields,
    }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to generate upload URL');
  }

  const data = await res.json();
  await putFile(data.url, file, onProgress);
  return { ...data, publicUrl: `https://cdn.diabolical.services/${data.key}` };
}
