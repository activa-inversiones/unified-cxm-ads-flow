export function registerGoogleRoutes(app, runtime, addAudit) {
  app.post('/webhook/google/conversion', async (req, res) => {
    try {
      const {
        gclid,
        conversion_time,
        value,
        currency_code,
        conversion_name,
        lead_name,
        lead_email,
        lead_phone,
        source
      } = req.body || {};

      if (!gclid || !conversion_time || typeof value === 'undefined') {
        addAudit('google_conversion_invalid', {
          reason: 'missing_required_fields',
          body: req.body
        });

        return res.status(400).json({
          ok: false,
          error: 'Faltan gclid, conversion_time o value'
        });
      }

      runtime.metrics.googleConversions += 1;

      addAudit('google_conversion_received', {
        gclid,
        conversion_time,
        value,
        currency_code: currency_code || 'CLP',
        conversion_name: conversion_name || 'Lead Conversion',
        lead_name: lead_name || '',
        lead_email: lead_email || '',
        lead_phone: lead_phone || '',
        source: source || 'Google Ads'
      });

      console.log('✅ [GOOGLE] Conversión recibida');
      console.log(
        JSON.stringify(
          {
            gclid,
            conversion_time,
            value,
            currency_code: currency_code || 'CLP',
            conversion_name: conversion_name || 'Lead Conversion'
          },
          null,
          2
        )
      );

      return res.status(200).json({
        ok: true,
        staged: true,
        message: 'Conversión recibida y registrada en auditoría'
      });
    } catch (error) {
      console.error('❌ [GOOGLE ERROR]:', error.message);

      addAudit('google_conversion_error', {
        error: error.message
      });

      return res.status(500).json({
        ok: false,
        error: 'Error procesando conversión de Google'
      });
    }
  });
}
