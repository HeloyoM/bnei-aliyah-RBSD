
const express = require("express");
const router = express.Router();
const jwt = require('jsonwebtoken');
const { execute } = require('../connection-wrapper');
const { authenticate, authorize } = require('../middlewares/auth-resources')

// 1. Read all users by sysAdmin
router.get('/users/:userId', authenticate, authorize('users', 'read'), async (req, res) => {

    const userId = req.params.userId;

    try {

        const userActivity = await execute(`
            SELECT u.id AS user_id, ui.first_name, ui.last_name, u.email, u.phone, ui.created_at, mem.campaign_id, mem.joined_date FROM user u 
            LEFT JOIN user_info ui ON ui.id = u.id
            LEFT JOIN members mem ON mem.user_id = u.id
            WHERE u.id = ?`, [userId]);

        console.log({ userActivity })
        
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
        console.error("Error get user details:", error);
        res.status(500).json({ message: 'Failed to update user role', error: error.message });
    }


});



// 2. PUT activation bunch of users
router.put('/activation', authenticate, authorize('users', 'delete'), async (req, res) => {

    const { user_ids } = req.body;

    if (!Array.isArray(user_ids) || user_ids.length === 0) {
        return res.status(400).json({ error: 'Invalid user IDs array' });
    }

    try {
        // Build dynamic query with parameterized IDs
        const placeholders = user_ids.map((_, i) => `$${i + 1}`).join(', ');

        const query = `
        UPDATE user
        SET active = CASE
            WHEN active = TRUE THEN FALSE
            ELSE TRUE
        END
        WHERE id IN (${placeholders})
        `;

        const result = await execute(query, user_ids);

        if (result.affectedRows > 0) {
            res.status(200).json({ message: 'Users toggled successfully' });
        } else {
            res.status(400).json({ message: `An error occure while activation users ${placeholders}` })
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to toggle users' });
    }
});



module.exports = router;