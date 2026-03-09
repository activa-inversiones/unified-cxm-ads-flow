function normalizeEmail(email = '') {
  return String(email || '').trim().toLowerCase();
}

function normalizePhone(phone = '') {
  return String(phone || '').replace(/[^\d+]/g, '').trim();
}

function buildLeadKeys(lead = {}) {
  const keys = [];

  const email = normalizeEmail(lead.email);
  const phone = normalizePhone(lead.phone);
  const source = String(lead.source || '').trim().toLowerCase();
  const leadId = String(lead.lead_id || '').trim();

  if (email) keys.push(`email:${email}`);
  if (phone) keys.push(`phone:${phone}`);
  if (email && phone) keys.push(`combo:${email}|${phone}`);
  if (source && leadId) keys.push(`sourceLead:${source}|${leadId}`);

  return [...new Set(keys)];
}

function ensureRegistry(runtime) {
  if (!runtime._leadRegistry) {
    runtime._leadRegistry = {
      records: new Map(),
      keyToRecordId: new Map()
    };
  }

  if (!runtime._vipLeadIds) {
    runtime._vipLeadIds = new Set();
  }

  return runtime._leadRegistry;
}

function mergePreferIncoming(existing, incoming) {
  const merged = { ...existing };
  const enrichedFields = [];

  for (const [key, value] of Object.entries(incoming)) {
    const current = merged[key];
    const incomingHasValue =
      value !== undefined &&
      value !== null &&
      String(value).trim() !== '';

    const currentHasValue =
      current !== undefined &&
      current !== null &&
      String(current).trim() !== '';

    if (!currentHasValue && incomingHasValue) {
      merged[key] = value;
      enrichedFields.push(key);
      continue;
    }

    if (
      incomingHasValue &&
      currentHasValue &&
      String(current).trim() !== String(value).trim() &&
      ['project_type', 'windows_qty', 'budget', 'message', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'gclid', 'fbclid', 'ttclid', 'page_url', 'form_name'].includes(key)
    ) {
      merged[key] = value;
      enrichedFields.push(key);
    }
  }

  return { merged, enrichedFields };
}

export function upsertLead(runtime, incomingLead = {}, channel = 'unknown') {
  const registry = ensureRegistry(runtime);

  const normalizedLead = {
    ...incomingLead,
    email: normalizeEmail(incomingLead.email),
    phone: normalizePhone(incomingLead.phone),
    source: incomingLead.source || channel
  };

  const keys = buildLeadKeys(normalizedLead);

  let existingRecordId = null;
  for (const key of keys) {
    if (registry.keyToRecordId.has(key)) {
      existingRecordId = registry.keyToRecordId.get(key);
      break;
    }
  }

  if (!existingRecordId) {
    const recordId = `lead_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
    const now = new Date().toISOString();

    const record = {
      id: recordId,
      ...normalizedLead,
      channels: [channel],
      sourcesSeen: [normalizedLead.source || channel],
      firstSeenAt: now,
      lastSeenAt: now,
      touches: 1,
      zohoSynced: false,
      zohoSyncCount: 0,
      lastScore: null
    };

    registry.records.set(recordId, record);
    keys.forEach((key) => registry.keyToRecordId.set(key, recordId));

    return {
      action: 'created',
      record,
      enrichedFields: Object.keys(normalizedLead).filter(
        (key) => String(normalizedLead[key] || '').trim() !== ''
      ),
      dedupeKeys: keys
    };
  }

  const currentRecord = registry.records.get(existingRecordId);
  const { merged, enrichedFields } = mergePreferIncoming(currentRecord, normalizedLead);

  merged.channels = [...new Set([...(currentRecord.channels || []), channel])];
  merged.sourcesSeen = [...new Set([...(currentRecord.sourcesSeen || []), normalizedLead.source || channel])];
  merged.lastSeenAt = new Date().toISOString();
  merged.touches = (currentRecord.touches || 0) + 1;

  registry.records.set(existingRecordId, merged);

  keys.forEach((key) => registry.keyToRecordId.set(key, existingRecordId));

  return {
    action: enrichedFields.length ? 'updated' : 'duplicate',
    record: merged,
    enrichedFields,
    dedupeKeys: keys
  };
}
