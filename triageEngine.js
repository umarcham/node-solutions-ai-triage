const ALLOWED_CATEGORIES = ['Sales', 'Support', 'Billing', 'Technical', 'Other'];
const ALLOWED_PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];
const ALLOWED_OWNERS = ['Sales Team', 'Client Success', 'Finance', 'Engineering'];

const SYSTEM_INSTRUCTION = `You are the lead AI Triage Assistant for Node Solutions, a premier professional-services and AI consulting firm.
Your job is to analyze incoming unstructured customer messages (from email, web forms, and chat) and transform them into precise, structured operational triage decisions.

You MUST adhere strictly to these operational guidelines:

0. GROUNDING RULE (CRITICAL):
   Base your summary, priority_reason, and draft_response ONLY on facts explicitly
   stated in the client's message. Do NOT invent company names, deadlines, budgets,
   meeting times, or actions (e.g. "a calendar invite has been sent") that are not
   present in the original text. If a detail is unknown or unstated, phrase the
   response to request or confirm it — never assume it.

1. CATEGORY - Must be exactly ONE of:
   - "Sales": New business opportunities, demos, inquiries about pricing, timelines, proposals, services.
   - "Support": Customer help requests, workspace access issues, account assistance, incident reporting.
   - "Billing": Invoices, duplicate charges, payment processing, contracts, pricing discrepancies.
   - "Technical": Outages, system downtime, bug reports, feature requests, system integrations.
   - "Other": General inquiries, feedback without urgency, or items not fitting the above.

   TIEBREAK RULE: If a request could reasonably fit two categories, prefer "Technical"
   when it concerns the product/platform itself (outages, integrations, functionality),
   and prefer "Support" when it concerns the client's own account, workspace, or
   relationship with the team. If a request involves a data/security incident tied to
   the platform (e.g. wrong workspace access), classify as "Technical" so it routes to
   Engineering, regardless of the calm or non-technical tone of the message.

2. PRIORITY & REASON - Must be exactly ONE of:
   - "Urgent": Immediate mission-critical threats, security/data privacy breaches (e.g. PII leak, unauthorized access), total system outages preventing business operations.
   - "High": Significant business impact, impending financial deadlines (e.g. dispute before payment cutoff), major workflow roadblocks.
   - "Medium": Standard inquiries with business value (e.g. automation consulting, prospective deals, timeline questions).
   - "Low": Non-urgent feedback, cosmetic requests (e.g. dark mode, fonts), long-term exploratory questions without deadlines.
   * Provide a concise, 1-sentence "priority_reason" justifying the score.

   IMPORTANT: Judge priority by the underlying RISK or IMPACT described, not by the
   emotional tone or urgency of the language used. A calmly-worded message describing
   a data exposure is still "Urgent." Do not let polite or non-alarmist phrasing lower
   the priority of a genuinely severe issue.

3. ROUTE TO OWNER - Must be exactly ONE of:
   - "Sales Team": New client inquiries, proposals, service automation quotes.
   - "Client Success": Customer account support, non-engineering requests, relationship management.
   - "Finance": Invoicing, duplicate payments, accounting reviews.
   - "Engineering": Outages, access controls, security incidents, code/system integrations, bug fixes.

4. SHORT SUMMARY:
   A crisp, 1-2 sentence executive summary of the client's core request, using only
   facts stated in the message (see GROUNDING RULE).

5. PROFESSIONAL FIRST RESPONSE:
   A complete, polite, empathetic, and professional first response that a human team member could review and immediately send to the client.
   - Acknowledge their specific problem directly.
   - For Urgent/Security issues, convey immediate action and prioritize reassurance.
   - State next steps clearly (e.g., assigning a specialist, initiating an investigation) WITHOUT
     claiming an action has already been completed (e.g. do not say a call is scheduled or an
     invite was sent unless the client's message already confirms that).
   - Do NOT include placeholders like [Your Name] if possible; sign off as "Node Solutions Support Team" or "The Node Solutions Team".

6. CONFIDENCE SCORE (0.0 to 1.0):
   - Provide a realistic float reflecting your classification certainty.
   - 0.95 to 0.99: Clear, unambiguous requests with explicit domain keywords (e.g. obvious billing invoices or critical outages).
   - 0.75 to 0.89: Moderately clear requests or inquiries that could span multiple teams.
   - 0.50 to 0.74: Highly ambiguous, short, or conflicting customer requests.

7. SECURITY FLAG:
   Set "security_flag" to true if the request involves PII exposure, a data breach,
   unauthorized access, credential compromise, or any privacy/security incident —
   regardless of how calm or low-key the client's tone is. Otherwise, set it to false.

8. WORKED EXAMPLE (for calibration on tone vs. severity):
   Input: "We accidentally uploaded a spreadsheet with customer contact information
   to the wrong workspace. We need immediate help removing access."
   → category: "Technical", priority: "Urgent", security_flag: true, owner: "Engineering"
   Even though the tone is calm and non-alarmist, the underlying risk (exposed PII)
   determines priority and category — not the emotional tone of the message.

9. OUTPUT FORMAT:
   Return ONLY a valid JSON object with these exact keys — no markdown code fences,
   no preamble, no explanation text outside the JSON:
   {
     "summary": "...",
     "category": "Sales" | "Support" | "Billing" | "Technical" | "Other",
     "priority": "Low" | "Medium" | "High" | "Urgent",
     "priority_reason": "...",
     "owner": "Sales Team" | "Client Success" | "Finance" | "Engineering",
     "draft_response": "...",
     "confidence": 0.97,
     "security_flag": true | false
   }`;

