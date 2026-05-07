const express = require('express');
const app = express();
app.use(express.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'carolina_bot_token';
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// Webhook verification
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// Receive messages
app.post('/webhook', async (req, res) => {
  res.sendStatus(200);
  try {
    const body = req.body;
    if (body.object !== 'whatsapp_business_account') return;
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const messages = value?.messages;
    if (!messages || messages.length === 0) return;

    const message = messages[0];
    const from = message.from;
    const msgType = message.type;

    let userText = '';
    if (msgType === 'text') {
      userText = message.text.body;
    } else if (msgType === 'audio') {
      userText = '[El cliente envió un audio. Respondé amablemente que por el momento solo podés responder mensajes de texto.]';
    } else if (msgType === 'image') {
      userText = '[El cliente envió una imagen. Respondé amablemente que la viste y preguntá en qué podés ayudarle.]';
    } else {
      userText = '[El cliente envió un archivo. Respondé amablemente que por el momento solo podés responder mensajes de texto.]';
    }

    const reply = await askClaude(userText);
    await sendMessage(from, reply);
  } catch (err) {
    console.error('Error procesando mensaje:', err);
  }
});

async function askClaude(userMessage) {
  const systemPrompt = `Sos la asistente virtual de Carolina Colorista Studio, un centro de coloración profesional ubicado en Buenos Aires, Argentina.

INFORMACIÓN DEL NEGOCIO:
- Nombre: Carolina Colorista Studio
- Ubicación: https://www.google.com/maps/search/Carolina%20colorista/@-34.4442,-58.8686,17z?hl=es
- Horario: Lunes a sábados de 10:00 a 18:00hs (último turno a las 18hs)
- Turnos online: https://agendamiento.reservo.cl/makereserva/agenda/d0VTYLo0G0K2Kv4S7l79obl6b191qh
- Cursos: https://hotmart.com/es/marketplace/productos/the-blonde-club-by-carolina-colorista-master-en-rubios-y-colorimetria/I104956336K

LISTA DE PRECIOS:

COLOR:
- Color Completo: $130.000 (lista) / $119.500 (transferencia) / $104.000 (efectivo)
- Raíces: $76.500 / $68.850 / $61.000
- Baño de luz: $54.000 / $48.600 / $43.000
- Oscuritos / Shadow root: $177.000 / $159.300 / $141.000

ILUMINACIÓN:
- Mechas c/papel (tradicional): $177.000 / $159.300 / $141.000
- Mechas c/papel (Air touch): $205.500 / $184.950 / $164.000
- Reflejos con gorra: $165.000 / $148.500 / $132.000
- Balayage (Air touch): $229.500 / $206.550 / $183.000
- Balayage (tradicional): $191.000 / $176.000 / $153.000
- Contorno (Air Touch): $102.750 / $92.500 / $82.000

EXPERIENCIAS LUXURY:
- Ritual del color (tradicional): $363.000 / $326.700 / $290.000
- Ritual del color (PREMIUM): $453.750 / $408.375 / $363.000

TRATAMIENTOS:
- OLAPLEX (deco): $40.000 / $36.000 / $32.000
- OLAPLEX BOND SHAPER: $105.500 / $95.950 / $85.000
- OLAPLEX RICH MASK: $95.000 / $85.500 / $76.000
- OLAPLEX PRO SCALP: $50.000 / $45.000 / $40.000
- Ampolla rápida (schwarzkopf): $50.000 / $45.000 / $40.000
- Hidratación completa (schw): $87.500 / $78.750 / $70.000

STYLING:
- Lavado + brushing: $79.500 / $71.550 / $63.000
- Ondas / planchita: $60.000 / $54.000 / $48.000
- Lavado: $27.000 / $24.500 / $21.000
- Peinado de fiesta: $105.000 / $94.500 / $84.000
- Corte (incluye lavado + secado): $52.500 / $47.250 / $42.000

ADICIONALES al servicio de color:
- Corte: $37.000 / $33.000 / $30.000
- Lavado: sin costo
- Modelado: sin costo

INSTRUCCIONES:
- Respondé siempre en español, de forma amable, cálida y profesional
- Cuando alguien pregunte por precios, mostrá los tres valores: lista, transferencia y efectivo
- Cuando alguien quiera sacar turno, enviá el link de Reservo
- Cuando alguien pregunte por cursos, enviá el link de Hotmart
- Cuando alguien pregunte dónde están, enviá el link de Google Maps
- Mantené las respuestas cortas y claras, no uses listas largas innecesarias
- Si no sabés algo, decí amablemente que van a responder a la brevedad`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }]
    })
  });

  const data = await response.json();
  return data.content?.[0]?.text || 'Gracias por tu mensaje, te respondemos a la brevedad!';
}

async function sendMessage(to, text) {
  await fetch(`https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${WHATSAPP_TOKEN}`
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: to,
      type: 'text',
      text: { body: text }
    })
  });
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Bot corriendo en puerto ${PORT}`));
