const API = '';
let currentUser = null;
let eventsCache = [];

// ---------------------------------------------------------------------------
// Auth guard
// ---------------------------------------------------------------------------

async function checkAuth() {
  try {
    const r = await fetch('/api/me', { credentials: 'include' });
    const d = await r.json();
    if (!d.logged_in) { window.location.href = '/login'; return; }
    currentUser = d;
    document.getElementById('header-user').textContent = `${d.name} · ${d.role}`;
  } catch (e) {
    window.location.href = '/login';
  }
}

// Utilities

function toast(msg, type = 'info') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast toast-${type} show`;
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 3500);
}

async function api(path, opts = {}) {
  const res = await fetch(API + path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...opts.headers },
    ...opts,
  });
  if (res.status === 401) { window.location.href = '/login'; return null; }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

function spinner(btn, loading, label) {
  if (loading) {
    btn._label = btn.innerHTML;
    btn.innerHTML = `<span class="spin"></span>${label || 'Loading…'}`;
    btn.disabled = true;
  } else {
    btn.innerHTML = btn._label || btn.innerHTML;
    btn.disabled = false;
  }
}

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ---------------------------------------------------------------------------
// Logout
// ---------------------------------------------------------------------------

document.getElementById('btn-logout').addEventListener('click', async () => {
  await fetch('/api/logout', { method: 'POST', credentials: 'include' });
  window.location.href = '/login';
});

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(s => s.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
    if (tab.dataset.tab === 'queue')    loadQueue();
    if (tab.dataset.tab === 'contacts') loadContacts();
    if (tab.dataset.tab === 'events')   loadEvents();
    if (tab.dataset.tab === 'team')     loadTeam();
  });
});

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

async function loadStats() {
  try {
    const s = await api('/api/stats');
    if (!s) return;
    document.getElementById('stat-sent-today').textContent = s.sent_today ?? '—';
    document.getElementById('stat-total-sent').textContent = s.emails_sent ?? '—';
    document.getElementById('stat-drafts').textContent     = s.pending_drafts ?? '—';
    document.getElementById('stat-contacts').textContent   = s.total_contacts ?? '—';
  } catch (e) {}
}

// Events

async function loadEvents() {
  try {
    eventsCache = await api('/api/events') || [];
  } catch (e) { return; }

  // Update queue dropdown
  const sel = document.getElementById('event-select');
  const cur = sel.value;
  sel.innerHTML = '<option value="">No specific event</option>';
  eventsCache.forEach(ev => {
    const opt = document.createElement('option');
    opt.value = ev.id;
    opt.textContent = ev.name + (ev.date ? ` (${ev.date})` : '');
    sel.appendChild(opt);
  });
  if (cur) sel.value = cur;

  // Render events tab
  const list = document.getElementById('events-list');
  if (!list) return;
  if (eventsCache.length === 0) {
    list.innerHTML = '<p style="color:var(--muted);padding:20px 0">No events yet. Create one to attach to your outreach drafts.</p>';
    return;
  }
  list.innerHTML = eventsCache.map(ev => `
    <div class="event-card">
      <div class="event-card-header">
        <div>
          <div class="event-name">${esc(ev.name)}</div>
          ${ev.date ? `<div class="event-date">${esc(ev.date)}</div>` : ''}
        </div>
        <button class="btn btn-ghost btn-danger" onclick="deleteEvent(${ev.id})" style="font-size:12px;padding:4px 10px">Delete</button>
      </div>
      ${ev.description ? `<div class="event-desc">${esc(ev.description)}</div>` : ''}
      ${ev.what_we_need ? `<div class="event-need"><strong>Looking for:</strong> ${esc(ev.what_we_need)}</div>` : ''}
    </div>
  `).join('');
}

document.getElementById('btn-new-event').addEventListener('click', () => {
  document.getElementById('event-form').style.display = '';
  document.getElementById('ev-name').focus();
});
document.getElementById('btn-cancel-event').addEventListener('click', () => {
  document.getElementById('event-form').style.display = 'none';
});
document.getElementById('btn-save-event').addEventListener('click', async function () {
  const name = document.getElementById('ev-name').value.trim();
  if (!name) { toast('Event name required', 'err'); return; }
  spinner(this, true, 'Saving…');
  try {
    await api('/api/events', { method: 'POST', body: JSON.stringify({
      name,
      date:         document.getElementById('ev-date').value,
      description:  document.getElementById('ev-desc').value.trim(),
      what_we_need: document.getElementById('ev-need').value.trim(),
    })});
    document.getElementById('event-form').style.display = 'none';
    ['ev-name','ev-date','ev-desc','ev-need'].forEach(id => document.getElementById(id).value = '');
    toast('Event created!', 'ok');
    await loadEvents();
  } catch (e) {
    toast('Error: ' + e.message, 'err');
  } finally { spinner(this, false); }
});

async function deleteEvent(id) {
  if (!confirm('Delete this event?')) return;
  try {
    await api(`/api/events/${id}`, { method: 'DELETE' });
    toast('Event deleted', 'info');
    await loadEvents();
  } catch (e) { toast('Error: ' + e.message, 'err'); }
}
window.deleteEvent = deleteEvent;

// ---------------------------------------------------------------------------
// Queue
// ---------------------------------------------------------------------------

let queueData = [];
let activeItem = null;

async function loadQueue() {
  try { queueData = await api('/api/queue') || []; }
  catch (e) { toast('Could not load queue', 'err'); return; }

  const list  = document.getElementById('queue-list');
  const empty = document.getElementById('queue-empty');
  list.innerHTML = '';
  list.appendChild(empty);

  if (queueData.length === 0) {
    empty.style.display = '';
    document.getElementById('panel-placeholder').style.display = '';
    document.getElementById('panel-content').style.display = 'none';
    return;
  }
  empty.style.display = 'none';

  queueData.forEach(item => {
    const el = document.createElement('div');
    el.className = 'queue-item';
    el.innerHTML = `
      <div class="qi-name">${esc(item.name || 'Unknown')}</div>
      <div class="qi-company">${esc(item.company || '')}${item.title ? ' · ' + esc(item.title) : ''}</div>
      ${item.event_name ? `<div style="font-size:11px;color:var(--cta);margin-top:2px">📅 ${esc(item.event_name)}</div>` : ''}
      ${!item.email ? '<div class="qi-no-email">⚠ No email</div>' : ''}
    `;
    el.addEventListener('click', () => selectQueueItem(item, el));
    list.appendChild(el);
  });

  selectQueueItem(queueData[0], list.querySelectorAll('.queue-item')[0]);
}

function selectQueueItem(item, el) {
  document.querySelectorAll('.queue-item').forEach(i => i.classList.remove('active'));
  el.classList.add('active');
  activeItem = item;

  document.getElementById('panel-placeholder').style.display = 'none';
  document.getElementById('panel-content').style.display = '';

  const links = [];
  if (item.website)     links.push(`<a class="cc-link" href="${esc(item.website)}" target="_blank">🌐 Website</a>`);
  if (item.linkedin_url) links.push(`<a class="cc-link" href="${esc(item.linkedin_url)}" target="_blank">in LinkedIn</a>`);
  const industry = item.industry ? `<span class="cc-industry">${esc(item.industry)}</span>` : '';

  document.getElementById('company-card').innerHTML = `
    <div>
      <div class="cc-name">${esc(item.name || 'Unknown')}</div>
      <div class="cc-meta">${esc(item.title || '')}${item.title && item.company ? ' at ' : ''}${esc(item.company || '')}${item.location ? ' · ' + esc(item.location) : ''}</div>
      ${item.description ? `<div class="cc-description">${esc(item.description)}</div>` : ''}
    </div>
    <div class="cc-links">
      ${links.join('')}${industry}
      ${item.event_name ? `<span class="cc-industry" style="background:rgba(91,79,232,0.1);color:var(--cta);border-color:rgba(91,79,232,0.25)">📅 ${esc(item.event_name)}</span>` : ''}
    </div>
    ${!item.email ? '<div class="cc-no-email">⚠ No email address — add one in Contacts before sending.</div>' : ''}
  `;

  document.getElementById('edit-subject').value = item.subject || '';
  document.getElementById('edit-body').value    = item.body || '';
  document.getElementById('feedback-row').style.display = 'none';
  document.getElementById('btn-send').disabled = !item.email;
}

document.getElementById('btn-bulk-draft').addEventListener('click', async function () {
  const eventId = document.getElementById('event-select').value;
  spinner(this, true, 'Generating…');
  try {
    const r = await api('/api/draft/bulk', {
      method: 'POST',
      body: JSON.stringify({ event_id: eventId ? parseInt(eventId) : null }),
    });
    if (!r) return;
    if (r.generated > 0) toast(`Generated ${r.generated} drafts!`, 'ok');
    else if (r.errors?.length) toast('Error: ' + r.errors[0].error, 'err');
    else toast('All contacts already have drafts or have been sent to.', 'info');
    await loadQueue();
    await loadStats();
  } catch (e) { toast('Error: ' + e.message, 'err'); }
  finally { spinner(this, false); }
});

['edit-subject','edit-body'].forEach(id => {
  document.getElementById(id).addEventListener('input', () => {
    clearTimeout(window._saveTimer);
    window._saveTimer = setTimeout(saveCurrentDraft, 800);
  });
});

async function saveCurrentDraft() {
  if (!activeItem) return;
  try {
    await api(`/api/draft/${activeItem.outreach_id}`, {
      method: 'PUT',
      body: JSON.stringify({
        subject: document.getElementById('edit-subject').value,
        body:    document.getElementById('edit-body').value,
      }),
    });
  } catch (e) {}
}

document.getElementById('btn-send').addEventListener('click', async function () {
  if (!activeItem) return;
  await saveCurrentDraft();
  spinner(this, true, 'Sending…');
  try {
    await api(`/api/send/${activeItem.outreach_id}`, { method: 'POST' });
    toast(`Email sent to ${activeItem.name}!`, 'ok');
    await loadQueue(); await loadStats();
  } catch (e) { toast('Send failed: ' + e.message, 'err'); spinner(this, false); }
});

document.getElementById('btn-delete-draft').addEventListener('click', async function () {
  if (!activeItem) return;
  if (!confirm(`Delete this draft for ${activeItem.name}?`)) return;
  try {
    await api(`/api/draft/${activeItem.outreach_id}`, { method: 'DELETE' });
    toast('Draft deleted', 'info');
    activeItem = null;
    await loadQueue(); await loadStats();
  } catch (e) { toast('Error: ' + e.message, 'err'); }
});

document.getElementById('btn-skip').addEventListener('click', async function () {
  if (!activeItem) return;
  if (!confirm(`Skip ${activeItem.name}? They won't appear in the queue again.`)) return;
  try {
    await api(`/api/skip/${activeItem.id}`, { method: 'POST' });
    toast(`Skipped ${activeItem.name}`, 'info');
    await loadQueue(); await loadStats();
  } catch (e) { toast('Error: ' + e.message, 'err'); }
});

