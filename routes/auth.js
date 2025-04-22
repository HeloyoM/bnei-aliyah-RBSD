const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { execute } = require('../connection-wrapper');

router.post('/register', async (req, res) => {
    const { first_name, last_name, email, password, phone, address } = req.body;
    console.log(req.body)
    if (!first_name || !last_name || !email || !password) {
        return res.status(400).json({ message: 'Missing required fields' });
    }

    try {
        // 1. Check if the email is already taken
        const emailCheckResult = await execute('SELECT id FROM user WHERE email = ?', [email]);
        if (emailCheckResult.length > 0) {
            return res.status(409).json({ message: 'Email already exists' });
        }

        // 2. Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // 3. Generate UUIDs for user_personal_info and user
        const userId = uuidv4();

        // 4. Insert into user_personal_info
        await execute(
            'INSERT INTO user_info (id, first_name, last_name) VALUES (?, ?, ?)',
            [userId, first_name, last_name]
        );

        // 5. Insert into user
        await execute(
            'INSERT INTO user (id, email, password, phone, address) VALUES (?, ?, ?, ?, ?)',
            [userId, email, hashedPassword, phone, address]
        );

        res.status(201).json({ message: 'User registered successfully' });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Missing credentials' });
    }

    try {
        // 1. Retrieve the user from the database
        const users = await execute('SELECT * FROM user WHERE email = ?', [email]);
        if (users.length === 0) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        const user = users[0];

        // 2. Compare the password
        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // 3. Generate a JWT
        const payload = {
            userId: user.id,  // Include user ID in the payload
            email: user.email,
            // Add other user-related data you want in the token
        };
        const token = generateToken(payload);
        const refreshTokenValue = generateRefreshToken();

        // Store refresh token in database
        await execute(
            'INSERT INTO refresh_tokens (id, user_id, token, expiry_time) VALUES (?, ?, ?, ?)',
            [uuidv4(), user.id, refreshTokenValue, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)] // 7 days
        );

        res.json({ message: 'Login successful', token, refreshToken: refreshTokenValue });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// 3. Get User Profile (Protected Route)
router.get('/profile', verifyToken, async (req, res) => {
    // The verifyToken middleware ensures that only authenticated users can access this route
    //  req.user now contains the data from the JWT payload
    try{
        const user = await execute(
            `SELECT u.email, u.phone, u.address, up.first_name, up.last_name
             FROM user u
             JOIN user_info up ON u.id = up.id
             WHERE u.id = ?`,
            [req.user.userId]  // Access user ID from the decoded JWT
        );
      if(user.length === 0){
        return res.status(404).json({message: "User not found"});
      }

        res.json({
            message: 'Profile retrieved successfully',
            user: user[0],
        });
    } catch(error){
      console.error("Error retrieving profile", error);
      res.status(500).json({ message: 'Internal server error' });
    }

});


// 4.  Example of a protected route (requires a valid JWT)
router.get('/protected', verifyToken, (req, res) => {
    //  req.user contains the decoded JWT payload
    res.json({
        message: 'This route is protected',
        user: req.user, //  Example:  Access user data from the token
    });
});

// 5.  Refresh Token Route
router.post('/refresh', async (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
        return res.status(400).json({ message: 'Refresh token required' });
    }

    try {
        // 1.  Check if the refresh token exists, is not revoked, and is not expired
        const refreshTokenResult = await execute(
            'SELECT user_id FROM refresh_tokens WHERE token = ? AND revoked = FALSE AND expiry_time > NOW()',
            [refreshToken]
        );

        if (refreshTokenResult.length === 0) {
            return res.status(401).json({ message: 'Invalid or expired refresh token' });
        }

        const { user_id } = refreshTokenResult[0];

        // 2.  Generate a new JWT
        const payload = {
            userId: user_id,
        };
        const newAccessToken = generateToken(payload);
        const newRefreshTokenValue = generateRefreshToken();

        // 3.  Revoke the old refresh token and store the new one
        await execute(
            'UPDATE refresh_tokens SET revoked = TRUE WHERE token = ?',
            [refreshToken]
        );
        await execute(
            'INSERT INTO refresh_tokens (id, user_id, token, expiry_time) VALUES (?, ?, ?, ?)',
            [uuidv4(), user_id, newRefreshTokenValue, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)] // 7 days
        );
        res.json({ token: newAccessToken, refreshToken: newRefreshTokenValue });
    } catch (error) {
        console.error('Refresh token error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Function to generate a refresh token
function generateRefreshToken() {
    return uuidv4();
}

// Function to generate a JWT
function generateToken(payload) {
    const secretKey = 'your_jwt_secret_key';  // Replace with a strong, secret key
    const options = {
        expiresIn: '1h', // Token expiration time (e.g., 1 hour)
    };
    return jwt.sign(payload, secretKey, options);
}

function verifyToken(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1]; // Extract token from Authorization header
    if (!token) {
        return res.status(401).json({ message: 'No token provided' });
    }

    const secretKey = 'your_jwt_secret_key';  // Replace with your secret key
    jwt.verify(token, secretKey, (err, decoded) => {
        if (err) {
            return res.status(401).json({ message: 'Invalid token' });
        }
        req.user = decoded; // Store the decoded payload in the request object
        next(); // Call the next middleware or route handler
    });
}

module.exports = router;