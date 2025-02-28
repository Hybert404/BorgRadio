const sqlite3      = require('sqlite3').verbose();

const dbQueue      = new sqlite3.Database('../queue.db');
const dbUsers      = new sqlite3.Database('../users.db');
const dbTagColors  = new sqlite3.Database('../tagColors.db');

const initializeDatabase = () => {
    // Create queue table if it doesn't exist
    dbQueue.serialize(() => {
        dbQueue.run(`CREATE TABLE IF NOT EXISTS queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        url TEXT NOT NULL,
        title TEXT,
        status TEXT DEFAULT 'pending',
        audioUrl TEXT,
        duration INTEGER,
        tags TEXT
        )`, (err) => {
            if (err) {
                console.error('Error creating table:', err.message);
            };
        });
    });
    
    dbUsers.serialize(() => {
        dbUsers.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            pwdHash TEXT NOT NULL
        )`, (err) => {
            if (err) {
                console.error('Error creating table:', err.message);
            };
        });
    });
    
    dbTagColors.serialize(() => {
        dbTagColors.run(`CREATE TABLE IF NOT EXISTS tagColors (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tag TEXT NOT NULL,
            color TEXT NOT NULL
        )`, (err) => {
            if (err) {
                console.error('Error creating table:', err.message);
            };
        });
    });
}

const changeStatuses = async (from, to) => {
    return new Promise((resolve, reject) => {
      dbQueue.run(`UPDATE queue SET status = ? WHERE status = ?`, [to, from], (err) => {
        if (err) {
          console.error('[database.js/changeStatuses] Error updating statuses:', err);
          reject(err);
        } else {
          // console.log("\x1b[36m%s\x1b[0m", `[changeStatuses] Status for songs updated from ${from} to ${to}.`);
          resolve();
        }
      });
    });
};


module.exports = {
    initializeDatabase,
    changeStatuses,
    dbQueue,
    dbUsers,
    dbTagColors
};