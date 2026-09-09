const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, downloadContentFromMessage } = require('@whiskeysockets/baileys');
const pino = require('pino');
const readline = require('readline');
const fs = require('fs');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

let botMode = 'public';

async function startBatmanBot() {
    const { state, saveCreds } = await useMultiFileAuthState('batman_session');
    
    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        auth: state
    });

    if (!sock.authState.creds.registered) {
        const phoneNumber = await question('Apna WhatsApp number likhein (Country code ke sath, misal ke tor par 923491443054): ');
        setTimeout(async () => {
            const code = await sock.requestPairingCode(phoneNumber.trim());
            console.log(`\n🦇 APKA PAIRING CODE YEH HAI: \x1b[32m${code}\x1b[0m\n`);
        }, 3000);
    }

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) {
                startBatmanBot();
            }
        } else if (connection === 'open') {
            console.log('\n🦇 FAMOUS BATMAN BOT SUCCESSFULLY ONLINE HO GAYA HAI! 🦇\n');
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m.message) return;
        
        const chatId = m.key.remoteJid;
        const senderId = m.key.participant || chatId;
        const botNumber = sock.user.id.split(':')[0] + '@s.whatsapp.net';
        const isOwner = m.key.fromMe || senderId.includes('923491443054');

        const text = m.message.conversation || m.message.extendedTextMessage?.text || '';
        if (!text.startsWith('.')) return;

        const command = text.split(' ')[0].toLowerCase();
        const args = text.split(' ').slice(1);

        if (botMode === 'private' && !isOwner) {
            return;
        }

        switch (command) {
            case '.menu':
                const menuText = `
╔════════════════════╗
   🦇 𝐅𝐀𝐌𝐎𝐔𝐒 𝐁𝐀𝐓𝐌𝐀𝐍 🦇
╚════════════════════╝

𝙱𝙰𝚃𝙼𝙰𝙽 𝙿𝙴𝚁𝚂𝙾𝙽𝙰𝙻 𝙱𝙾𝚃 𝙷𝙴𝚁𝙴..

Owner: Folex (Famous Batman)
Bot Mode: ${botMode.toUpperCase()}

📌 *COMMANDS:*
• \`.menu\` - Display bot menu
• \`.ping\` - Check bot speed
• \`.alive\` - Check bot status
• \`.vv\` - Secretly capture View Once to inbox
• \`.repeat <text> <count>\` - Repeat text
• \`.mode private/public\` - Change bot mode

🦇 *Stay in the shadows, rule the system.*
                `.trim();
                await sock.sendMessage(chatId, { text: menuText }, { quoted: m });
                break;

            case '.ping':
                await sock.sendMessage(chatId, { text: 'Pong! 🦇' }, { quoted: m });
                break;

            case '.alive':
                await sock.sendMessage(chatId, { text: '🦇 Famous Batman Bot is active in the shadows.' }, { quoted: m });
                break;

            case '.mode':
                if (!isOwner) {
                    await sock.sendMessage(chatId, { text: '🦇 Yeh command sirf Folex use kar sakta hai!' }, { quoted: m });
                    break;
                }
                if (args[0] === 'private' || args[0] === 'public') {
                    botMode = args[0];
                    await sock.sendMessage(chatId, { text: `🦇 Bot mode successfully changed to: *${botMode.toUpperCase()}*` }, { quoted: m });
                } else {
                    await sock.sendMessage(chatId, { text: '🦇 Use: .mode private ya .mode public' }, { quoted: m });
                }
                break;

            case '.repeat':
                if (args.length < 2) {
                    await sock.sendMessage(chatId, { text: '🦇 Use: .repeat I love you 10' }, { quoted: m });
                    break;
                }
                let count = parseInt(args[args.length - 1]);
                let repeatText = '';
                if (isNaN(count)) {
                    repeatText = args.join(' ');
                    count = 1;
                } else {
                    repeatText = args.slice(0, args.length - 1).join(' ');
                }
                if (count > 50) count = 50;
                for (let i = 0; i < count; i++) {
                    await sock.sendMessage(chatId, { text: repeatText });
                }
                break;

            case '.vv':
                if (!m.message.extendedTextMessage?.contextInfo?.quotedMessage) {
                    break;
                }
                try {
                    let quotedMsg = m.message.extendedTextMessage.contextInfo.quotedMessage;
                    let messageType = Object.keys(quotedMsg)[0];
                    
                    let actualMessage = quotedMsg;
                    if (messageType === 'viewOnceMessage' || messageType === 'viewOnceMessageV2' || messageType === 'viewOnceMessageV2Extension') {
                        actualMessage = quotedMsg[messageType]?.message;
                    }
                    
                    if (!actualMessage) break;
                    let mediaType = Object.keys(actualMessage)[0];
                    if (!mediaType) break;

                    let stream = await downloadContentFromMessage(actualMessage[mediaType], mediaType.replace('Message', '').replace('audio', 'audio'));
                    let buffer = Buffer.from([]);
                    for await (const chunk of stream) {
                        buffer = Buffer.concat([buffer, chunk]);
                    }
                    
                    let ext = 'jpg';
                    if (mediaType.includes('video')) ext = 'mp4';
                    if (mediaType.includes('audio') || mediaType.includes('ptt')) ext = 'opus';

                    let fileName = `./saved_secret_${Date.now()}.${ext}`;
                    fs.writeFileSync(fileName, buffer);
                    
                    let targetInbox = botNumber; 

                    if (ext === 'jpg') {
                        await sock.sendMessage(targetInbox, { image: { url: fileName }, caption: '🦇 [SECRET VV CAPTURED BY FAMOUS BATMAN]' });
                    } else if (ext === 'mp4') {
                        await sock.sendMessage(targetInbox, { video: { url: fileName }, caption: '🦇 [SECRET VV VIDEO CAPTURED]' });
                    } else if (ext === 'opus') {
                        await sock.sendMessage(targetInbox, { audio: { url: fileName }, mimetype: 'audio/ogg; codecs=opus', ptt: true });
                    }
                } catch (err) {
                    console.log('Error in .vv:', err);
                }
                break;
        }
    });
}

startBatmanBot();
                   
