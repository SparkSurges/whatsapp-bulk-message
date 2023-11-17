const path = require('path');
const readLine = require('readline');
const fs = require('fs');
const cron = require('node-cron');
const { parse } = require('csv-parse');
const { createArraySequence, sleep, logger } = require('./src/utils');
const WhatsAppService = require('./src/service');
const Database = require('./src/database');

const cli = readLine.createInterface({
    input: process.stdin,
    output: process.stdout,
});

class CSVReader {
    constructor({ filePath, cellphone }) {
        if (!filePath || !cellphone) {
            throw new Error('Undefined file path or cellphone column.');
        }

        this.cellphoneColumn = cellphone;
        this.filePath = filePath;
        this.csvData = [];
        this.isHeader = true;

        try {
            fs.createReadStream(this.filePath)
                .pipe(parse({ delimiter: ',' }))
                .on('data', this.processCSVData.bind(this))
                .on('end', () => {})
                .on('error', (err) => {
                    logger.error('Error reading CSV: ' + err.message);
                });
        } catch (err) {
            throw new Error(`Error trying to load CSV file: ${err}`);
        }
    }

    processCSVData(data) {
        if (this.isHeader) {
            this.headers = data;
            this.isHeader = false;
        } else {
            const dynamicObject = {};
            this.headers.forEach((header, index) => {
                dynamicObject[header] = data[index];
            });
            this.csvData.push(dynamicObject);
        }
    }

    getCellphoneColumn() {
        return this.cellphoneColumn;
    }
}

class MessageReader {
    constructor({ filePath }) {
        if (!filePath) {
            throw new Error('Undefined file path.');
        }

        this.filePath = filePath;

        try {
            this.fileData = fs.readFileSync(this.filePath, 'utf-8');
            logger.info('Message template loaded!');
        } catch (err) {
            throw new Error(`Error trying to load message file: ${err}`);
        }
    }

    decodeMessage(csvObject) {
        if (typeof csvObject !== 'object') {
            throw new Error('Expected a CSV object.');
        }

        let decodedMessage = this.fileData;

        Object.keys(csvObject).forEach((key) => {
            const placeholder = `{{${key}}}`;
            decodedMessage = decodedMessage.replace(placeholder, csvObject[key]);
        });

        logger.info('The message was successfully decoded.');

        return decodedMessage;
    }
}

async function sendMessage(contact, DB, WP_SERVICE, message, logger) {
    try {
        logger.info('Time: ' + contact.timeToWait);
        await sleep(contact.timeToWait);

        const check = await DB.getSent(contact.phone);
        if (check) {
            logger.info(`Contact ${contact.phone} already sent, skipping for now...`);
        } else {
            await WP_SERVICE.sendMessage(message, contact.phone);
            logger.info(`Message sent to the ${contact.phone} contact!`);
            await DB.sentMessage(contact.phone);
        }
    } catch (err) {
        logger.error(`Error sending message: ${err}`);
    }
}

async function getCronMessages(CSV, WP_SERVICE, DB) {
    const messagePath = await promptQuestion('Insert the path to the message template: ');
    const MESSAGE = new MessageReader({ filePath: messagePath });

    const rollGap = await promptQuestion('Insert the quantity of messages to send for each roll [int: 1 -> 10000]: ', '100');
    const cycleGap = await promptQuestion('Insert the time gap between each cycle [minute: 1 -> 60]: ', '5');
    const sequence = await promptQuestion('Insert the sequence for messaging [second, second, second, ...]: ', '[1,2,3,2]');

    const cronRollGap = parseInt(rollGap);
    const cronCycleGap = parseInt(cycleGap);
    const cronSequence = JSON.parse(sequence);

    const cycleNumber = { value: 0 };
    const totalData = CSV.csvData.length;
    const cycleNeeded = Math.ceil(totalData / cronRollGap);

    const job = cron.schedule(`*/${cronCycleGap} * * * *`, async () => {
        if (cycleNumber.value >= cycleNeeded) {
            logger.info('Messages successfully sent, closing the campaign...');
            job.stop();
        } else {
            const arrayIndex = createArraySequence(
                cycleNumber.value * cronRollGap,
                Math.min((cycleNumber.value + 1) * cronRollGap, totalData)
            );

            for (const index of arrayIndex) {
                const csvObject = CSV.csvData[index];
                const contact = csvObject[CSV.getCellphoneColumn()];
                const message = MESSAGE.decodeMessage(csvObject);

                await sendMessage(
                    { 
                        phone: contact, 
                        timeToWait: cronSequence[index % cronSequence.length]
                    }, 
                    DB, 
                    WP_SERVICE, 
                    message, 
                    logger
                );
            }

            cycleNumber.value++;
        }
    });
}

async function main() {
    const WP_SERVICE = new WhatsAppService();
    await WP_SERVICE.initialize();

    const DB = new Database({ path: './src/config.json' });
    await DB.initialize();

    const filePath = await promptQuestion('Insert the relative path to the contact list [.csv]: ');
    const ABS_FILE_PATH = path.resolve(__dirname, filePath);

    const phoneNumber = await promptQuestion('Insert the column used for the phone number: ');

    const CSV = new CSVReader({ filePath: ABS_FILE_PATH, cellphone: phoneNumber });
    await getCronMessages(CSV, WP_SERVICE, DB);
}

function promptQuestion(question, defaultValue = null) {
    return new Promise((resolve) => {
        cli.question(question, (answer) => {
            resolve(answer || defaultValue);
        });
    });
}

main();
