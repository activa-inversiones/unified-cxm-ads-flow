export function registerGoogleRoutes(app, runtime, addAudit) {
  app.post('/webhook/google/conversion', async (req, res) => {
    try {
      const { gclid, conversion_time, value, currency_code } = req.body || {};

      if (!gclid || !conversion_time || typeof value === 'undefined') {
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
        currency_code: currency_code || 'CLP'
      });

      return res.json({
        ok: true,
        staged: true
      });
    } catch (error) {
      addAudit('google_conversion_error', {
        error: error.message
      });

      return res.status(500).json({
        ok: false,
        error: 'Error Google conversion'
      });
    }
  });
}
