import makeWASocket, {
    DisconnectReason,
    useMultiFileAuthState,
    fetchLatestBaileysVersion
} from "@whiskeysockets/baileys"
import Pino from "pino"
import { Boom } from "@hapi/boom"
import http from "http"

// Server for Render
http.createServer((req, res) => res.end("Bot running")).listen(process.env.PORT || 3000)

const greetedUsers = new Set()

async function connect() {
    const { state, saveCreds } = await useMultiFileAuthState("./auth_info")
    const { version } = await fetchLatestBaileysVersion()

    const sock = makeWASocket({
        version,
        logger: Pino({ level: "silent" }),
        printQRInTerminal: true,
        auth: state
    })

    sock.ev.process(async (events) => {
        if (events["connection.update"]) {
            const update = events["connection.update"]
            const reason = new Boom(update.lastDisconnect?.error)?.output?.statusCode

            if (update.connection === "close") {
                console.log("Connection closed", reason)
                if (reason !== DisconnectReason.loggedOut) {
                    connect()
                }
            } else if (update.connection === "open") {
                console.log("🤖 BOT CONNECTED!")
            }
        }

        if (events["creds.update"]) {
            await saveCreds()
        }

        if (events["messages.upsert"]) {
            const m = events["messages.upsert"].messages[0]

            if (
                !m.message ||
                !m.key.remoteJid.endsWith("@s.whatsapp.net") ||
                m.key.fromMe // ⛔ باش مايسباميش راسو
            ) return

            const from = m.key.remoteJid
            const message = m.message.conversation?.toLowerCase() ||
                            m.message.extendedTextMessage?.text?.toLowerCase() ||
                            ""

            // Greeting once
            if (!greetedUsers.has(from)) {
                greetedUsers.add(from)
                await sock.sendMessage(from, { text: "👋 مرحبا بيك! كيف نقدر نعاونك؟" })
            }

            // Catalog keywords
            const keywords = ["catalog", "كتالوگ", "produit", "product", "ثمن", "prix"]
            if (keywords.some(k => message.includes(k))) {
                await sock.sendMessage(from, {
                    text:
`🛍️ قائمة المنتجات:

1️⃣ 🌸 Parfum 199 MAD
2️⃣ 💧 Crème Hydratante 149 MAD
3️⃣ ✨ Serum Glow 249 MAD

بغيت شي حاجة؟ كتب الرقم 😉`
                })
                return
            }

            // Reply numbers
            if (message === "1") await sock.sendMessage(from, { text: "🌸 Parfum ثمن 199 درهم 🚚 توصيل متوفر" })
            if (message === "2") await sock.sendMessage(from, { text: "💧 Crème Hydratante ثمن 149 درهم 🚚 توصيل متوفر" })
            if (message === "3") await sock.sendMessage(from, { text: "✨ Serum Glow ثمن 249 درهم 🚚 توصيل متوفر" })

            // Default echo
            if (message.length > 0) {
                await sock.sendMessage(from, { text: `📩 توصلت: *${message}*` })
            }
        }
    })
}

connect()
