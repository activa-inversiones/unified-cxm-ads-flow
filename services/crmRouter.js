import { upsertLead } from '../intelligence/dedupeEngine.js';
import { getFinalLeadScore } from '../intelligence/leadScoring.js';
import { sendLeadToZoho } from './zohoCRM.js';

function normalizeGenericLead(lead = {}, channel = 'unknown') {
  return {
    lead_id: lead.lead_id || '',
    form_id: lead.form_id || '',
    page_id: lead.page_id || '',
    source: lead.source || channel,
    name: lead.name || '',
    email: lead.email || '',
    phone: lead.phone || '',
    company: lead.company || '',
    city: lead.city || '',
    notes: lead.notes || '',
    message: lead.message || '',
    project_type: lead.project_type || '',
    windows_qty: lead.windows_qty || '',
    budget: lead.budget || '',
    gclid: lead.gclid || '',
    fbclid: lead.fbclid || '',
    ttclid: lead.ttclid || '',
    utm_source: lead.utm_source || '',
    utm_medium: lead.utm_medium || '',
    utm_campaign: lead.utm_campaign || '',
    utm_content: lead.utm_content || '',
    page_url: lead.page_url || '',
    form_name: lead.form_name || '',
    created_at: lead.created_at || new Date().toISOString(),
    test_mode: Boolean(lead.test_mode)
  };
}

export async function processInboundLead(axios, runtime, addAudit, leadInfo, options = {}) {
  const channel = options.channel || 'unknown';
  const sendToCRM = options.sendToCRM !== false;

  const normalizedLead = normalizeGenericLead(leadInfo, channel);

  const dedupe = upsertLead(runtime, normalizedLead, channel);

  const finalScore = await getFinalLeadScore(axios, dedupe.record);
  dedupe.record.lastScore = finalScore;

  if (!runtime._vipLeadIds) {
    runtime._vipLeadIds = new Set();
  }

  if (finalScore.clase === 'VIP' && !runtime._vipLeadIds.has(dedupe.record.id)) {
    runtime._vipLeadIds.add(dedupe.record.id);
    runtime.metrics.vipLeads += 1;
  }

  let zohoResult = { ok: false, reason: 'crm_skipped' };
  const shouldSendToZoho =
    sendToCRM &&
    (dedupe.action === 'created' ||
      (dedupe.action === 'updated' && dedupe.enrichedFields.length > 0 && !dedupe.record.zohoSynced));

  if (shouldSendToZoho) {
    zohoResult = await sendLeadToZoho(axios, dedupe.record, finalScore);

    if (zohoResult.ok) {
      dedupe.record.zohoSynced = true;
      dedupe.record.zohoSyncCount = (dedupe.record.zohoSyncCount || 0) + 1;
    }
  }

  addAudit('crm_router_processed', {
    channel,
    action: dedupe.action,
    lead_id: dedupe.record.lead_id || '',
    email: dedupe.record.email || '',
    phone: dedupe.record.phone || '',
    enrichedFields: dedupe.enrichedFields,
    score: finalScore.clase,
    scoreValue: finalScore.score,
    zohoOk: zohoResult.ok
  });

  return {
    ok: true,
    action: dedupe.action,
    dedupeKeys: dedupe.dedupeKeys,
    enrichedFields: dedupe.enrichedFields,
    score: finalScore,
    zoho: zohoResult,
    record: dedupe.record
  };
}
