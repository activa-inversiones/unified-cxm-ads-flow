const ZOHO_CLIENT_ID = process.env.ZOHO_CLIENT_ID || '';
const ZOHO_CLIENT_SECRET = process.env.ZOHO_CLIENT_SECRET || '';
const ZOHO_REFRESH_TOKEN = process.env.ZOHO_REFRESH_TOKEN || '';
const ZOHO_API_DOMAIN = (process.env.ZOHO_API_DOMAIN || 'https://www.zohoapis.com').replace(/\/$/, '');
const ZOHO_ACCOUNTS_DOMAIN = (process.env.ZOHO_ACCOUNTS_DOMAIN || 'https://accounts.zoho.com').replace(/\/$/, '');
const ZOHO_TOKEN_TIMEOUT_MS = Number(process.env.ZOHO_TOKEN_TIMEOUT_MS || 20000);

let tokenCache = {
  accessToken: '',
  expiresAt: 0
};

export async function getFreshZohoToken(axios) {
  if (!ZOHO_CLIENT_ID || !ZOHO_CLIENT_SECRET || !ZOHO_REFRESH_TOKEN) {
    return null;
  }

  if (tokenCache.accessToken && Date.now() < tokenCache.expiresAt) {
    return tokenCache.accessToken;
  }

  try {
    const params = new URLSearchParams();
    params.append('refresh_token', ZOHO_REFRESH_TOKEN);
    params.append('client_id', ZOHO_CLIENT_ID);
    params.append('client_secret', ZOHO_CLIENT_SECRET);
    params.append('grant_type', 'refresh_token');

    const response = await axios.post(
      `${ZOHO_ACCOUNTS_DOMAIN}/oauth/v2/token`,
      params,
      { timeout: ZOHO_TOKEN_TIMEOUT_MS }
    );

    tokenCache = {
      accessToken: response.data.access_token,
      expiresAt: Date.now() + ((Number(response.data.expires_in) || 3600) * 1000) - 60000
    };

    return tokenCache.accessToken;
  } catch (error) {
    console.error('âŒ [ZOHO TOKEN ERROR]:', error.response?.data || error.message);
    return null;
  }
}

export async function sendLeadToZoho(axios, leadInfo, scoreInfo) {
  const zohoToken = await getFreshZohoToken(axios);

  if (!zohoToken) {
    return { ok: false, reason: 'missing_zoho_token' };
  }

  const description = [
    `[Lead Score ${scoreInfo.score}/10] ${scoreInfo.razon}`,
    `Clase: ${scoreInfo.clase}`,
    `Proyecto: ${leadInfo.project_type || 'N/D'}`,
    `Ventanas: ${leadInfo.windows_qty || 'N/D'}`,
    `Presupuesto: ${leadInfo.budget || 'N/D'}`,
    `Lead ID: ${leadInfo.lead_id || 'N/D'}`,
    `Form ID: ${leadInfo.form_id || 'N/D'}`,
    `Page ID: ${leadInfo.page_id || 'N/D'}`,
    `UTM Source: ${leadInfo.utm_source || 'N/D'}`,
    `UTM Campaign: ${leadInfo.utm_campaign || 'N/D'}`
  ].join('\n');

  const payload = {
    data: [
      {
        Last_Name: leadInfo.name || 'Lead Ads',
        Email: leadInfo.email || '',
        Phone: leadInfo.phone || '',
        Lead_Source: leadInfo.source || 'Unified CXM',
        Rating: scoreInfo.clase === 'VIP' ? 'Alta' : 'Media',
        Company: leadInfo.company || '',
        City: leadInfo.city || '',
        Description: description
      }
    ]
  };

  try {
    const response = await axios.post(
      `${ZOHO_API_DOMAIN}/crm/v2/Leads`,
      payload,
      {
        headers: {
          Authorization: `Zoho-oauthtoken ${zohoToken}`
        },
        timeout: 20000
      }
    );

    return {
      ok: true,
      data: response.data,
      leadId: response.data?.data?.[0]?.details?.id || null
    };
  } catch (error) {
    console.error('âŒ [ZOHO LEAD ERROR]:', error.response?.data || error.message);
    return {
      ok: false,
      reason: 'zoho_insert_error',
      error: error.response?.data || error.message
    };
  }
}