document.getElementById('btn-regenerate').addEventListener('click', () => {
  if (!activeItem) return;
  document.getElementById('feedback-row').style.display = '';
  document.getElementById('feedback-input').focus();
});
document.getElementById('btn-feedback-cancel').addEventListener('click', () => {
  document.getElementById('feedback-row').style.display = 'none';
});
document.getElementById('btn-feedback-submit').addEventListener('click', async function () {
  if (!activeItem) return;
  const feedback    = document.getElementById('feedback-input').value.trim();
  const currentBody = document.getElementById('edit-body').value;
  const eventId     = document.getElementById('event-select').value;
  spinner(this, true, 'Rewriting…');
  try {
    const r = await api(`/api/draft/${activeItem.id}`, {
      method: 'POST',
      body: JSON.stringify({ feedback, current_body: currentBody, event_id: eventId ? parseInt(eventId) : null }),
    });
    if (!r) return;
    document.getElementById('edit-subject').value = r.subject;
    document.getElementById('edit-body').value    = r.body;
    activeItem.outreach_id = r.outreach_id;
    document.getElementById('feedback-row').style.display = 'none';
    document.getElementById('feedback-input').value = '';
    toast('Redrafted!', 'ok');
  } catch (e) { toast('Error: ' + e.message, 'err'); }
  finally { spinner(this, false); }
});

