import makeWASocket, { DisconnectReason, useMultiFileAuthState } from "@whiskeysockets/baileys";
import express from "express";
import qrcode from "qrcode-terminal";

const app = express();
app.get("/", (req, res) => res.send("Bot is running!"));
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`SERVER RUNNING on PORT ${port}`));

async function connect() {
  const { state, saveCreds } = await useMultiFileAuthState("auth_info");
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", ({ connection, lastDisconnect }) => {
    if (connection === "close") {
      const reason = lastDisconnect?.error?.output?.statusCode;
      if (reason !== DisconnectReason.loggedOut) {
        connect();
      }
    } else if (connection === "open") {
      console.log("🔥 BOT CONNECTED!");
    }
  });

  sock.ev.on("messages.upsert", async ({ messages }) => {
    const m = messages[0];
    if (!m.message || !m.key.remoteJid) return;
    const text = m.message.conversation || m.message.extendedTextMessage?.text;
    if (!text) return;

    console.log("📩 Message:", text);

    if (text.toLowerCase() === "hi" || text.toLowerCase() === "hello") {
      await sock.sendMessage(m.key.remoteJid, { text: "Hello 👋 Bot is Online!" });
    }

    if (text === "ping") {
      await sock.sendMessage(m.key.remoteJid, { text: "pong!" });
    }
  });
}

connect();
