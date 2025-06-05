/* Cargamos el SDK de Supabase desde un CDN */
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

/* Conectamos con tus credenciales (se definen en Vercel) */
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

/* Referencias a elementos del DOM */
const chat   = document.getElementById("chat");
const form   = document.getElementById("form");
const qInput = document.getElementById("q");

/* Manejamos el envío del formulario */
form.onsubmit = async (e) => {
  e.preventDefault();
  const pregunta = qInput.value.trim();
  if (!pregunta) return;        // No mandamos vacíos
  print("🧑‍💼 " + pregunta);   // Mostramos al usuario
  qInput.value = "";            // Limpiamos el input

  /* 1. Traemos los locales (3 filas) */
  const { data } = await supabase.from("locales").select("*");

  /* 2. Construimos el prompt para el modelo de texto */
  const prompt = `
CONTEXTO: ${JSON.stringify(data)}
GIROS: restaurante, cafetería, oficina, coworking, consultorio, mercado, salón de belleza, barbería, heladería, imprenta, gimnasio, electrodomésticos, boutique, farmacia, muebles.
CLIENTE PREGUNTA: """${pregunta}"""
RESPONDE en español de forma breve y clara. 
Si el cliente pide un render, responde exactamente (sola en la línea): NECESITA_RENDER
  `;

  /* 3. Llamamos al modelo gratuito de Hugging Face */
  const res = await fetch(
    "https://api-inference.huggingface.co/models/HuggingFaceH4/zephyr-7b-beta",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${import.meta.env.VITE_HF_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ inputs: prompt, parameters: { max_new_tokens: 256 } }),
    }
  );
  const json  = await res.json();
  const texto = json[0]?.generated_text || "⚠️ No entendí la pregunta.";

  /* 4. Dependiendo de la respuesta, contestamos o generamos imagen */
  if (texto.trim() === "NECESITA_RENDER") {
    pedirGiro(data[0].foto_url);
  } else {
    print("🤖 " + texto);
  }
};

/* Función auxiliar para imprimir mensajes en el chat */
function print(msg) {
  chat.innerHTML += `<p>${msg}</p>`;
  chat.scrollTop  = chat.scrollHeight;
}

/* Flujo para solicitar giro y generar mock-up con Stable Diffusion */
async function pedirGiro(fotoUrl) {
  const giro = prompt("¿Qué giro de negocio? Ej.: farmacia, gimnasio…");
  if (!giro) return;
  print("🤖 Generando imagen… espera ~20 s");

  const promptImg = `Realistic mock-up of a ${giro} inside the building shown here: ${fotoUrl}. Keep same walls, floor and add basic signage and furniture.`;

  const res = await fetch(
    "https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${import.meta.env.VITE_HF_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ inputs: promptImg }),
    }
  );
  const blob = await res.blob();
  const url  = URL.createObjectURL(blob);
  print(`<img src="${url}" style="max-width:100%">`);
}