// ---------------------------------------------------------------------------
// Contacts
// ---------------------------------------------------------------------------

async function loadContacts() {
  const tbody = document.getElementById('contacts-tbody');
  tbody.innerHTML = '<tr><td colspan="7" style="color:var(--muted);padding:20px">Loading…</td></tr>';
  try {
    const contacts = await api('/api/contacts') || [];
    if (!contacts.length) {
      tbody.innerHTML = '<tr><td colspan="7" style="color:var(--muted);padding:20px">No contacts yet.</td></tr>';
      return;
    }
    tbody.innerHTML = contacts.map(c => {
      const links = [];
      if (c.website)     links.push(`<a class="small-link" href="${esc(c.website)}" target="_blank">web</a>`);
      if (c.linkedin_url) links.push(`<a class="small-link" href="${esc(c.linkedin_url)}" target="_blank">li</a>`);
      const status = c.last_sent
        ? '<span class="status-sent">✓ Sent</span>'
        : '<span class="status-none">Unsent</span>';
      return `<tr>
        <td>${esc(c.name||'—')}</td>
        <td>${esc(c.company||'—')}</td>
        <td>${esc(c.title||'—')}</td>
        <td>${esc(c.email||'')}${!c.email?'<span style="color:var(--red);font-size:11px;margin-left:4px">missing</span>':''}</td>
        <td>${links.join(' · ')||'—'}</td>
        <td>${status}</td>
        <td style="display:flex;gap:6px">
          ${!c.last_sent?`<button class="btn btn-ghost" style="padding:3px 8px;font-size:11px" onclick="draftOne(${c.id})">Draft</button>`:''}
          <button class="btn btn-ghost btn-danger" style="padding:3px 8px;font-size:11px" onclick="deleteContact(${c.id},'${esc(c.name||'')}')">✕</button>
        </td>
      </tr>`;
    }).join('');
  } catch (e) { toast('Could not load contacts', 'err'); }
}

