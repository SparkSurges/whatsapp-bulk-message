const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { logger } = require('./utils');

class WhatsAppService {
    constructor() {
        this.client = new Client({
            authStrategy: new LocalAuth({ clientId: 'client', dataPath: './.wwebjs_auth' })
        })
    }

    async initialize() {
        this.client.on('qr', (qr) => {
            logger.info('Scanning the QR code...')
            qrcode.generate(qr, { small: true });
        });

        this.client.on('ready', () => {
            logger.info('WhatsAppService is ready!');
        });

        await this.client.initialize();
    }

    async sendMessage(message, contact) {
        if (!message || !contact) {
            throw new Error('Undefined type value');
        }

        if (!(typeof message == 'string' && typeof contact == 'string')) {
            throw new Error('Invalid type value');
        }

        const chatId = contact + '@c.us';
        await this.client.sendMessage(chatId, message);
    }

    async close() {
        logger.info('Closing the WhatsApp...');
        this.client.destroy();
    }
}

module.exports = WhatsAppService;