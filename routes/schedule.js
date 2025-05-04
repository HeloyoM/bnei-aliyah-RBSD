const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { execute } = require('../connection-wrapper');
const { body, validationResult } = require('express-validator');

// Validation middleware for time fields
const validateTimeField = [
    body('mincha_time').optional().matches(/^([0-9]{2}:[0-9]{2})?$/).withMessage('Invalid time format (HH:MM)'),
    body('shacharis_time').optional().matches(/^([0-9]{2}:[0-9]{2})?$/).withMessage('Invalid time format (HH:MM)'),
    body('maariv_time').optional().matches(/^([0-9]{2}:[0-9]{2})?$/).withMessage('Invalid time format (HH:MM)'),
];

router.post('/', validateTimeField, async (req, res) => {
    // Check for validation errors.
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { greg_date, mincha_time, shacharis_time, maariv_time, hebrew_date } = req.body;


    try {
        // Use INSERT ... ON DUPLICATE KEY UPDATE
        const upsertSql = `
            INSERT INTO schedules (greg_date, mincha_time, shacharis_time, maariv_time, hebrew_date)
            VALUES (?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
            mincha_time = VALUES(mincha_time),
            shacharis_time = VALUES(shacharis_time),
            maariv_time = VALUES(maariv_time),
            hebrew_date = VALUES(hebrew_date)
        `;
        const upsertValues = [greg_date, mincha_time, shacharis_time, maariv_time, hebrew_date];

        const result = await execute(upsertSql, upsertValues);

        // Determine if it was an insert or update
        if (result.affectedRows === 1) {
            res.status(201).json({ message: 'Schedule entry created successfully' });
        } else {
            res.json({ message: 'Schedule entry updated successfully' });
        }

    } catch (error) {
        console.error('Error updating/inserting schedule entry:', error);
        res.status(500).json({ error: 'Failed to update/insert schedule entry: ' + error.message });
    }

});

router.get('/', async (req, res) => {

    try {
        const sql = `SELECT * FROM beni.schedules`;
        const results = await execute(sql);

        const today = new Date();

        const futureEvents = results.filter(ev => new Date(ev.greg_date) >= today);

        res.status(200).json(futureEvents);
    } catch (error) {
        console.error('Error getting future schedule entries:', error);
        res.status(500).json({ error: 'Failed to get future schedule entries: ' + error.message });
    }

})
module.exports = router;