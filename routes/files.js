const express = require('express');
const router = express.Router();
const multer = require('multer');
const archiver = require('archiver');
const fs = require('fs');
const path = require('path');
const { authorize, authenticate } = require('../middlewares/auth-resources');
const { execute } = require('../connection-wrapper');
const { v4: uuidv4 } = require('uuid');

const upload = multer({ dest: 'temp_uploads/' });

router.post('/upload-scp-files', authenticate, authorize('lessons', 'write'), upload.array('files'), async (req, res) => {
    console.log(req.body)
    // const userLevel = req.user?.level; // Assume user is attached by auth middleware

    // if (![100, 101].includes(userLevel)) {
    //     return res.status(403).json({ message: 'Forbidden' });
    // }
    const eventTitle = req.body.eventTitle || 'event';
    const zipFileName = `${eventTitle}-${Date.now()}.zip`;
    const zipFilePath = path.join(__dirname, '..', 'temp_uploads', zipFileName);
    const output = fs.createWriteStream(zipFilePath);
    const archive = archiver('zip', {
        zlib: { level: 9 },
        forceLocalTime: true,
    });


    archive.on('warning', err => {
        if (err.code === 'ENOENT') {
            console.warn(err);
        } else {
            throw err;
        }
    });

    archive.on('error', err => {
        throw err;
    });

    archive.pipe(output);

    req.files.forEach(file => {
        const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
        archive.file(file.path, { name: originalName });
    });

    // req.files.forEach(file => {
    //     archive.file(file.path, { name: file.originalname });
    // });

    await archive.finalize();

    output.on('close', async () => {
        const buffer = fs.readFileSync(zipFilePath);

        const fileId = uuidv4();

        await execute(
            'INSERT INTO files (id, title, filename, file_data) VALUES (?, ?, ?, ?)',
            [fileId, req.body.eventTitle || 'Scp', zipFileName, buffer]
        );

        // Cleanup
        req.files.forEach(file => fs.unlinkSync(file.path));
        fs.unlinkSync(zipFilePath);

        res.status(200).json({ message: 'Uploaded and zipped successfully.' });
    });
});


router.get('/', async (req, res) => {
    const rows = await execute(
        'SELECT * FROM files ORDER BY uploaded_at DESC LIMIT 1'
    );

    if (!rows.length) {
        return res.status(404).send('No files found.');
    }

    const file = rows[0];

    res.set({
        'Content-Disposition': `attachment; filename="${file.filename}"`,
        'Content-Type': 'application/zip',
    });
    res.send(file.file_data);
});


module.exports = router;