import { upsertLead } from '../intelligence/dedupeEngine.js';
import { getFinalLeadScore } from '../intelligence/leadScoring.js';
import { sendLeadToZoho } from './zohoCRM.js';
import { pushLeadEvent, salesOsConfigured } from './salesOsBridge.js';

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

function buildSalesOsLeadPayload(record, scoreInfo, channel, zohoResult) {
  const source = record.source || channel || 'unknown';
  return {
    event_type: `${channel}_lead_received`,
    source,
    channel,
    name: record.name || '',
    lead_name: record.name || '',
    email: record.email || '',
    phone: record.phone || '',
    city: record.city || '',
    comuna: record.city || '',
    project_type: record.project_type || '',
    product_interest: record.project_type || record.form_name || 'ventanas',
    windows_qty: record.windows_qty || '',
    budget: record.budget || '',
    message: record.message || record.notes || '',
    status: scoreInfo.clase === 'VIP' ? 'hot' : 'new',
    zoho_lead_id: zohoResult?.leadId || '',
    external_id: record.lead_id || '',
    metadata: {
      company: record.company || '',
      form_id: record.form_id || '',
      page_id: record.page_id || '',
      gclid: record.gclid || '',
      fbclid: record.fbclid || '',
      ttclid: record.ttclid || '',
      utm_source: record.utm_source || '',
      utm_medium: record.utm_medium || '',
      utm_campaign: record.utm_campaign || '',
      utm_content: record.utm_content || '',
      page_url: record.page_url || '',
      score: scoreInfo.score,
      score_class: scoreInfo.clase
    }
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
      dedupe.record.zohoLeadId = zohoResult.leadId || dedupe.record.zohoLeadId || '';
    }
  }

  let salesOsResult = { ok: false, skipped: true, reason: 'test_or_missing_config' };
  if (!normalizedLead.test_mode && salesOsConfigured()) {
    salesOsResult = await pushLeadEvent(
      buildSalesOsLeadPayload(dedupe.record, finalScore, channel, zohoResult)
    );
  }

  if (salesOsResult.ok) {
    dedupe.record.salesOsSynced = true;
    dedupe.record.salesOsSyncCount = (dedupe.record.salesOsSyncCount || 0) + 1;
    addAudit('sales_os_lead_pushed', {
      channel,
      action: dedupe.action,
      lead_id: dedupe.record.lead_id || '',
      email: dedupe.record.email || '',
      phone: dedupe.record.phone || '',
      salesOsOk: true
    });
  } else {
    addAudit('sales_os_lead_skipped', {
      channel,
      action: dedupe.action,
      lead_id: dedupe.record.lead_id || '',
      email: dedupe.record.email || '',
      phone: dedupe.record.phone || '',
      salesOsOk: false,
      reason: salesOsResult.reason || salesOsResult.error || 'skipped'
    });
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
    zohoOk: zohoResult.ok,
    salesOsOk: salesOsResult.ok
  });

  return {
    ok: true,
    action: dedupe.action,
    dedupeKeys: dedupe.dedupeKeys,
    enrichedFields: dedupe.enrichedFields,
    score: finalScore,
    zoho: zohoResult,
    salesOs: salesOsResult,
    record: dedupe.record
  };
}