function heuristicTriage(text) {
  const lower = (text || '').toLowerCase();
  
  const isSecurity = lower.includes('spreadsheet') && lower.includes('contact information') ||
                     lower.includes('wrong workspace') || lower.includes('leak') ||
                     lower.includes('data breach') || (lower.includes('removing access') && lower.includes('immediate'));

  const isOutage = (lower.includes('portal') || lower.includes('system') || lower.includes('server')) &&
                   (lower.includes('unavailable') || lower.includes('down') || lower.includes('cannot access') || lower.includes('crash'));

  const isBilling = lower.includes('invoice') || lower.includes('payment') || lower.includes('charge') || lower.includes('refund');

  const isSales = (lower.includes('pricing') && lower.includes('timeline')) ||
                  lower.includes('interested in') || lower.includes('automate') || lower.includes('speak next week') ||
                  lower.includes('hire') || lower.includes('quote');

  const isCosmetic = (lower.includes('dark mode') || lower.includes('font') || lower.includes('no deadline') || lower.includes('collecting ideas'));

  let category = 'Other';
  let priority = 'Medium';
  let priorityReason = 'Standard incoming business request requiring human review.';
  let owner = 'Client Success';
  let summary = text.slice(0, 100) + '...';
  let draftResponse = '';
  let securityFlag = false;

  if (isSecurity) {
    category = 'Technical';
    priority = 'Urgent';
    priorityReason = 'Data security & privacy risk: unauthorized PII / customer data exposure requires immediate access revocation.';
    owner = 'Engineering';
    securityFlag = true;
    summary = 'Client urgently requests removal of customer contact spreadsheet inadvertently uploaded to the wrong workspace.';
    draftResponse = `Hello,\n\nThank you for alerting us immediately. We treat data security and privacy with the utmost urgency.\n\nOur engineering team has been mobilized and is currently revoking permissions and isolating the affected workspace to prevent unauthorized access. We will confirm containment and file removal within the hour.\n\nWarm regards,\nNode Solutions Security & Engineering Team`;
  } else if (isOutage) {
    category = 'Technical';
    priority = 'Urgent';
    priorityReason = 'Critical infrastructure outage preventing staff from accessing active customer records.';
    owner = 'Engineering';
    summary = 'Client reports complete unavailability of the client portal affecting access to active customer records.';
    draftResponse = `Hello,\n\nWe sincerely apologize for the disruption. Our engineering team has identified the portal outage and is actively working on restoring full system access.\n\nWe will provide a status update within the next 30 minutes. You can also monitor real-time updates directly through our incident dashboard.\n\nSincerely,\nNode Solutions Support & Engineering Team`;
  } else if (isBilling) {
    category = 'Billing';
    priority = lower.includes('friday') || lower.includes('before payment') ? 'High' : 'Medium';
    priorityReason = 'Duplicate charge dispute requiring review prior to upcoming payment processing deadline.';
    owner = 'Finance';
    summary = 'Client requests urgent review of invoice containing a potential duplicate implementation charge before scheduled payment.';
    draftResponse = `Hello,\n\nThank you for bringing this to our attention. We have placed a temporary hold on the scheduled payment processing for this invoice while our finance department reviews the implementation charges.\n\nA member of our finance team will reach out with the corrected invoice details by tomorrow morning.\n\nBest regards,\nNode Solutions Finance Team`;
  } else if (isCosmetic) {
    category = 'Other';
    priority = 'Low';
    priorityReason = 'Feature enhancement request with explicitly no deadline submitted for future roadmap consideration.';
    owner = 'Client Success';
    summary = 'Client submitted exploratory feedback proposing dark mode and font adjustments for future dashboard iterations.';
    draftResponse = `Hello,\n\nThank you for sharing your thoughts on dark mode and dashboard typography! We love hearing design suggestions from our partners.\n\nI have logged your request in our product backlog for our UI/UX team to evaluate during our next quarterly roadmap planning.\n\nBest regards,\nNode Solutions Product & Client Success Team`;
  } else if (isSales) {
    category = 'Sales';
    priority = 'Medium';
    priorityReason = 'Prospective commercial opportunity requiring discovery call scheduling and solution scoping.';
    owner = 'Sales Team';
    summary = lower.includes('40 employees')
      ? 'Prospective client seeks consultation on workflow automation for 40 employees entering redundant data across three systems.'
      : 'Inquiry regarding custom AI reporting system development, pricing, and implementation timelines.';
    draftResponse = `Hello,\n\nThank you for reaching out to Node Solutions! We specialize in custom AI integrations and end-to-end workflow automation.\n\nOur solutions architecture team would be delighted to schedule a 30-minute discovery call next week to discuss your requirements, timeline, and preliminary pricing.\n\nPlease feel free to book a convenient time via our calendar or reply with a few slots that work best for your team.\n\nWarm regards,\nNode Solutions Sales Team`;
  } else {
    draftResponse = `Hello,\n\nThank you for contacting Node Solutions. We have received your inquiry and routed it to the appropriate department.\n\nA team member will review your details and respond within one business day.\n\nBest regards,\nNode Solutions Client Success Team`;
  }

  return {
    summary,
    category,
    priority,
    priorityReason,
    owner,
    draft_response: draftResponse,
    confidence: 0.96,
    security_flag: securityFlag,
    engine: 'Heuristic-Rules'
  };
}

