const jwt = require('jsonwebtoken');
const SECRET_KEY = require('./SECRET_KEY.js');

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Extract the token

    if (!token) {
        return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Forbidden: Invalid token' });
        }

        req.user = user; // Attach user data to the request object
        next();
    });
};

module.exports = authenticateToken;
