import md5 from 'md5';

/**
 * Fetches a nonce from the DW Spectrum server.
 */
export async function getNonce(serverAddress) {
  const res = await fetch(`${serverAddress}/api/getNonce`);
  if (!res.ok) throw new Error(`getNonce failed: ${res.status} ${res.statusText}`);
  const data = await res.json();
  return data.reply; // { realm, nonce }
}

/**
 * Generates the base64 auth key using DW Spectrum digest algorithm.
 */
export function generateAuthKey(username, password, realm, nonce) {
  const digest     = md5(`${username}:${realm}:${password}`);
  const partialHa2 = md5('GET:');
  const ha2        = md5(`${digest}:${nonce}:${partialHa2}`);
  return btoa(`${username}:${nonce}:${ha2}`);
}

/**
 * Full login: get nonce → build auth key.
 * Returns { authKey, serverAddress }
 */
export async function login(serverAddress, username, password) {
  // Normalise trailing slash
  const base = serverAddress.replace(/\/$/, '');
  const { realm, nonce } = await getNonce(base);
  const authKey = generateAuthKey(username, password, realm, nonce);
  return { authKey, serverAddress: base };
}

/**
 * Fetches all cameras from the account.
 * Returns an array of camera objects.
 */
export async function fetchCameras(serverAddress, authKey) {
  const url = `${serverAddress}/ec2/getCamerasEx?auth=${encodeURIComponent(authKey)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`getCamerasEx failed: ${res.status} ${res.statusText}`);
  const data = await res.json();
  // API returns an array directly or wrapped in reply
  return Array.isArray(data) ? data : (data.reply ?? []);
}

/**
 * Returns the HLS stream URL for a camera.
 */
export function getStreamUrl(serverAddress, cameraId, authKey) {
  return `${serverAddress}/hls/${cameraId}.m3u8?lo&auth=${encodeURIComponent(authKey)}`;
}
