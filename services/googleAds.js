export function registerGoogleRoutes(app, runtime, addAudit) {
  app.post('/webhook/google/conversion', async (req, res) => {
    try {
      console.log('📩 [GOOGLE RAW BODY]:', JSON.stringify(req.body, null, 2));

      const {
        gclid,
        conversion_time,
        value,
        currency_code,
        conversion_name,
        lead_name,
        lead_email,
        lead_phone,
        source,
        test_mode
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
        source: source || 'Google Ads',
        test_mode: Boolean(test_mode)
      });

      console.log('✅ [GOOGLE] Conversión registrada');
      console.log(
        JSON.stringify(
          {
            gclid,
            conversion_time,
            value,
            currency_code: currency_code || 'CLP',
            conversion_name: conversion_name || 'Lead Conversion',
            test_mode: Boolean(test_mode)
          },
          null,
          2
        )
      );

      return res.status(200).json({
        ok: true,
        staged: true,
        googleConversions: runtime.metrics.googleConversions,
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
