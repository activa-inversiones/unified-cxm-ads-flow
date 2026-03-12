import axios from 'axios';

const SALES_OS_URL = (process.env.SALES_OS_URL || '').replace(/\/$/, '');
const SALES_OS_INGEST_TOKEN = process.env.SALES_OS_INGEST_TOKEN || '';
const SALES_OS_TIMEOUT_MS = Number(process.env.SALES_OS_TIMEOUT_MS || 15000);

export function salesOsConfigured() {
  return Boolean(SALES_OS_URL && SALES_OS_INGEST_TOKEN);
}

export async function pushLeadEvent(payload) {
  if (!salesOsConfigured()) {
    return {
      ok: false,
      skipped: true,
      reason: 'missing_sales_os_config'
    };
  }

  try {
    const { data } = await axios.post(
      `${SALES_OS_URL}/api/ingest/lead`,
      payload,
      {
        headers: {
          'x-api-key': SALES_OS_INGEST_TOKEN,
          'Content-Type': 'application/json'
        },
        timeout: SALES_OS_TIMEOUT_MS
      }
    );

    return {
      ok: true,
      data
    };
  } catch (error) {
    return {
      ok: false,
      error: error?.response?.data || error?.message || 'sales_os_ingest_failed'
    };
  }
}