async function draftOne(contactId) {
  const eventId = document.getElementById('event-select').value;
  try {
    await api(`/api/draft/${contactId}`, {
      method: 'POST',
      body: JSON.stringify({ event_id: eventId ? parseInt(eventId) : null }),
    });
    toast('Draft created — check the queue', 'ok');
    await loadStats();
  } catch (e) { toast('Error: ' + e.message, 'err'); }
}
window.draftOne = draftOne;

async function deleteContact(id, name) {
  if (!confirm(`Delete ${name}? This also removes their drafts.`)) return;
  try {
    await api(`/api/contacts/${id}`, { method: 'DELETE' });
    toast(`${name} deleted`, 'info');
    await loadContacts(); await loadStats();
  } catch (e) { toast('Error: ' + e.message, 'err'); }
}
window.deleteContact = deleteContact;

document.getElementById('btn-add-contact').addEventListener('click', () => {
  document.querySelector('[data-tab="import"]').click();
  document.getElementById('manual-name').focus();
});

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

const csvInput = document.getElementById('csv-input');
const csvDrop  = document.getElementById('csv-drop');
let csvFile = null;
csvDrop.addEventListener('click', () => csvInput.click());
csvDrop.addEventListener('dragover', e => { e.preventDefault(); csvDrop.classList.add('dragover'); });
csvDrop.addEventListener('dragleave', () => csvDrop.classList.remove('dragover'));
csvDrop.addEventListener('drop', e => {
  e.preventDefault(); csvDrop.classList.remove('dragover');
  csvFile = e.dataTransfer.files[0];
  document.getElementById('csv-label').textContent = csvFile.name;
  document.getElementById('btn-csv-upload').disabled = false;
});
csvInput.addEventListener('change', () => {
  csvFile = csvInput.files[0];
  if (csvFile) { document.getElementById('csv-label').textContent = csvFile.name; document.getElementById('btn-csv-upload').disabled = false; }
});
document.getElementById('btn-csv-upload').addEventListener('click', async function () {
  if (!csvFile) return;
  const fd = new FormData(); fd.append('file', csvFile);
  spinner(this, true, 'Importing…');
  const el = document.getElementById('csv-result');
  try {
    const res = await fetch('/api/import/csv', { method: 'POST', credentials: 'include', body: fd });
    const r = await res.json();
    if (!res.ok) throw new Error(r.error);
    el.className = 'result-msg ok';
    el.textContent = `✓ Added ${r.added} contacts (${r.skipped_duplicates} duplicates skipped)`;
    await loadStats();
  } catch (e) { el.className = 'result-msg err'; el.textContent = '✗ ' + e.message; }
  finally { spinner(this, false); }
});

// ---------------------------------------------------------------------------
// YC
// ---------------------------------------------------------------------------

document.getElementById('btn-yc-fetch').addEventListener('click', async function () {
  const p = new URLSearchParams({ limit: document.getElementById('yc-limit').value });
  const batch = document.getElementById('yc-batch').value.trim();
  const ind   = document.getElementById('yc-industry').value.trim();
  if (batch) p.set('batch', batch);
  if (ind)   p.set('industry', ind);
  spinner(this, true, 'Fetching…');
  const el = document.getElementById('yc-result');
  try {
    const results = await api(`/api/discover/yc?${p}`) || [];
    el.className = 'result-msg ok'; el.textContent = `Found ${results.length} companies`;
    renderPreview(document.getElementById('yc-preview'), results);
  } catch (e) { el.className = 'result-msg err'; el.textContent = '✗ ' + e.message; }
  finally { spinner(this, false); }
});

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

