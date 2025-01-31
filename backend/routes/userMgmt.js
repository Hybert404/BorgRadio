const express = require('express');
const router = express.Router();

const { dbUsers }   = require('../functions/database.js');
const bcrypt        = require('bcrypt');
const jwt           = require('jsonwebtoken');
const SECRET_KEY    = require('../middleware/SECRET_KEY.js'); // Secret key for JWT

// Login endpoint
router.post('/api/login', (req, res) => {
    const { username, password } = req.body;
  
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required.' });
    }
  
    // Query the database for the user
    const sql = `SELECT * FROM users WHERE username = ?`;
    dbUsers.get(sql, [username], async (err, row) => {
        if (err) {
            console.error('Database error:', err.message);
            return res.status(500).json({ error: 'Internal server error' });
        }
  
        if (!row) {
            return res.status(404).json({ error: 'User not found' });
        }
  
        // Compare the provided password with the stored hash
        const passwordMatch = await bcrypt.compare(password, row.pwdHash);
        if (!passwordMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
  
        // Generate a JWT token (optional)
        const token = jwt.sign({ id: row.id, username: row.username }, SECRET_KEY, { expiresIn: '1h' });
  
        return res.json({ message: 'Login successful', token });
    });
});
  
// Register endpoint
router.post('/api/register', async (req, res) => {
    const { username, password, secret } = req.body;
    console.log(req.body);

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required.' });
    }
    if (!secret || secret !== '1111') { //completly secure way of authorizing administrator
        return res.status(400).json({ error: 'You are not authorized to add users.' });
    }

    try {
        // Hash the password
        const saltRounds = 10;
        const pwdHash = await bcrypt.hash(password, saltRounds);

        // Insert the user into the database
        const sql = `INSERT INTO users (username, pwdHash) VALUES (?, ?)`;
        dbUsers.run(sql, [username, pwdHash], function (err) {
            if (err) {
                console.error('Error inserting user:', err.message);
                return res.status(500).json({ error: 'Internal server error' });
            }

            res.json({ message: 'User registered successfully', userId: this.lastID });
        });
    } catch (error) {
        console.error('Error hashing password:', error.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/api/userinfo', (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        res.json({ id: decoded.id, username: decoded.username });
    } catch (err) {
        res.status(403).json({ error: 'Invalid token' });
    }
});

module.exports = router;