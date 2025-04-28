const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { execute } = require('../connection-wrapper');
const { body, validationResult } = require('express-validator');

router.post('/', async (req, res) => {

    const { greg_date, mincha_time, shacharis_time, maariv_time, hebrew_date } = req.body;

    // Construct the SQL query to check for existing record.
    const checkSql = `SELECT id FROM schedules WHERE greg_date = ?`;
    const checkValues = [greg_date];

    try {
        // Execute the check query.
        const checkResult = await query(checkSql, checkValues);

        if (checkResult.length > 0) {
            // Record exists, so update it.
            const id = checkResult[0].id; // Get the ID of the existing record.
            const updateSql = `
                UPDATE schedules
                SET mincha_time = ?, shacharis_time = ?, maariv_time = ?, hebrew_date = ?
                WHERE id = ?
            `;
            const updateValues = [mincha_time, shacharis_time, maariv_time, hebrew_date, id];
            const updateResult = await execute(updateSql, updateValues);
            res.json({ message: 'Schedule entry updated successfully' });

        } else {
            // Record does not exist, so insert a new one.
            const insertSql = `
                INSERT INTO schedules (greg_date, hebrew_date,mincha_time, shacharis_time, maariv_time )
                VALUES (?, ?, ?, ?, ?)
            `;
            const insertValues = [greg_date, mincha_time, shacharis_time, maariv_time, hebrew_date];
            const insertResult = await execute(insertSql, insertValues);
            res.status(201).json({ message: 'Schedule entry created successfully' });  // 201 Created
        }
    } catch (error) {
        // Handle any errors.
        console.error('Error updating/inserting schedule entry:', error);
        res.status(500).json({ error: 'Failed to update/insert schedule entry: ' + error.message });
    }
});

module.exports = router;