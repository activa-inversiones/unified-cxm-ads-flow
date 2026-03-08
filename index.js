/**
 * 🏎️ UNIFIED-CXM ADS FLOW - MODO FERRARI v2.5 (SUPER-DEBUG)
 * Optimizado para Railway: Autodetección de puerto + Diagnóstico de Error 400
 * Central de Inteligencia: Meta Ads + Google Ads + OpenAI + Zoho CRM
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
        console.log("✔️ [Firebase] Conexión establecida para historial.");
    } catch (e) { 
        console.warn("⚠️ [Firebase] Operando sin base de datos histórica."); 
    }
}

// --- 2. INTELIGENCIA ARTIFICIAL (OpenAI GPT-4o-mini) ---
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

/**
 * AI Lead Scoring Engine
 */
async function runAiLeadScoring(leadData) {
    if (!OPENAI_API_KEY) return { score: 5, clase: "Normal", razon: "IA no configurada" };
    try {
        const res = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: "gpt-4o-mini",
            messages: [{ 
                role: "system", 
                content: "Eres un analista experto en ventas de ventanas premium en Chile." 
            }, { 
                role: "user", 
                content: `Analiza este prospecto: ${JSON.stringify(leadData)}. Responde estrictamente en JSON: { "score": 1-10, "clase": "VIP"|"Normal", "razon": "breve" }` 
            }],
            response_format: { type: "json_object" }
        }, { headers: { 'Authorization': 'Bearer ' + OPENAI_API_KEY } });
        return JSON.parse(res.data.choices[0].message.content);
    } catch (e) { 
        return { score: 5, clase: "Normal", razon: "Fallo en motor IA" }; 
    }
}

// --- 3. MOTOR ZOHO (Refresh Token Permanente) ---
const ZOHO_CLIENT_ID = process.env.ZOHO_CLIENT_ID;
const ZOHO_CLIENT_SECRET = process.env.ZOHO_CLIENT_SECRET;
const ZOHO_REFRESH_TOKEN = process.env.ZOHO_REFRESH_TOKEN;

/**
 * Genera un Access Token fresco de Zoho
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

// --- 4. ENDPOINTS Y DIAGNÓSTICO DE WEBHOOKS ---

// Verificación Meta (GET) - Para validar la URL en el panel de Meta
app.get('/webhook/meta', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
        console.log("✔️ [Meta] Verificación de Webhook exitosa.");
        res.status(200).send(challenge);
    } else {
        console.error("❌ [Meta] Intento de verificación fallido. Verifica el Token.");
        res.sendStatus(403);
    }
});

// Recepción de Leads (POST) - Aquí capturamos el Error 400 al consultar Graph API
app.post('/webhook/meta', async (req, res) => {
    const entry = req.body.entry?.[0];
    const leadId = entry?.changes?.[0]?.value?.leadgen_id;
    
    if (leadId) {
        console.log(`🚀 [Incoming] Procesando Lead ID: ${leadId}`);
        try {
            const fbToken = process.env.META_ACCESS_TOKEN;
            // Usamos v22.0 de la Graph API para obtener los datos del lead
            const fbRes = await axios.get(`https://graph.facebook.com/v22.0/${leadId}?access_token=${fbToken}`);
            
            const data = fbRes.data;
            const leadInfo = {
                name: data.field_data?.find(f => f.name === 'full_name')?.values[0] || "Prospecto Meta",
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
                        "Lead_Source": "Ads Araucanía",
                        "Rating": score.clase === "VIP" ? "Alta" : "Media"
                    }]
                }, { headers: { 'Authorization': 'Zoho-oauthtoken ' + zohoToken } });
                console.log(`🏁 [Success] Lead ${leadInfo.name} inyectado en Zoho CRM.`);
            }
        } catch (error) {
            // DIAGNÓSTICO PROFUNDO PARA ERROR 400
            if (error.response) {
                console.error("❌ [Meta API Error Status]:", error.response.status);
                console.error("📋 [Detalle Técnico del Error]:", JSON.stringify(error.response.data.error));
                console.log("💡 Sugerencia: Revisa si el token en Railway tiene el permiso 'leads_retrieval' y no tiene comillas.");
            } else {
                console.error("❌ [Error de Red]:", error.message);
            }
        }
    }
    res.sendStatus(200);
});

// Endpoint base para Google Ads
app.post('/webhook/google', async (req, res) => {
    console.log("🔍 [Google] Lead recibido.");
    res.sendStatus(200);
});

// Railway asigna el puerto automáticamente mediante la variable de entorno
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`==========================================`);
    console.log(`🏎️  ACTIVA ELITE v2.5 READY ON PORT ${PORT}`);
    console.log(`==========================================`);
});
