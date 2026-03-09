export function registerSocialListeningRoutes(app, runtime, addAudit) {
  app.post('/api/social/mention', (req, res) => {
    try {
      const {
        platform,
        author,
        text,
        sentiment,
        estimatedReach,
        keyword,
        competitor,
        url,
        publishedAt
      } = req.body || {};

      if (!platform || !author || !text) {
        addAudit('social_mention_invalid', {
          reason: 'missing_required_fields',
          body: req.body
        });

        return res.status(400).json({
          ok: false,
          error: 'Faltan platform, author o text'
        });
      }

      runtime.metrics.socialMentions += 1;

      // aproximación simple mientras no tengamos base de datos real
      if (!runtime._socialAuthors) {
        runtime._socialAuthors = new Set();
      }

      runtime._socialAuthors.add(String(author).toLowerCase());
      runtime.metrics.socialUniqueAuthors = runtime._socialAuthors.size;

      addAudit('social_mention_received', {
        platform,
        author,
        sentiment: sentiment || 'neutral',
        estimatedReach: estimatedReach || 0,
        keyword: keyword || '',
        competitor: competitor || '',
        url: url || '',
        publishedAt: publishedAt || new Date().toISOString()
      });

      console.log('✅ [SOCIAL] Mención registrada');
      console.log(
        JSON.stringify(
          {
            platform,
            author,
            sentiment: sentiment || 'neutral',
            keyword: keyword || '',
            competitor: competitor || ''
          },
          null,
          2
        )
      );

      return res.status(200).json({
        ok: true,
        message: 'Mención registrada',
        socialMentions: runtime.metrics.socialMentions,
        socialUniqueAuthors: runtime.metrics.socialUniqueAuthors
      });
    } catch (error) {
      console.error('❌ [SOCIAL LISTENING ERROR]:', error.message);

      addAudit('social_mention_error', {
        error: error.message
      });

      return res.status(500).json({
        ok: false,
        error: 'Error registrando mención social'
      });
    }
  });
}
