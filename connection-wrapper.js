
const mysql = require('mysql2');

// Connect to DB
const pool = mysql.createPool({
    host: process.env.HOST || '',
    user: process.env.DATABASE_USER_NAME || '',
    password: process.env.DATABASE_PASSWORD || '',
    database: process.env.DATABASE_NAME || '',
    port: process.env.DB_PORT,
    keepAliveInitialDelay: 1000,
    enableKeepAlive: true,
});

function execute(sql, params) {
    return new Promise((resolve, reject) => {
        pool.query(sql, params, (err, results) => {
            if (err) {
                reject(err);
            } else {
                resolve(results);
            }
        })
    })
}

module.exports = { execute }