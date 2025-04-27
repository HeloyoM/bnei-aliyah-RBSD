
const express = require("express");
const router = express.Router();
const jwt = require('jsonwebtoken');
const { execute } = require('../connection-wrapper');
const { verifyToken } = require('./auth')

// 4. 
router.get('/users/:userId', verifyToken, async (req, res) => {
    //  req.user contains the decoded JWT payload
    const userId = req.params.userId;

    console.log(req.user)
    if (req.user.role_id !== 100) { // Assuming 100 is sysAdmin
        return res.status(403).json({ message: 'Forbidden' });
    }

    try {
        const userActivity = await execute(`
            SELECT u.id AS user_id, u.email, u.phone, ui.first_name,ui.last_name, ui.created_at, mem.campaign_id, mem.joined_date FROM user u
            LEFT JOIN user_info ui ON ui.id = u.id
            JOIN members mem ON mem.user_id = u.id
            WHERE u.id = ?`, [userId]);

        if (userActivity.length === 0) {
            return res.json({
                message: 'Forbidden -This route is protected',
                //
            });
        }



        const formattedUserActivity = [];
        const userMap = new Map();

        userActivity.forEach(row => {
            if (!userMap.has(row.user_id)) {
                userMap.set(row.user_id, {
                    user_id: row.user_id,
                    email: row.email,
                    first_name: row.first_name,
                    last_name: row.last_name,
                    created_at: row.created_at,
                    phone: row.phone,
                    campaigns: [],
                });

                formattedUserActivity.push(userMap.get(row.user_id));
            }

            if (row.campaign_id) {
                userMap.get(row.user_id).campaigns.push({
                    campaign_id: row.campaign_id,
                    joined_date: row.joined_date,
                });
            }
        });

        res.status(200).json(formattedUserActivity);
    } catch (error) {
        console.error("Error updating user role:", error);
        res.status(500).json({ message: 'Failed to update user role', error: error.message });
    }


});


module.exports = router;