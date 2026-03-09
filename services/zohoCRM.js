const ZOHO_CLIENT_ID = process.env.ZOHO_CLIENT_ID || '';
const ZOHO_CLIENT_SECRET = process.env.ZOHO_CLIENT_SECRET || '';
const ZOHO_REFRESH_TOKEN = process.env.ZOHO_REFRESH_TOKEN || '';

export async function getFreshZohoToken(axios) {
  if (!ZOHO_CLIENT_ID || !ZOHO_CLIENT_SECRET || !ZOHO_REFRESH_TOKEN) {
    return null;
  }

  try {
    const params = new URLSearchParams();
    params.append('refresh_token', ZOHO_REFRESH_TOKEN);
    params.append('client_id', ZOHO_CLIENT_ID);
    params.append('client_secret', ZOHO_CLIENT_SECRET);
    params.append('grant_type', 'refresh_token');

    const response = await axios.post(
      'https://accounts.zoho.com/oauth/v2/token',
      params,
      { timeout: 20000 }
    );

    return response.data.access_token;
  } catch (error) {
    console.error('❌ [ZOHO TOKEN ERROR]:', error.response?.data || error.message);
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
    `Lead ID Meta: ${leadInfo.lead_id || 'N/D'}`,
    `Form ID: ${leadInfo.form_id || 'N/D'}`,
    `Page ID: ${leadInfo.page_id || 'N/D'}`
  ].join('\n');

  const payload = {
    data: [
      {
        Last_Name: leadInfo.name || 'Lead Meta',
        Email: leadInfo.email || '',
        Phone: leadInfo.phone || '',
        Lead_Source: leadInfo.source || 'Meta Ads',
        Rating: scoreInfo.clase === 'VIP' ? 'Alta' : 'Media',
        Description: description
      }
    ]
  };

  try {
    const response = await axios.post(
      'https://www.zohoapis.com/crm/v2/Leads',
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
      data: response.data
    };
  } catch (error) {
    console.error('❌ [ZOHO LEAD ERROR]:', error.response?.data || error.message);
    return {
      ok: false,
      reason: 'zoho_insert_error',
      error: error.response?.data || error.message
    };
  }
}
