require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { triageRequest, ALLOWED_CATEGORIES, ALLOWED_PRIORITIES, ALLOWED_OWNERS } = require('./triageEngine');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let triageHistory = [
  {
    id: 'TKT-1001',
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    input: 'Our team has 40 employees entering the same customer details into three systems. Could you show us how this might be automated? We would like to speak next week.',
    summary: 'Prospective client with 40 employees seeking workflow automation consultation to eliminate triple data entry.',
    category: 'Sales',
    priority: 'Medium',
    priorityReason: 'Qualified business opportunity with commercial scope; client requested call next week.',
    owner: 'Sales Team',
    draft_response: 'Hello, thank you for reaching out to Node Solutions! We specialize in cross-system data automation. Our Sales Team will reach out today to coordinate our discovery discussion for next week.\n\nBest regards,\nNode Solutions Sales Team',
    status: 'Approved',
    confidence: 0.98,
    engine: 'Gemini (gemini-3.5-flash-lite)'
  },
  {
    id: 'TKT-1002',
    createdAt: new Date(Date.now() - 1800000).toISOString(),
    input: 'We accidentally uploaded a spreadsheet containing customer contact information to the wrong workspace. We need immediate help removing access.',
    summary: 'Critical incident: customer contact PII mistakenly uploaded to incorrect workspace, urgent revocation required.',
    category: 'Technical',
    priority: 'Urgent',
    priorityReason: 'Data privacy & security breach (unauthorized PII exposure) requiring immediate operational containment.',
    owner: 'Engineering',
    draft_response: 'Hello, thank you for alerting us immediately. We treat data security with top priority. Our engineering on-call has revoked access to the affected workspace and is isolating the uploaded file. We will confirm full resolution within 30 minutes.\n\nSincerely,\nNode Solutions Security Team',
    status: 'Dispatched',
    confidence: 0.99,
    security_flag: true,
    engine: 'Gemini (gemini-3.5-flash-lite)'
  }
];

const MOCK_REQUESTS = [
  {
    id: '01',
    badge: 'Sales Lead',
    priorityExpected: 'Medium',
    title: 'Multi-System Data Entry Automation',
    text: 'Our team has 40 employees entering the same customer details into three systems. Could you show us how this might be automated? We would like to speak next week.'
  },
  {
    id: '02',
    badge: 'Service Outage',
    priorityExpected: 'Urgent',
    title: 'Client Portal Outage Incident',
    text: 'The client portal has been unavailable since this morning and our staff cannot access active customer records. Please help as soon as possible.'
  },
  {
    id: '03',
    badge: 'Billing Dispute',
    priorityExpected: 'High',
    title: 'Duplicate Invoice Charge Review',
    text: 'Invoice NS-1048 appears to include the same implementation charge twice. Can someone review it before payment is processed Friday?'
  },
  {
    id: '04',
    badge: 'Product Idea',
    priorityExpected: 'Low',
    title: 'Dark Mode & Font Feedback',
    text: 'Can you add dark mode and change the dashboard font? There is no deadline. I am collecting ideas for a future update.'
  },
  {
    id: '05',
    badge: 'Security / PII',
    priorityExpected: 'Urgent',
    title: 'Accidental PII Upload (Wrong Workspace)',
    text: 'We accidentally uploaded a spreadsheet containing customer contact information to the wrong workspace. We need immediate help removing access.'
  },
  {
    id: '06',
    badge: 'Custom AI Project',
    priorityExpected: 'Medium',
    title: 'Custom AI Reporting System Inquiry',
    text: 'I saw your company online and am interested in a custom AI reporting system. What would pricing and a typical timeline look like?'
  }
];

app.get('/api/config', (req, res) => {
  const hasKey = Boolean(process.env.GEMINI_API_KEY && !process.env.GEMINI_API_KEY.includes('your_gemini'));
  const maskedKey = hasKey ? `${process.env.GEMINI_API_KEY.slice(0, 6)}...${process.env.GEMINI_API_KEY.slice(-4)}` : null;
  res.json({
    hasKey,
    maskedKey,
    model: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
    categories: ALLOWED_CATEGORIES,
    priorities: ALLOWED_PRIORITIES,
    owners: ALLOWED_OWNERS
  });
});

