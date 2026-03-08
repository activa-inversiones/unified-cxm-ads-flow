/**
 * 🏎️ UNIFIED-CXM ADS FLOW - MODO FERRARI v2.6 (LIVE READY)
 * Central de Inteligencia: Meta Ads + Google Ads + OpenAI + Zoho CRM
 * Optimizada para Producción y Diagnóstico de Permisos
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
        console.log("✔️ [Engine] Motor de base de datos encendido.");
    } catch (e) { 
        console.warn("⚠️ [Engine] Firebase no detectado o mal configurado."); 
    }
}

// --- 2. INTELIGENCIA ARTIFICIAL (OpenAI GPT-4o-mini) ---
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

/**
 * AI Lead Scoring Engine
 * Analiza el perfil del cliente y decide si es VIP (Proyectos Grandes) o Normal.
 */
async function runAiLeadScoring(leadData) {
    if (!OPENAI_API_KEY) return { score: 5, clase: "Normal", razon: "IA no configurada" };

    const prompt = `Analiza este prospecto de ventanas en Chile: ${JSON.stringify(leadData)}.
    Identifica si es una constructora, inmobiliaria o proyecto de alto ticket en la Araucanía.
    Responde estrictamente en JSON: { "score": 1-10, "clase": "VIP"|"Normal", "razon": "breve explicacion" }`;

    try {
        const res = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: "gpt-4o-mini",
            messages: [{ role: "system", content: "Analista Senior de Ventas." }, { role: "user", content: prompt }],
            response_format: { type: "json_object" }
        }, { headers: { 'Authorization': 'Bearer ' + OPENAI_API_KEY } });
        return JSON.parse(res.data.choices[0].message.content);
    } catch (e) {
        return { score: 5, clase: "Normal", razon: "Fallo preventivo en motor IA" };
    }
}

// --- 3. MOTOR CRM (Zoho Automatic Refresh) ---
const ZOHO_CLIENT_ID = process.env.ZOHO_CLIENT_ID;
const ZOHO_CLIENT_SECRET = process.env.ZOHO_CLIENT_SECRET;
const ZOHO_REFRESH_TOKEN = process.env.ZOHO_REFRESH_TOKEN;

/**
 * Obtiene un nuevo Access Token de Zoho usando el Refresh Token permanente.
 */
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
        console.error("❌ [Zoho] Error renovando token.");
        return null;
    }
}

// --- 4. RECEPCIÓN MULTI-ADS (WEBHOOKS) ---

// Webhook Meta: Verificación de seguridad
app.get('/webhook/meta', (req, res) => {
    if (req.query['hub.verify_token'] === process.env.META_VERIFY_TOKEN) {
        res.status(200).send(req.query['hub.challenge']);
    } else {
        res.sendStatus(403);
    }
});

// Webhook Meta: Procesamiento de Leads Reales
app.post('/webhook/meta', async (req, res) => {
    const entry = req.body.entry?.[0];
    const leadId = entry?.changes?.[0]?.value?.leadgen_id;
    
    if (leadId) {
        console.log(`🚀 [Incoming] Procesando Lead ID: ${leadId}`);
        try {
            const fbToken = process.env.META_ACCESS_TOKEN;
            const fbVersion = process.env.META_GRAPH_VERSION || 'v22.0';
            
            // Intento de obtener datos desde Facebook
            const fbRes = await axios.get(`https://graph.facebook.com/${fbVersion}/${leadId}?access_token=${fbToken}`);
            
            const data = fbRes.data;
            const leadInfo = {
                name: data.field_data?.find(f => f.name === 'full_name')?.values[0] || "Cliente Meta",
                email: data.field_data?.find(f => f.name === 'email')?.values[0] || "",
                phone: data.field_data?.find(f => f.name === 'phone_number')?.values[0] || "",
                source: "Meta Ads"
            };

            const score = await runAiLeadScoring(leadInfo);
            const zohoToken = await getFreshZohoToken();

            if (zohoToken) {
                await axios.post("https://www.zohoapis.com/crm/v2/Leads", {
                    data: [{
                        "Last_Name": leadInfo.name,
                        "Email": leadInfo.email,
                        "Phone": leadInfo.phone,
                        "Description": `[IA-RANK: ${score.score}] ${score.razon}`,
                        "Rating": score.clase === "VIP" ? "Alta" : "Media"
                    }]
                }, { headers: { 'Authorization': 'Zoho-oauthtoken ' + zohoToken } });
                console.log(`🏁 [Success] Lead ${leadInfo.name} inyectado en Zoho.`);
            }
        } catch (error) {
            // Manejo específico del error de permisos (Subcode 33)
            if (error.response?.data?.error?.error_subcode === 33) {
                console.error("❌ [Error 400]: Falta permiso de 'Acceso a clientes potenciales' en el Business Manager.");
                console.log("💡 SOLUCIÓN: Ve a Business Manager -> Integraciones -> Acceso a Clientes Potenciales y asigna tu APP a la PÁGINA.");
            } else {
                console.error("❌ [Error Meta API]:", error.response?.data || error.message);
            }
        }
    }
    res.sendStatus(200);
});

// Webhook Google Ads
app.post('/webhook/google', async (req, res) => {
    console.log("🔍 [Google Ads] Lead detectado.");
    res.sendStatus(200);
});

// El puerto lo asigna Railway, por defecto 3000
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log("==========================================");
    console.log(`🏎️  ACTIVA ELITE v2.6 READY ON PORT ${PORT}`);
    console.log("==========================================");
});
