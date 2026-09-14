function requireApiUrl() {
  const configuredUrl = window.HR_PORTAL_SHEETS?.getApiUrl?.() || window.HR_PORTAL_API_URL || '';

  if (!configuredUrl || !/^https?:\/\//i.test(configuredUrl)) {
    throw new Error('Set a valid Google Apps Script URL in the shared Sheets config.');
  }

  return configuredUrl;
}

async function request(options = {}) {
  const apiUrl = requireApiUrl();
  const requestOptions = {
    ...options,
    cache: 'no-store',
    credentials: 'omit',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
      ...(options.headers || {})
    }
  };

  try {
    const response = await fetch(apiUrl, requestOptions);
    const rawText = await response.text();
    let result = {};

    try {
      result = rawText ? JSON.parse(rawText) : {};
    } catch (error) {
      throw new Error(`Invalid API response from Google Apps Script (${response.status}). URL: ${apiUrl}`);
    }

    if (!response.ok || !result || result.ok === false) {
      throw new Error(result && result.error ? result.error : `Google Sheets request failed. URL: ${apiUrl}`);
    }

    return result;
  } catch (error) {
    const message = error && error.message ? error.message : `Google Sheets request failed. URL: ${apiUrl}`;
    throw new Error(message);
  }
}

export async function loadAllRecords() {
  const result = await request({ method: 'GET' });
  return result.records || [];
}

export async function saveRecord(rec) {
  const result = await request({
    method: 'POST',
    body: JSON.stringify({ action: 'save', record: rec })
  });
  return result.record;
}

export async function deleteRecord(id) {
  await request({
    method: 'POST',
    body: JSON.stringify({ action: 'delete', id })
  });
}