app.get('/api/mock-requests', (req, res) => {
  res.json({ requests: MOCK_REQUESTS });
});

app.post('/api/triage', async (req, res) => {
  try {
    const { text, customKey, customModel } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Request text is required.' });
    }

    const key = customKey || process.env.GEMINI_API_KEY;
    const model = customModel || process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';

    const triageResult = await triageRequest(text, key, model);

    const ticketId = `TKT-${1000 + triageHistory.length + 1}`;
    const newRecord = {
      id: ticketId,
      createdAt: new Date().toISOString(),
      input: text,
      ...triageResult,
      status: 'Pending Review'
    };

    triageHistory.unshift(newRecord);

    res.json({
      success: true,
      ticket: newRecord
    });
  } catch (err) {
    console.error('Triage endpoint error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

app.get('/api/history', (req, res) => {
  const { category, priority, owner, search } = req.query;
  let list = [...triageHistory];

  if (category && category !== 'All') {
    list = list.filter(item => item.category === category);
  }
  if (priority && priority !== 'All') {
    list = list.filter(item => item.priority === priority);
  }
  if (owner && owner !== 'All') {
    list = list.filter(item => item.owner === owner);
  }
  if (search) {
    const s = search.toLowerCase();
    list = list.filter(item =>
      item.input.toLowerCase().includes(s) ||
      item.summary.toLowerCase().includes(s) ||
      item.id.toLowerCase().includes(s)
    );
  }

  res.json({ tickets: list, total: triageHistory.length });
});

app.put('/api/history/:id', (req, res) => {
  const { id } = req.params;
  const { draft_response, status, priority, owner, category } = req.body;

  const ticket = triageHistory.find(t => t.id === id);
  if (!ticket) {
    return res.status(404).json({ error: 'Ticket not found.' });
  }

  if (draft_response !== undefined) ticket.draft_response = draft_response;
  if (status !== undefined) ticket.status = status;
  if (priority !== undefined) ticket.priority = priority;
  if (owner !== undefined) ticket.owner = owner;
  if (category !== undefined) ticket.category = category;

  res.json({ success: true, ticket });
});

app.delete('/api/history/:id', (req, res) => {
  const { id } = req.params;
  if (id === 'all') {
    triageHistory = [];
    return res.json({ success: true, message: 'All tickets cleared.' });
  }

  const idx = triageHistory.findIndex(t => t.id === id);
  if (idx === -1) {
    return res.status(404).json({ error: 'Ticket not found.' });
  }
  triageHistory.splice(idx, 1);
  res.json({ success: true });
});

app.get('/api/stats', (req, res) => {
  const total = triageHistory.length;
  const urgentCount = triageHistory.filter(t => t.priority === 'Urgent').length;
  const pendingCount = triageHistory.filter(t => t.status === 'Pending Review').length;
  const dispatchedCount = triageHistory.filter(t => t.status === 'Dispatched' || t.status === 'Approved').length;

  const byPriority = { Urgent: 0, High: 0, Medium: 0, Low: 0 };
  const byOwner = { 'Sales Team': 0, 'Client Success': 0, 'Finance': 0, 'Engineering': 0 };
  const byCategory = { Sales: 0, Support: 0, Billing: 0, Technical: 0, Other: 0 };

  triageHistory.forEach(t => {
    if (byPriority[t.priority] !== undefined) byPriority[t.priority]++;
    if (byOwner[t.owner] !== undefined) byOwner[t.owner]++;
    if (byCategory[t.category] !== undefined) byCategory[t.category]++;
  });

  res.json({
    total,
    urgentCount,
    pendingCount,
    dispatchedCount,
    byPriority,
    byOwner,
    byCategory
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 Node Solutions AI Triage Assistant running at http://localhost:${PORT}`);
  console.log(`🤖 Configured Gemini Model: ${process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite'}`);
  console.log(`✨ Open http://localhost:${PORT} in your browser to view the assistant.\n`);
});
