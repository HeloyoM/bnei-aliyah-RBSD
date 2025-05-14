const express = require("express");
const axios = require('axios');
const { execute } = require("../connection-wrapper");


function getClientIp(req) {
    const forwarded = req.headers['x-forwarded-for'];
    return forwarded
        ? forwarded.split(',')[0].trim()
        : req.socket.remoteAddress;
}

const trackVisitor = async (req, res, next) => {

    try {
        let ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

        if (ip === '::1' || ip.startsWith('::ffff:127')) {
            ip = '8.8.8.8'; // development IP fallback
        } else if (ip.startsWith('::ffff:')) {
            ip = ip.replace('::ffff:', '');
        }

        const geo = await axios.get(`https://ipapi.co/212.25.77.66/json/`);
        const {
            city,
            region,
            country_name,
            latitude,
            longitude } = geo.data;

        console.log(geo.data)
        const userAgent = req.headers['user-agent'] || null;
        const referer = req.headers['referer'] || null;

        console.log({ ip, userAgent, referer })

        // Fetch location info



        const result = await execute(
            `INSERT INTO guests (
            ip_address, city, region, country, latitude, longitude,
            user_agent, referer
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [ip, city, region, country_name, latitude, longitude, userAgent, referer]
        );
        console.log({ result })
        // Save visit ID in session or cookie to complete visit later
        res.locals.visitId = result.rows[0].id;
    } catch (error) {
        console.error('Error tracking visitor', error);
    }
    next();
}



module.exports = { trackVisitor }