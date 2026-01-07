const WebSocket = require("ws");
const mqtt = require("mqtt");

// --- CONFIGURATION ---
const MQTT_BROKER = "mqtt://captain.dev0.pandor.cloud:1884";
const WS_PORT = 8080;

// Connexion au broker distant
const mqttClient = mqtt.connect(MQTT_BROKER);

// Liste des clients WebSocket (le front Svelte)
const webSocketClients = new Set();

// 1. GESTION MQTT
mqttClient.on("connect", () => {
  console.log("✅ Connecté au Broker MQTT Pandor");

  // AJOUT : On s'abonne à la Météo ET au Flipper (flipper/+/+)
  mqttClient.subscribe(["classroom/+/telemetry", "flipper/+/+"], (err) => {
    if (!err) console.log("📡 Abonné aux topics Météo et Flipper");
  });
});

mqttClient.on("message", (topic, message) => {
  // topic exemple : "flipper/esp32-06/buttons" OU "classroom/esp32-02/telemetry"
  const parts = topic.split("/");
  const category = parts[0]; // "classroom" ou "flipper"
  const deviceId = parts[1]; // "esp32-06"
  const subType = parts[2]; // "telemetry", "buttons", "tilt", "plunger"

  try {
    const payload = JSON.parse(message.toString());

    // On prépare un message structuré pour le Svelte
    const dataToSend = {
      category: category, // IMPORTANT : Pour trier dans le front
      subType: subType, // "buttons", "tilt"...
      deviceId: deviceId,
      data: payload,
      timestamp: Date.now(),
    };

    // Broadcast aux clients WebSocket
    webSocketClients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(dataToSend));
      }
    });
  } catch (e) {
    console.error("⚠️ Erreur JSON sur", topic);
  }
});

// 2. GESTION WEBSOCKET
const wss = new WebSocket.Server({ port: WS_PORT });

wss.on("connection", (ws) => {
  console.log("✨ Nouveau client Svelte connecté");
  webSocketClients.add(ws);

  ws.send(
    JSON.stringify({ type: "INFO", message: "Bienvenue sur le Bridge MQTT" }),
  );

  ws.on("close", () => {
    console.log("❌ Client Svelte déconnecté");
    webSocketClients.delete(ws);
  });

  ws.on("error", () => {
    webSocketClients.delete(ws);
  });
});

console.log(`🚀 Bridge démarré sur ws://localhost:${WS_PORT}`);
