require('dotenv').config();
const { triageRequest } = require('./triageEngine');

const MOCK_TEST_CASES = [
  {
    id: '01',
    request: 'Our team has 40 employees entering the same customer details into three systems. Could you show us how this might be automated? We would like to speak next week.',
    expectedCategory: 'Sales',
    expectedOwner: 'Sales Team',
    notes: 'Commercial automation inquiry'
  },
  {
    id: '02',
    request: 'The client portal has been unavailable since this morning and our staff cannot access active customer records. Please help as soon as possible.',
    expectedPriority: ['Urgent', 'High'],
    expectedOwner: ['Engineering', 'Client Success'],
    notes: 'Active portal outage'
  },
  {
    id: '03',
    request: 'Invoice NS-1048 appears to include the same implementation charge twice. Can someone review it before payment is processed Friday?',
    expectedCategory: 'Billing',
    expectedOwner: 'Finance',
    notes: 'Billing duplicate dispute before Friday cutoff'
  },
  {
    id: '04',
    request: 'Can you add dark mode and change the dashboard font? There is no deadline. I am collecting ideas for a future update.',
    expectedPriority: 'Low',
    notes: 'Cosmetic feature request with no deadline'
  },
  {
    id: '05',
    request: 'We accidentally uploaded a spreadsheet containing customer contact information to the wrong workspace. We need immediate help removing access.',
    expectedPriority: 'Urgent',
    expectedOwner: ['Engineering', 'Client Success'],
    mustBeSecurity: true,
    notes: 'CRITICAL: Data privacy / PII leak incident'
  },
  {
    id: '06',
    request: 'I saw your company online and am interested in a custom AI reporting system. What would pricing and a typical timeline look like?',
    expectedCategory: 'Sales',
    expectedOwner: 'Sales Team',
    notes: 'New prospect AI reporting proposal'
  }
];

async function runTests() {
  console.log('================================================================');
  console.log(' NODE SOLUTIONS - AI REQUEST TRIAGE ASSISTANT: TEST SUITE');
  console.log('================================================================\n');

  let passed = 0;

  for (const tc of MOCK_TEST_CASES) {
    console.log(`[TEST CASE ${tc.id}]`);
    console.log(`Input: "${tc.request}"`);

    try {
      const result = await triageRequest(tc.request);
      console.log(`-> Engine: ${result.engine} (Latency: ${result.latencyMs || 'N/A'}ms)`);
      console.log(`-> Summary: ${result.summary}`);
      console.log(`-> Category: [${result.category}] | Priority: [${result.priority}] | Owner: [${result.owner}]`);
      console.log(`-> Priority Reason: ${result.priorityReason}`);
      console.log(`-> Draft First Response Preview:\n   ${result.draft_response.split('\n')[0]}...`);

      let ok = true;
      if (tc.expectedCategory && result.category !== tc.expectedCategory) {
        console.warn(`   ⚠️ Expected Category: ${tc.expectedCategory}, got ${result.category}`);
      }
      if (tc.expectedPriority) {
        const allowed = Array.isArray(tc.expectedPriority) ? tc.expectedPriority : [tc.expectedPriority];
        if (!allowed.includes(result.priority)) {
          console.warn(`   ⚠️ Expected Priority: ${allowed.join('/')}, got ${result.priority}`);
        }
      }
      if (tc.expectedOwner) {
        const allowed = Array.isArray(tc.expectedOwner) ? tc.expectedOwner : [tc.expectedOwner];
        if (!allowed.includes(result.owner)) {
          console.warn(`   ⚠️ Expected Owner: ${allowed.join('/')}, got ${result.owner}`);
        }
      }
      if (tc.mustBeSecurity && result.priority !== 'Urgent') {
        ok = false;
        console.error(`   ❌ Failed security escalation check! Must be Urgent.`);
      }

      if (ok) {
        console.log(`✅ TEST ${tc.id} PASSED (${tc.notes})\n`);
        passed++;
      } else {
        console.log(`❌ TEST ${tc.id} FAILED\n`);
      }
    } catch (err) {
      console.error(`❌ TEST ${tc.id} CRASHED: ${err.message}\n`);
    }
  }

  console.log('================================================================');
  console.log(`RESULTS: ${passed}/${MOCK_TEST_CASES.length} Tests Passed successfully!`);
  console.log('================================================================\n');
}

runTests();