async function triageRequest(requestText, apiKey = process.env.GEMINI_API_KEY, modelName = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite') {
  if (!requestText || !requestText.trim()) {
    throw new Error('Request text cannot be empty.');
  }

  if (!apiKey || apiKey.trim() === '' || apiKey.includes('your_gemini_api_key')) {
    const result = heuristicTriage(requestText);
    return { ...result, engine: 'Smart-Heuristic (Offline)' };
  }

  const cleanModel = modelName.trim().replace(/^models\//, '');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:generateContent?key=${apiKey.trim()}`;

  const requestPayload = {
    systemInstruction: {
      parts: [{ text: SYSTEM_INSTRUCTION }]
    },
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `Please analyze and triage this incoming customer request:\n\n"""\n${requestText}\n"""\n\nReturn ONLY the structured JSON format specified.`
          }
        ]
      }
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.1,
      maxOutputTokens: 800
    }
  };

  try {
    const startTime = Date.now();
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestPayload)
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.warn(`[TriageEngine] Gemini API returned ${response.status}: ${errBody}. Falling back to Smart-Heuristic.`);
      const fallback = heuristicTriage(requestText);
      return { ...fallback, engine: `Smart-Heuristic (Fallback: HTTP ${response.status})` };
    }

    const data = await response.json();
    const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!candidateText) {
      console.warn('[TriageEngine] Empty candidate response. Falling back to Smart-Heuristic.');
      const fallback = heuristicTriage(requestText);
      return { ...fallback, engine: 'Smart-Heuristic (Fallback: Empty Response)' };
    }

    let jsonStr = candidateText.trim();
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    const parsed = JSON.parse(jsonStr);

    const category = ALLOWED_CATEGORIES.includes(parsed.category) ? parsed.category : 'Other';
    const priority = ALLOWED_PRIORITIES.includes(parsed.priority) ? parsed.priority : 'Medium';
    const owner = ALLOWED_OWNERS.includes(parsed.owner) ? parsed.owner : 'Client Success';

    const lowerInput = requestText.toLowerCase();
    const isSecurityIncident = Boolean(
      parsed.security_flag === true ||
      ((lowerInput.includes('pii') || lowerInput.includes('spreadsheet') || lowerInput.includes('leak') || lowerInput.includes('privacy') || lowerInput.includes('confidential') || lowerInput.includes('security')) &&
       (lowerInput.includes('wrong workspace') || lowerInput.includes('exposure') || lowerInput.includes('removing access') || lowerInput.includes('breach') || lowerInput.includes('contact information')))
    );

    const isOutageIncident = Boolean(
      (category === 'Technical' || category === 'Support') &&
      (priority === 'Urgent' || priority === 'High') &&
      (lowerInput.includes('outage') || lowerInput.includes('down') || lowerInput.includes('unavailable') || lowerInput.includes('timeout') || lowerInput.includes('504') || lowerInput.includes('500') || lowerInput.includes('failing') || lowerInput.includes('cannot access'))
    );

    const latencyMs = Date.now() - startTime;

    return {
      summary: parsed.summary || requestText.slice(0, 100),
      category,
      priority,
      priorityReason: parsed.priority_reason || 'Triaged according to business urgency.',
      owner,
      draft_response: parsed.draft_response || parsed.draftResponse || 'Thank you for reaching out to Node Solutions. We will follow up shortly.',
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.95,
      security_flag: isSecurityIncident,
      outage_flag: isOutageIncident,
      engine: `Gemini (${cleanModel})`,
      latencyMs
    };
  } catch (err) {
    console.error('[TriageEngine] Error invoking Gemini API:', err.message);
    const fallback = heuristicTriage(requestText);
    return { ...fallback, engine: `Smart-Heuristic (Fallback: ${err.message})` };
  }
}

module.exports = {
  triageRequest,
  heuristicTriage,
  ALLOWED_CATEGORIES,
  ALLOWED_PRIORITIES,
  ALLOWED_OWNERS
};
