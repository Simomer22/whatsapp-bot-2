import makeWASocket, {
    DisconnectReason,
    useMultiFileAuthState,
    fetchLatestBaileysVersion
} from "@whiskeysockets/baileys"
import Pino from "pino"
import { Boom } from "@hapi/boom"
import http from "http"

// Render keep-alive server
http.createServer((req, res) => res.end("Bot running")).listen(process.env.PORT || 3000)

const greetedUsers = new Set()

async function connect() {
    const { state, saveCreds } = await useMultiFileAuthState("./auth_info")
    const { version } = await fetchLatestBaileysVersion()

    const sock = makeWASocket({
        version,
        logger: Pino({ level: "silent" }),
        auth: state
    })

    // Show QR manually
    sock.ev.on("connection.update", (update) => {
        const { qr, connection, lastDisconnect } = update

        if (qr) console.log("\n📌 SCAN THIS QR:\n", qr)

        if (connection === "open") {
            console.log("🤖 BOT CONNECTED!")
        } else if (connection === "close") {
            const reason = new Boom(lastDisconnect?.error)?.output?.statusCode
            console.log("❌ Disconnected", reason)
            if (reason !== DisconnectReason.loggedOut) connect()
        }
    })

    sock.ev.on("creds.update", saveCreds)

    sock.ev.on("messages.upsert", async ({ messages }) => {
        const m = messages[0]

        if (!m.message || m.key.fromMe || !m.key.remoteJid.endsWith("@s.whatsapp.net"))
            return

        const from = m.key.remoteJid
        const message =
            m.message.conversation?.toLowerCase() ||
            m.message.extendedTextMessage?.text?.toLowerCase() ||
            ""

        // Greet only one time
        if (!greetedUsers.has(from)) {
            greetedUsers.add(from)
            await sock.sendMessage(from, { text: "👋 مرحبا! كيف نقدر نعاونك؟" })
        }

        // Catalog keywords
        if (
            ["catalog", "كتالوگ", "produit", "product", "ثمن", "prix"].some(k => message.includes(k))
        ) {
            await sock.sendMessage(from, {
                text:
`🛍️ لائحة المنتجات الحالية:

1️⃣ 🌸 Parfum — 199 MAD
2️⃣ 💧 Crème Hydratante — 149 MAD
3️⃣ ✨ Serum Glow — 249 MAD

اكتب رقم المنتوج باش نعطيك التفاصيل 😉`
            })
            return
        }

        if (message === "1")
            return sock.sendMessage(from, { text: "🌸 Parfum ثمن: 199 MAD 🚚 توصيل لكل المدن" })
        if (message === "2")
            return sock.sendMessage(from, { text: "💧 Crème ثمن: 149 MAD 🚚 توصيل لجميع المدن" })
        if (message === "3")
            return sock.sendMessage(from, { text: "✨ Serum Glow ثمن: 249 MAD 🚚 توصيل متوفر" })

        // Default reply
        if (message.length > 0) {
            await sock.sendMessage(from, { text: `📩 توصلت: *${message}*` })
        }
    })
}

connect()
