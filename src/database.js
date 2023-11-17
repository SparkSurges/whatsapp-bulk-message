const fs = require('fs');
const util = require('util');
const sqlite3 = require('sqlite3');
const { logger } = require('./utils');

class Database {
    constructor(props) {
        this.getConfig(props.path);
        this.connectDatabase();

        this.queryTable = 'CREATE TABLE IF NOT EXISTS checks (cellphone_id INT PRIMARY KEY, sent BOOL)';

        this.queryInsert = 'INSERT INTO checks (cellphone_id, sent) VALUES (?, ?)';
        this.queryGet = 'SELECT sent FROM checks WHERE cellphone_id = ?';
    }

    async initialize() {
        await this.prepareStatements();
    }

    getConfig(path) {
        if (typeof path !== 'string') {
            throw new Error('Expected a valid path for the configuration file.');
        }

        try {
            const config = JSON.parse(fs.readFileSync(path).toString())['DB'];
            this.file = config['DB_NAME'];
        } catch (err) {
            throw new Error('Error reading the configuration file: ' + err.message);
        }
    }

    connectDatabase() {
        this.db = new sqlite3.Database(this.file);
    }

    async prepareStatements() {
        try {
            const promisifiedRun = util.promisify(this.db.run.bind(this.db));
            await promisifiedRun(this.queryTable);
        
            this.insertStatement = this.db.prepare(this.queryInsert, (err) => {
                if (err) {
                    logger.error('Error encoutered while creating insertStatement: ' + err.message);
                }
            });
            this.getStatement = this.db.prepare(this.queryGet)
        } catch (err) {
            throw new Error('Error preparing statements: ' + err.message);
        }
    }

    async getSent(cellphoneId) {
        if (!cellphoneId) {
            throw new Error('Expected a valid cellphone id.');
        }
      
        const promisifiedResult = util.promisify(this.getStatement.get.bind(this.getStatement));
      
        try {
            const result = await promisifiedResult(cellphoneId);
        
            if (result) {
                return result;
            } else {
                logger.info(cellphoneId + ' Not found.');
                return false;
            }
        } catch (err) {
            throw new Error('Error running get statement: ' + err.message);
        }
    }
      
    async sentMessage(cellphoneId) {
        if (!cellphoneId) {
            throw new Error('Expected a valid cellphone id.');
        }

        const promisifiedInsert = util.promisify(this.insertStatement.run.bind(this.insertStatement));

        try {
            const result = await promisifiedInsert(cellphoneId, true);

            logger.info(cellphoneId + ' successfully inserted in the database');
        } catch (err) {
            logger.error(`Could not insert ${cellphoneId} in the database: ${err.message}`);
        }
    }

    close() {
        this.insertStatement.finalize();
        this.getStatement.finalize();
        this.db.close();
    }
}

module.exports = Database;