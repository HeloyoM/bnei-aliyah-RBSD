const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { execute } = require('../connection-wrapper');
const { getAllowedResources } = require('../middlewares/getAllowedResources');
const secretKey = 'your_jwt_secret_key';  // Replace with a strong, secret key

// 1. Registeration route
router.post('/register', async (req, res) => {
    const { first_name, last_name, email, password, phone, address, birthday } = req.body;

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
            'INSERT INTO user_info (id, first_name, last_name, created_at) VALUES (?, ?, ?, ?)',
            [userId, first_name, last_name, new Date().toLocaleDateString({ region: 'ISR' })]
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

// 2. Login route
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Missing credentials' });
    }

    try {
        // 1. Retrieve the user from the database
        const users = await execute(`SELECT * FROM user WHERE email = ?`, [email]);
        if (users.length === 0) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        let user = users[0];

        // 2. Compare the password
        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // 3. Generate a JWT
        const payload = {
            userId: user.id,  // Include user ID in the payload
            email: user.email,
            role_id: user.role_id
            // Add other user-related data you want in the token
        };
        const allowedResourcesArray = await getAllowedResources(user)
        payload.allowedResources = allowedResourcesArray;

        const token = generateToken(payload);
        const refreshTokenValue = generateRefreshToken();

        // Store refresh token in database
        await execute(
            'INSERT INTO refresh_tokens (id, user_id, token, expiry_time) VALUES (?, ?, ?, ?)',
            [uuidv4(), user.id, refreshTokenValue, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)] // 7 days
        );

        user = await execute(
            `SELECT u.email, u.phone, u.address, up.first_name, up.last_name, r.name AS role_name
             FROM user u
             JOIN user_info up ON u.id = up.id
             JOIN role r ON u.role_id = r.level
             WHERE u.id = ?`,
            [user.id]  // Access user ID from the decoded JWT
        );

        res.json({ message: 'Login successful', token, refreshToken: refreshTokenValue, user: user[0], allowedResources: allowedResourcesArray, });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// 3. Logout route 
router.post('/logout', verifyToken, (req, res) => {
    //  Since we are not using revoked_tokens, we just clear the client's token.
    //  The server doesn't need to do anything, but you might want to perform
    //  some cleanup or logging here.
    console.log(`User ${req.user.userId} logged out`); //  Optional:  Log the logout
    res.json({ message: 'Logged out successfully' });
});

// 3. Get User Profile (Protected Route)
router.get('/profile', verifyToken, async (req, res) => {
    // The verifyToken middleware ensures that only authenticated users can access this route
    //  req.user now contains the data from the JWT payload

    try {
        const user = await execute(
            `SELECT u.id, u.email, u.phone, u.address, up.first_name, up.last_name, r.level, r.name AS role_name
             FROM user u
             JOIN user_info up ON u.id = up.id
             JOIN role r ON u.role_id = r.level
             WHERE u.id = ?`,
            [req.user.userId]  // Access user ID from the decoded JWT
        );

        if (user.length === 0) {
            return res.status(404).json({ message: "User not found" });
        }

        const allowedResources = await getAllowedResources(req.user)

        res.json({
            message: 'Profile retrieved successfully',
            user: user[0],
            allowedResources
        });
    } catch (error) {
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
            // 
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

// 6.  Password Reset Request
router.post('/password-reset-request', async (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ message: 'Email is required' });
    }

    try {
        // 1.  Check if the email exists in the user table
        const userResult = await execute('SELECT id FROM user WHERE email = ?', [email]);
        if (userResult.length === 0) {
            return res.status(404).json({ message: 'Email not found' });
        }
        const userId = userResult[0].id;

        // 2. Generate a unique reset token
        const resetToken = uuidv4();
        const expiryTime = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

        // 3.  Insert the token into the password_reset_tokens table
        await execute(
            'INSERT INTO password_reset_tokens (id, user_id, token, expiry_time) VALUES (?, ?, ?, ?)',
            [uuidv4(), userId, resetToken, expiryTime]
        );

        //  4.  Send email to the user with the reset link (implementation not shown here)
        //  You would use a library like Nodemailer to send the email.
        console.log(`Password reset token for ${email}: ${resetToken}`);  //  For development
        res.json({ message: 'Password reset email sent (implementation not shown)' }); //  Don't send the token in response in production
    } catch (error) {
        console.error('Password reset request error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// 7. Reset Password - Requires JWT
router.post('/reset-password', verifyToken, async (req, res) => {
    const { newPassword } = req.body;
    const userId = req.user.userId; // Get user ID from JWT

    if (!newPassword) {
        return res.status(400).json({ message: 'New password is required' });
    }

    try {
        // 1. Hash the new password
        const hashedNewPassword = await bcrypt.hash(newPassword, 10);

        // 2. Update the user's password in the database
        const result = await execute(
            'UPDATE user SET password = ? WHERE id = ?',
            [hashedNewPassword, userId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'User not found' }); //  Should not happen
        }

        res.json({ message: 'Password updated successfully' });
    } catch (error) {
        console.error('Password reset error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Function to generate a refresh token
function generateRefreshToken() {
    return uuidv4();
}

// Function to generate a JWT
function generateToken(payload) {

    const options = {
        expiresIn: '1h',
    };
    return jwt.sign(payload, secretKey, options);
}

function verifyToken(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1]; // Extract token from Authorization header

    if (!token) {
        return res.status(401).json({ message: 'No token provided' });
    }

    jwt.verify(token, secretKey, (err, decoded) => {
        if (err) {
            return res.status(401).json({ message: 'Invalid token' });
        }
        req.user = decoded; // Store the decoded payload in the request object
        next(); // Call the next middleware or route handler
    });
}

module.exports = { router, verifyToken };