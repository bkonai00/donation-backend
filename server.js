const express = require('express');
const crypto = require('crypto');
const cors = require('cors');
const path = require('path');
const axios = require('axios'); // Tool to fetch audio

const app = express();
app.use(cors());
app.use(express.json());

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "xdfun123"; 

let alertQueue = [];

// 1. Webhook (Razorpay Listener)
app.post('/razorpay-webhook', (req, res) => {
    const secret = WEBHOOK_SECRET;
    const shasum = crypto.createHmac('sha256', secret);
    shasum.update(JSON.stringify(req.body));
    const digest = shasum.digest('hex');

    if (digest === req.headers['x-razorpay-signature']) {
        console.log("Payment received!");
        const payment = req.body.payload.payment.entity;
        
        let userMessage = "Supported the stream!";
        if (payment.notes) {
            const noteValues = Object.values(payment.notes);
            if (noteValues.length > 0) userMessage = noteValues[0];
        }

        // Clean the message (remove bad characters)
        userMessage = userMessage.replace(/[^a-zA-Z0-9 ]/g, "");

        alertQueue.push({
            id: Date.now(),
            name: payment.email.split('@')[0] || "Anonymous",
            amount: payment.amount / 100,
            message: userMessage
        });

        res.json({ status: 'ok' });
    } else {
        res.status(400).send('Invalid signature');
    }
});

// 2. Alert Queue Endpoint
app.get('/get-alert', (req, res) => {
    if (alertQueue.length > 0) {
        const alert = alertQueue.shift();
        res.json(alert);
    } else {
        res.json(null);
    }
});

// 3. NEW: Audio Proxy Endpoint (The Magic Fix)
app.get('/speak', async (req, res) => {
    try {
        const text = req.query.text;
        if(!text) return res.status(400).send("No text provided");

        // We fetch the audio from StreamElements API HERE (Server-side)
        // OBS trusts the server, so this won't get blocked.
        const url = `https://api.streamelements.com/kappa/v2/speech?voice=Brian&text=${encodeURIComponent(text)}`;
        
        const response = await axios({
            method: 'get',
            url: url,
            responseType: 'stream'
        });

        // Pipe the audio directly to the browser
        res.set('Content-Type', 'audio/mp3');
        response.data.pipe(res);

    } catch (error) {
        console.error("TTS Error:", error);
        res.status(500).send("Audio Error");
    }
});

// 4. Widget HTML
app.get('/obs-widget', (req, res) => {
    res.sendFile(path.join(__dirname, 'widget.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
