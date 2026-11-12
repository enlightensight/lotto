// Hands a successful login / purchase response to the POS app (/app), which restores
// its session from these storage keys on boot (see src/main.js finalizeAuthLoginSuccess).
export function enterPos(data, fallbackEmail = '') {
  const user = data.user || {};
  const isAdmin = Boolean(data.isAdmin || data.mode === 'ADMIN' || user.role === 'SUPER_ADMIN');
  const token = data.token || '';
  const statuses = data.statuses || {};
  const storeId = data.storeId || user.storeId || (isAdmin ? 'store_admin' : '');
  const storeName = data.storeName || user.storeName || '';
  const onKey = isAdmin ? 'lotto_admin_token' : 'lotto_store_token';
  const offKey = isAdmin ? 'lotto_store_token' : 'lotto_admin_token';

  const session = JSON.stringify({
    name: user.name || storeName || (isAdmin ? 'Platform Administrator' : 'Store User'),
    username: user.username || fallbackEmail,
    signInName: user.username || fallbackEmail,
    email: user.email || fallbackEmail,
    storeId,
    retailerNumber: data.retailerNumber || user.retailerNumber || '',
    activeView: isAdmin ? 'admin' : 'pos',
    isAdmin,
    role: user.role || (isAdmin ? 'SUPER_ADMIN' : 'Owner'),
    adminToken: isAdmin ? token : '',
    storeToken: isAdmin ? '' : token,
    ...statuses,
    loginAt: new Date().toISOString()
  });

  for (const store of [localStorage, sessionStorage]) {
    store.removeItem(offKey);
    store.removeItem('lotto_signed_out');
    if (token) store.setItem(onKey, token);
    store.setItem('lotto_session_user', session);
  }
  localStorage.setItem('lotto_remembered_user', user.email || fallbackEmail);

  if (!isAdmin && storeId) {
    localStorage.setItem('lotto_current_store_id', storeId);
    try {
      const list = JSON.parse(localStorage.getItem('lotto_stores_list') || '[]');
      if (Array.isArray(list) && list.length && !list.some(s => s.id === storeId)) {
        list.push({ id: storeId, name: storeName, address: '', retailerNumber: '', totalBoxes: 65, status: 'ACTIVE' });
        localStorage.setItem('lotto_stores_list', JSON.stringify(list));
      }
    } catch (_) { /* POS rebuilds its store list from the server */ }
  }

  window.location.assign(isAdmin ? '/app/#admin' : '/app/');
}

export async function postJson(url, body) {
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await resp.json().catch(() => ({}));
  return { ok: resp.ok && data.success !== false, status: resp.status, data };
}
