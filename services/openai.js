const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

export async function askOpenAIJson(axios, systemPrompt, userPrompt) {
  if (!OPENAI_API_KEY) {
    return null;
  }

  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        response_format: { type: 'json_object' }
      },
      {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`
        },
        timeout: 20000
      }
    );

    return JSON.parse(response.data.choices[0].message.content);
  } catch (error) {
    console.error('❌ [OPENAI JSON ERROR]:', error.response?.data || error.message);
    return null;
  }
}
