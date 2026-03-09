import { askOpenAIJson } from '../services/openai.js';

function includesText(value, options = []) {
  const text = String(value || '').toLowerCase();
  return options.some((option) => text.includes(String(option).toLowerCase()));
}

export function normalizeLeadInfoFromMeta(metaLeadData) {
  const fieldData = metaLeadData.field_data || [];

  const getField = (possibleNames = []) => {
    for (const name of possibleNames) {
      const found = fieldData.find((f) => f.name === name);
      if (found?.values?.[0]) return found.values[0];
    }
    return '';
  };

  return {
    lead_id: metaLeadData.id || '',
    created_time: metaLeadData.created_time || '',
    ad_id: metaLeadData.ad_id || '',
    form_id: metaLeadData.form_id || '',
    page_id: metaLeadData.page_id || '',
    name: getField(['full_name', 'name']),
    email: getField(['email']),
    phone: getField(['phone_number', 'phone']),
    windows_qty: getField([
      '¿cuántas ventanas necesitas cotizar?',
      'cuantas_ventanas_necesitas_cotizar',
      'cantidad_ventanas'
    ]),
    project_type: getField([
      'tipo de proyecto',
      'tipo_de_proyecto'
    ]),
    budget: getField([
      'presupuesto estimado para ventanas',
      'presupuesto_estimado_para_ventanas'
    ]),
    source: 'Meta Ads Elite',
    raw_field_data: fieldData
  };
}

export function scoreLeadByRules(leadInfo) {
  let score = 5;
  const reasons = [];

  if (
    includesText(leadInfo.windows_qty, ['10 a 30', 'más de 30', 'mas de 30'])
  ) {
    score += 2;
    reasons.push('alto volumen de ventanas');
  }

  if (
    includesText(leadInfo.project_type, [
      'proyecto inmobiliario',
      'condominio',
      'hotel',
      'cabañas',
      'cabanas',
      'construcción nueva',
      'construccion nueva'
    ])
  ) {
    score += 2;
    reasons.push('tipo de proyecto premium');
  }

  if (
    includesText(leadInfo.budget, [
      '$3m',
      '$10m',
      'más de $10m',
      'mas de $10m'
    ])
  ) {
    score += 2;
    reasons.push('presupuesto alto');
  }

  const finalScore = Math.min(score, 10);

  return {
    score: finalScore,
    clase: finalScore >= 8 ? 'VIP' : 'Normal',
    razon: reasons.length ? reasons.join(', ') : 'clasificación base'
  };
}

export async function scoreLeadWithAI(axios, leadInfo) {
  const systemPrompt =
    'Eres analista senior comercial de Activa Inversiones. Clasificas leads de ventanas PVC premium para detectar prospectos de alto valor.';

  const userPrompt = `
Analiza este lead y responde estrictamente en JSON:
{
  "score": 1-10,
  "clase": "VIP" o "Normal",
  "razon": "explicación breve"
}

Lead:
${JSON.stringify(leadInfo, null, 2)}
  `.trim();

  const aiResult = await askOpenAIJson(axios, systemPrompt, userPrompt);

  if (!aiResult) {
    return {
      score: 5,
      clase: 'Normal',
      razon: 'IA no disponible'
    };
  }

  return {
    score: Number(aiResult.score) || 5,
    clase: aiResult.clase === 'VIP' ? 'VIP' : 'Normal',
    razon: aiResult.razon || 'sin detalle'
  };
}

export async function getFinalLeadScore(axios, leadInfo) {
  const ruleScore = scoreLeadByRules(leadInfo);
  const aiScore = await scoreLeadWithAI(axios, leadInfo);

  return {
    score: Math.max(ruleScore.score, aiScore.score),
    clase:
      ruleScore.clase === 'VIP' || aiScore.clase === 'VIP'
        ? 'VIP'
        : 'Normal',
    razon: `${ruleScore.razon} | IA: ${aiScore.razon}`,
    detail: {
      rules: ruleScore,
      ai: aiScore
    }
  };
}