document.getElementById('btn-search').addEventListener('click', async function () {
  const q = document.getElementById('search-query').value.trim();
  if (!q) { toast('Enter a search query', 'err'); return; }
  spinner(this, true, 'Searching…');
  const el = document.getElementById('search-result');
  try {
    const results = await api(`/api/discover/search?q=${encodeURIComponent(q)}&limit=${document.getElementById('search-limit').value}`) || [];
    el.className = 'result-msg ok'; el.textContent = `Found ${results.length} profiles`;
    renderPreview(document.getElementById('search-preview'), results);
    if (!results.length) { el.textContent = 'No results — try a different query or use CSV import'; }
  } catch (e) { el.className = 'result-msg err'; el.textContent = '✗ ' + e.message; }
  finally { spinner(this, false); }
});

function renderPreview(container, results) {
  container.innerHTML = '';
  if (!results.length) { container.innerHTML = '<p style="color:var(--muted);font-size:12px">No results.</p>'; return; }
  results.forEach(r => {
    const el = document.createElement('div');
    el.className = 'preview-item';
    el.innerHTML = `
      <div class="preview-item-info">
        <div class="preview-item-name">${esc(r.name||'—')}</div>
        <div class="preview-item-sub">${esc(r.company||'')}${r.industry?' · '+esc(r.industry):''}</div>
      </div>
      <button class="btn btn-ghost" data-added="false">+ Add</button>
    `;
    const btn = el.querySelector('button');
    btn.addEventListener('click', async () => {
      if (btn.dataset.added === 'true') return;
      btn.disabled = true;
      try {
        await api('/api/contacts', { method: 'POST', body: JSON.stringify(r) });
        btn.textContent = '✓ Added'; btn.dataset.added = 'true';
        await loadStats();
      } catch (e) {
        btn.textContent = e.message.includes('already') ? 'Exists' : 'Error';
        if (!e.message.includes('already')) btn.disabled = false;
      }
    });
    container.appendChild(el);
  });
}

// ---------------------------------------------------------------------------
// Manual Add
// ---------------------------------------------------------------------------

document.getElementById('btn-manual-add').addEventListener('click', async function () {
  const name = document.getElementById('manual-name').value.trim();
  if (!name) { toast('Name is required', 'err'); return; }
  spinner(this, true, 'Adding…');
  const el = document.getElementById('manual-result');
  try {
    await api('/api/contacts', { method: 'POST', body: JSON.stringify({
      name, source: 'manual',
      email:        document.getElementById('manual-email').value.trim(),
      company:      document.getElementById('manual-company').value.trim(),
      title:        document.getElementById('manual-title').value.trim(),
      linkedin_url: document.getElementById('manual-linkedin').value.trim(),
      website:      document.getElementById('manual-website').value.trim(),
      description:  document.getElementById('manual-desc').value.trim(),
      industry:     document.getElementById('manual-industry').value.trim(),
    })});
    el.className = 'result-msg ok'; el.textContent = `✓ ${name} added`;
    ['manual-name','manual-email','manual-company','manual-title','manual-linkedin','manual-website','manual-desc','manual-industry']
      .forEach(id => document.getElementById(id).value = '');
    await loadStats();
  } catch (e) { el.className = 'result-msg err'; el.textContent = '✗ ' + e.message; }
  finally { spinner(this, false); }
});

// ---------------------------------------------------------------------------
// Team
// ---------------------------------------------------------------------------

async function loadTeam() {
  const tbody = document.getElementById('team-tbody');
  try {
    const users = await api('/api/users') || [];
    tbody.innerHTML = users.map(u => `<tr>
      <td>${esc(u.name)}</td><td>${esc(u.email)}</td><td>${esc(u.role)}</td>
      <td style="color:var(--muted);font-size:12px">${(u.created_at||'').slice(0,10)}</td>
    </tr>`).join('');
  } catch (e) {}
}

document.getElementById('btn-add-member').addEventListener('click', async function () {
  const name     = document.getElementById('tm-name').value.trim();
  const email    = document.getElementById('tm-email').value.trim();
  const password = document.getElementById('tm-password').value;
  const role     = document.getElementById('tm-role').value.trim() || 'Member';
  if (!name || !email || !password) { toast('Name, email and password required', 'err'); return; }
  spinner(this, true, 'Adding…');
  const el = document.getElementById('team-result');
  try {
    await api('/api/users', { method: 'POST', body: JSON.stringify({ name, email, role, password }) });
    el.className = 'result-msg ok'; el.textContent = `✓ ${name} added`;
    ['tm-name','tm-email','tm-role','tm-password'].forEach(id => document.getElementById(id).value = '');
    await loadTeam();
  } catch (e) { el.className = 'result-msg err'; el.textContent = '✗ ' + e.message; }
  finally { spinner(this, false); }
});

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

async function boot() {
  await checkAuth();
  await loadStats();
  await loadEvents();
  await loadQueue();
  setInterval(loadStats, 15000);
}

boot();
