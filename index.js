/**
 * 🏎️ UNIFIED-CXM ADS FLOW - MODO FERRARI v2.2 (DEFINITIVO)
 * Ecosistema: Meta Ads + Google Ads + TikTok + OpenAI + Zoho CRM + Firebase
 * Diseñado para dominar el mercado de ventanas premium en la Araucanía.
 */

import express from 'express';
import axios from 'axios';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, collection } from 'firebase/firestore';
import { getAuth, signInWithCustomToken } from 'firebase/auth';

const app = express();
app.use(express.json());

// --- 1. MOTOR DE PERSISTENCIA (Firebase) ---
let db, auth;
const firebaseConfigStr = process.env.FIREBASE_CONFIG;
const appId = process.env.APP_ID || 'activa-elite-cxm';

if (firebaseConfigStr && firebaseConfigStr !== "{}" && firebaseConfigStr !== undefined) {
    try {
        const firebaseConfig = JSON.parse(firebaseConfigStr);
        const firebaseApp = initializeApp(firebaseConfig);
        db = getFirestore(firebaseApp);
        auth = getAuth(firebaseApp);
        console.log("✔️ [Engine] Firestore conectado para historial de leads.");
    } catch (e) {
        console.warn("⚠️ [Engine] Firebase no detectado. Modo 'Sin Historial' activado.");
    }
}

// --- 2. INTELIGENCIA ARTIFICIAL (OpenAI GPT-4o-mini) ---
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

/**
 * AI Lead Scoring Engine
 */
async function runAiLeadScoring(leadData) {
    if (!OPENAI_API_KEY) return { score: 5, clase: "Normal", razon: "IA no configurada" };

    const prompt = `Analiza este lead para venta de ventanas de PVC Activa en Chile: ${JSON.stringify(leadData)}.
    Identifica si es un cliente de alto ticket: ¿Constructora? ¿Hotel? ¿Proyecto inmobiliario en Pucón/Villarrica?
    Responde estrictamente en JSON: { "score": 1-10, "clase": "VIP"|"Normal", "razon": "breve explicacion comercial" }`;

    try {
        const res = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: "gpt-4o-mini",
            messages: [{ role: "system", content: "Analista Senior Inmobiliario." }, { role: "user", content: prompt }],
            response_format: { type: "json_object" }
        }, { headers: { 'Authorization': 'Bearer ' + OPENAI_API_KEY } });
        return JSON.parse(res.data.choices[0].message.content);
    } catch (e) {
        return { score: 5, clase: "Normal", razon: "Error preventivo en motor IA" };
    }
}

// --- 3. MOTOR DE CRM (Zoho Automatic Refresh) ---
const ZOHO_CLIENT_ID = process.env.ZOHO_CLIENT_ID;
const ZOHO_CLIENT_SECRET = process.env.ZOHO_CLIENT_SECRET;
const ZOHO_REFRESH_TOKEN = process.env.ZOHO_REFRESH_TOKEN;

async function getFreshZohoToken() {
    try {
        const params = new URLSearchParams();
        params.append('refresh_token', ZOHO_REFRESH_TOKEN);
        params.append('client_id', ZOHO_CLIENT_ID);
        params.append('client_secret', ZOHO_CLIENT_SECRET);
        params.append('grant_type', 'refresh_token');
        const res = await axios.post('https://accounts.zoho.com/oauth/v2/token', params);
        return res.data.access_token;
    } catch (e) {
        console.error("❌ [Zoho] Error de refresco:", e.message);
        return null;
    }
}

// --- 4. RECEPCIÓN MULTI-ADS ---

// A. WEBHOOK META (FB/IG)
app.get('/webhook/meta', (req, res) => {
    if (req.query['hub.verify_token'] === process.env.META_VERIFY_TOKEN) {
        res.status(200).send(req.query['hub.challenge']);
    } else { res.sendStatus(403); }
});

app.post('/webhook/meta', async (req, res) => {
    const leadId = req.body.entry?.[0]?.changes?.[0]?.value?.leadgen_id;
    if (leadId) {
        try {
            const fbToken = process.env.META_ACCESS_TOKEN;
            const fbRes = await axios.get('https://graph.facebook.com/v22.0/' + leadId + '?access_token=' + fbToken);
            const data = fbRes.data;
            const leadInfo = {
                name: data.field_data?.find(f => f.name === 'full_name')?.values[0] || "Cliente Meta",
                email: data.field_data?.find(f => f.name === 'email')?.values[0] || "",
                phone: data.field_data?.find(f => f.name === 'phone_number')?.values[0] || "",
                source: "Meta Ads Araucania"
            };

            const score = await runAiLeadScoring(leadInfo);
            const zohoToken = await getFreshZohoToken();

            if (zohoToken) {
                await axios.post("https://www.zohoapis.com/crm/v2/Leads", {
                    data: [{
                        "Last_Name": leadInfo.name,
                        "Email": leadInfo.email,
                        "Phone": leadInfo.phone,
                        "Description": `[GPT-Score: ${score.score}] ${score.razon}`,
                        "Rating": score.clase === "VIP" ? "Alta" : "Media"
                    }]
                }, { headers: { 'Authorization': 'Zoho-oauthtoken ' + zohoToken } });
                console.log(`🏁 Lead Meta enviado a Zoho: ${leadInfo.name}`);
            }
        } catch (e) { console.error("❌ Error Meta:", e.message); }
    }
    res.sendStatus(200);
});

// B. WEBHOOK GOOGLE ADS (Lead Forms)
app.post('/webhook/google', async (req, res) => {
    try {
        const data = req.body;
        const leadInfo = {
            name: data.user_column_data?.find(c => c.column_id === 'FULL_NAME')?.string_value || "Cliente Google",
            email: data.user_column_data?.find(c => c.column_id === 'EMAIL')?.string_value || "",
            phone: data.user_column_data?.find(c => c.column_id === 'PHONE_NUMBER')?.string_value || "",
            source: "Google Search Ads",
            gclid: data.google_key
        };
        const score = await runAiLeadScoring(leadInfo);
        const zohoToken = await getFreshZohoToken();
        if (zohoToken) {
            await axios.post("https://www.zohoapis.com/crm/v2/Leads", {
                data: [{
                    "Last_Name": leadInfo.name,
                    "Email": leadInfo.email,
                    "Phone": leadInfo.phone,
                    "Description": `[GPT-Score: ${score.score}] ${score.razon} | GCLID: ${leadInfo.gclid}`,
                    "Google_Click_ID": leadInfo.gclid // Debes crear este campo en Zoho
                }]
            }, { headers: { 'Authorization': 'Zoho-oauthtoken ' + zohoToken } });
        }
    } catch (e) { console.error("❌ Error Google:", e.message); }
    res.sendStatus(200);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🏎️ ACTIVA ELITE v2.2 ENGINE READY ON PORT ${PORT}`));
