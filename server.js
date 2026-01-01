const express = require('express');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const cors = require('cors');
const path = require('path');
const app = express();

app.use(cors());
app.use(express.json());

// These keys will come from Render settings
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

let alertQueue = [];

app.post('/create-order', async (req, res) => {
    try {
        const options = {
            amount: req.body.amount * 100, // Amount in paise
            currency: "INR",
            receipt: "receipt_" + Date.now(),
        };
        const order = await razorpay.orders.create(options);
        res.json(order);
    } catch (error) {
        console.error(error);
        res.status(500).send(error);
    }
});

app.post('/verify-payment', (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, name, amount, message } = req.body;
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(body.toString())
        .digest('hex');

    if (expectedSignature === razorpay_signature) {
        alertQueue.push({
            id: Date.now(),
            name: name || "Anonymous",
            amount: amount,
            message: message || "No message"
        });
        res.json({ status: "success" });
    } else {
        res.status(400).json({ status: "failure" });
    }
});

app.get('/get-alert', (req, res) => {
    if (alertQueue.length > 0) {
        const alert = alertQueue.shift();
        res.json(alert);
    } else {
        res.json(null);
    }
});

app.get('/obs-widget', (req, res) => {
    res.sendFile(path.join(__dirname, 'widget.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
