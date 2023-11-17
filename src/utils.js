const winston = require('winston'); // Added Winston for better logging

function isNumeric(num) {
    if(num.match(/^-?\d+$/)){
        return true;
    }else if(num.match(/^\d+\.\d+$/)){
        return true;
    }else{
        return false;
    }
}

function isSequence(sequence) {
    if (typeof sequence !== 'string') {
        return false;
    }

    return sequence.match(/\[\d+(?:,\d+)*\]/);
}

function createArraySequence(start, stop) {
    let array = [];
    for (let i = start; i < stop; i++) {
        array.push(i);
    }

    return array;
}

const sleep = (seconds) => {
    return new Promise((resolve) => {
        setTimeout(resolve, seconds * 1000);
    });
}

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
  transports: [new winston.transports.Console()],
});

module.exports = {
    isNumeric,
    isSequence,
    createArraySequence,
    sleep,
    logger
} 
  