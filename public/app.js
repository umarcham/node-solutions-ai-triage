const state = {
  currentTicket: null,
  mockRequests: [],
  history: [],
  filters: {
    category: 'All',
    priority: 'All',
    owner: 'All',
    search: ''
  },
  customKey: '',
  customModel: 'gemini-3.5-flash-lite'
};
const elements = {
  triageForm: document.getElementById('triageForm'),
  requestInput: document.getElementById('requestInput'),
  charCount: document.getElementById('charCount'),
  submitBtn: document.getElementById('submitBtn'),
  btnSpinner: document.getElementById('btnSpinner'),
  clearBtn: document.getElementById('clearBtn'),
  mockPicksContainer: document.getElementById('mockPicksContainer'),
  emptyState: document.getElementById('emptyState'),
  decisionContent: document.getElementById('decisionContent'),
  securityAlertBanner: document.getElementById('securityAlertBanner'),
  securityAlertIcon: document.getElementById('securityAlertIcon'),
  securityAlertTitle: document.getElementById('securityAlertTitle'),
  securityAlertText: document.getElementById('securityAlertText'),
  resSummary: document.getElementById('resSummary'),
  resCategory: document.getElementById('resCategory'),
  resPriority: document.getElementById('resPriority'),
  resOwner: document.getElementById('resOwner'),
  resConfidence: document.getElementById('resConfidence'),
  resPriorityReason: document.getElementById('resPriorityReason'),
  resDraftResponse: document.getElementById('resDraftResponse'),
  copyResponseBtn: document.getElementById('copyResponseBtn'),
  dispatchResponseBtn: document.getElementById('dispatchResponseBtn'),
  resEngineInfo: document.getElementById('resEngineInfo'),
  resLatency: document.getElementById('resLatency'),
  resTicketId: document.getElementById('resTicketId'),
  engineBadge: document.getElementById('engineBadge'),
  kpiTotal: document.getElementById('kpiTotal'),
  kpiUrgent: document.getElementById('kpiUrgent'),
  kpiPending: document.getElementById('kpiPending'),
  kpiDispatched: document.getElementById('kpiDispatched'),
  historyTableBody: document.getElementById('historyTableBody'),
  historyCountPill: document.getElementById('historyCountPill'),
  historySearch: document.getElementById('historySearch'),
  filterCategory: document.getElementById('filterCategory'),
  filterPriority: document.getElementById('filterPriority'),
  filterOwner: document.getElementById('filterOwner'),
  exportCsvBtn: document.getElementById('exportCsvBtn'),
  configBtn: document.getElementById('configBtn'),
  configModal: document.getElementById('configModal'),
  closeModalBtn: document.getElementById('closeModalBtn'),
  saveConfigCloseBtn: document.getElementById('saveConfigCloseBtn'),
  configModelInput: document.getElementById('configModelInput'),
  configApiKeyInput: document.getElementById('configApiKeyInput'),
  modelIndicator: document.getElementById('modelIndicator'),
  toastContainer: document.getElementById('toastContainer')
};
document.addEventListener('DOMContentLoaded', async () => {
  setupEventListeners();
  await loadConfig();
  await loadMockRequests();
  await refreshHistory();
  await refreshStats();
});
function setupEventListeners() {
  elements.requestInput.addEventListener('input', () => {
    const len = elements.requestInput.value.length;
    elements.charCount.textContent = `${len} character${len === 1 ? '' : 's'}`;
  });
  elements.clearBtn.addEventListener('click', () => {
    elements.requestInput.value = '';
    elements.charCount.textContent = '0 characters';
    elements.requestInput.focus();
    document.querySelectorAll('.mock-card').forEach(c => c.classList.remove('active'));
  });
  elements.triageForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = elements.requestInput.value.trim();
    if (!text) return;
    await executeTriage(text);
  });
  elements.copyResponseBtn.addEventListener('click', () => {
    const text = elements.resDraftResponse.value;
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      showToast('Draft response copied to clipboard!', 'success');
    }).catch(() => {
      showToast('Failed to copy to clipboard', 'error');
    });
  });
  elements.dispatchResponseBtn.addEventListener('click', async () => {
    if (!state.currentTicket) return;
    const updatedDraft = elements.resDraftResponse.value;
    try {
      const res = await fetch(`/api/history/${state.currentTicket.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draft_response: updatedDraft,
          status: 'Dispatched'
        })
      });
      if (res.ok) {
        showToast(`Ticket ${state.currentTicket.id} approved & dispatched!`, 'success');
        await refreshHistory();
        await refreshStats();
      }
    } catch (err) {
      showToast('Error dispatching ticket', 'error');
    }
  });
  elements.historySearch.addEventListener('input', (e) => {
    state.filters.search = e.target.value;
    refreshHistory();
  });
  elements.filterCategory.addEventListener('change', (e) => {
    state.filters.category = e.target.value;
    refreshHistory();
  });
  elements.filterPriority.addEventListener('change', (e) => {
    state.filters.priority = e.target.value;
    refreshHistory();
  });
  elements.filterOwner.addEventListener('change', (e) => {
    state.filters.owner = e.target.value;
    refreshHistory();
  });
  elements.exportCsvBtn.addEventListener('click', exportToCsv);
  elements.configBtn.addEventListener('click', () => {
    elements.configModal.style.display = 'flex';
  });
  elements.closeModalBtn.addEventListener('click', () => {
    elements.configModal.style.display = 'none';
  });
  elements.saveConfigCloseBtn.addEventListener('click', () => {
    state.customKey = elements.configApiKeyInput.value.trim();
    state.customModel = elements.configModelInput.value.trim() || 'gemini-3.5-flash-lite';
    elements.modelIndicator.textContent = state.customModel;
    elements.configModal.style.display = 'none';
    showToast('AI configuration saved', 'success');
  });
}
async function loadConfig() {
  try {
    const res = await fetch('/api/config');
    const config = await res.json();
    if (config.model) {
      elements.modelIndicator.textContent = config.model;
      elements.configModelInput.value = config.model;
    }
  } catch (err) {
    console.warn('Failed to load server config:', err);
  }
}
async function loadMockRequests() {
  try {
    const res = await fetch('/api/mock-requests');
    const data = await res.json();
    state.mockRequests = data.requests || [];
    renderMockPickCards();
  } catch (err) {
    console.error('Error fetching mock requests:', err);
  }
}
function renderMockPickCards() {
  elements.mockPicksContainer.innerHTML = '';
  state.mockRequests.forEach(req => {
    const card = document.createElement('div');
    card.className = 'mock-card';
    card.dataset.id = req.id;
    let pillClass = req.priorityExpected.toLowerCase();
    card.innerHTML = `
      <div class="mock-card-header">
        <span class="mock-id">REQ #${req.id}</span>
        <span class="mock-pill ${pillClass}">${req.priorityExpected}</span>
      </div>
      <div class="mock-title">${req.title}</div>
    `;
    card.addEventListener('click', () => {
      document.querySelectorAll('.mock-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      elements.requestInput.value = req.text;
      elements.charCount.textContent = `${req.text.length} characters`;
      elements.requestInput.focus();
    });
    elements.mockPicksContainer.appendChild(card);
  });
}
async function executeTriage(text) {
  setLoading(true);
  try {
    const payload = {
      text,
      customKey: state.customKey || undefined,
      customModel: state.customModel || undefined
    };
    const res = await fetch('/api/triage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Server error occurred');
    }
    const data = await res.json();
    state.currentTicket = data.ticket;
    renderTriageResult(data.ticket);
    await refreshHistory();
    await refreshStats();
    showToast(`Request triaged: ${data.ticket.priority} priority`, 'success');
  } catch (err) {
    console.error('Triage failed:', err);
    showToast(`Triage failed: ${err.message}`, 'error');
  } finally {
    setLoading(false);
  }
}
function renderTriageResult(ticket) {
  elements.emptyState.style.display = 'none';
  elements.decisionContent.style.display = 'flex';
  elements.resSummary.textContent = ticket.summary || 'Summary unavailable';
  elements.resCategory.textContent = ticket.category;
  elements.resPriority.textContent = ticket.priority;
  elements.resPriority.className = `badge badge-priority ${ticket.priority.toLowerCase()}`;
  elements.resOwner.textContent = ticket.owner;
  const confPct = Math.round((ticket.confidence || 0.95) * 100);
  elements.resConfidence.textContent = `${confPct}%`;
  elements.resPriorityReason.textContent = ticket.priorityReason || 'Triaged according to operational criteria.';
  elements.resDraftResponse.value = ticket.draft_response || '';
  if (ticket.security_flag) {
    elements.securityAlertBanner.style.display = 'flex';
    elements.securityAlertIcon.textContent = '🚨';
    elements.securityAlertTitle.textContent = 'CRITICAL DATA PRIVACY / SECURITY INCIDENT FLAGGED';
    elements.securityAlertText.textContent = 'Data security & privacy risk detected: Unauthorized customer data/spreadsheet exposure flagged for immediate engineering access revocation.';
  } else if (ticket.outage_flag || (ticket.priority === 'Urgent' && (ticket.category === 'Technical' || ticket.category === 'Support'))) {
    elements.securityAlertBanner.style.display = 'flex';
    elements.securityAlertIcon.textContent = '⚡';
    elements.securityAlertTitle.textContent = 'MISSION-CRITICAL SYSTEM OUTAGE FLAGGED';
    elements.securityAlertText.textContent = 'Critical production incident detected: Service disruption or webhook failure impacting active operations. Immediate engineering escalation initiated.';
  } else if (ticket.priority === 'Urgent') {
    elements.securityAlertBanner.style.display = 'flex';
    elements.securityAlertIcon.textContent = '⚠️';
    elements.securityAlertTitle.textContent = 'URGENT OPERATIONAL ESCALATION';
    elements.securityAlertText.textContent = 'High-impact business emergency requiring immediate priority handling.';
  } else {
    elements.securityAlertBanner.style.display = 'none';
  }
  elements.resEngineInfo.textContent = `Engine: ${ticket.engine || 'Gemini'}`;
  elements.resLatency.textContent = ticket.latencyMs ? `Latency: ${ticket.latencyMs}ms` : 'Latency: <1s';
  elements.resTicketId.textContent = `Ticket: ${ticket.id}`;
  elements.engineBadge.textContent = ticket.engine ? ticket.engine.split(' ')[0] : 'Gemini AI';
}
async function refreshHistory() {
  try {
    const params = new URLSearchParams();
    if (state.filters.category !== 'All') params.append('category', state.filters.category);
    if (state.filters.priority !== 'All') params.append('priority', state.filters.priority);
    if (state.filters.owner !== 'All') params.append('owner', state.filters.owner);
    if (state.filters.search) params.append('search', state.filters.search);
    const res = await fetch(`/api/history?${params.toString()}`);
    const data = await res.json();
    state.history = data.tickets || [];
    elements.historyCountPill.textContent = `${data.tickets.length} ticket${data.tickets.length === 1 ? '' : 's'}`;
    renderHistoryTable(data.tickets);
  } catch (err) {
    console.error('Error refreshing history:', err);
  }
}
function renderHistoryTable(tickets) {
  elements.historyTableBody.innerHTML = '';
  if (tickets.length === 0) {
    elements.historyTableBody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; color: var(--text-muted); padding: 2rem;">
          No tickets found matching current filters.
        </td>
      </tr>
    `;
    return;
  }
  tickets.forEach(t => {
    const tr = document.createElement('tr');
    const timeStr = formatTime(t.createdAt);
    const statusClass = (t.status || 'Pending').toLowerCase().replace(/\s+/g, '-');
    tr.innerHTML = `
      <td class="ticket-cell-id">${t.id}</td>
      <td class="ticket-cell-time">${timeStr}</td>
      <td class="ticket-cell-text" title="${escapeHtml(t.input)}">${escapeHtml(t.input)}</td>
      <td><span class="badge badge-category" style="font-size: 0.72rem; padding: 2px 6px;">${t.category}</span></td>
      <td><span class="badge badge-priority ${t.priority.toLowerCase()}" style="font-size: 0.72rem; padding: 2px 6px;">${t.priority}</span></td>
      <td><span class="badge badge-owner" style="font-size: 0.72rem; padding: 2px 6px;">${t.owner}</span></td>
      <td><span class="status-badge-tbl ${statusClass}">${t.status || 'Pending'}</span></td>
      <td>
        <button class="tbl-btn view-tkt-btn" data-id="${t.id}">View</button>
      </td>
    `;
    tr.querySelector('.view-tkt-btn').addEventListener('click', () => {
      state.currentTicket = t;
      elements.requestInput.value = t.input;
      elements.charCount.textContent = `${t.input.length} characters`;
      renderTriageResult(t);
      window.scrollTo({ top: 180, behavior: 'smooth' });
    });
    elements.historyTableBody.appendChild(tr);
  });
}
async function refreshStats() {
  try {
    const res = await fetch('/api/stats');
    const stats = await res.json();
    elements.kpiTotal.textContent = stats.total || 0;
    elements.kpiUrgent.textContent = stats.urgentCount || 0;
    elements.kpiPending.textContent = stats.pendingCount || 0;
    elements.kpiDispatched.textContent = stats.dispatchedCount || 0;
  } catch (err) {
    console.error('Error refreshing stats:', err);
  }
}
function exportToCsv() {
  if (!state.history.length) {
    showToast('No tickets to export', 'error');
    return;
  }
  const headers = ['Ticket ID', 'Created At', 'Input', 'Summary', 'Category', 'Priority', 'Owner', 'Status', 'Draft Response'];
  const rows = state.history.map(t => [
    `"${t.id}"`,
    `"${t.createdAt}"`,
    `"${(t.input || '').replace(/"/g, '""')}"`,
    `"${(t.summary || '').replace(/"/g, '""')}"`,
    `"${t.category}"`,
    `"${t.priority}"`,
    `"${t.owner}"`,
    `"${t.status}"`,
    `"${(t.draft_response || '').replace(/"/g, '""')}"`
  ]);
  const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `Node_Solutions_Triage_Export_${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('Exported CSV file', 'success');
}
function setLoading(isLoading) {
  elements.submitBtn.disabled = isLoading;
  elements.btnSpinner.style.display = isLoading ? 'inline-block' : 'none';
  elements.submitBtn.querySelector('.btn-text-main').textContent = isLoading ? 'Analyzing Request...' : 'Run AI Triage';
}
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${type === 'success' ? '✓' : '⚠️'}</span> <span>${escapeHtml(message)}</span>`;
  elements.toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 250);
  }, 3200);
}
function formatTime(isoStr) {
  if (!isoStr) return 'Just now';
  const d = new Date(isoStr);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
