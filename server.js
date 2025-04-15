const WebSocket = require('ws');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const EventEmitter = require('events');

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "AIzaSyAA25GQvnQSRh18dhcN6okf5FVMtX9ryPI");

// WebSocket server setup
const wss = new WebSocket.Server({ port: 8080 });

// Dummy RAG model function
function get_notifications() {
    return [
        { type: 'email', from: 'Kavya Sree', subject: 'Meeting at 9 PM', content: 'Can we meet at 9 PM today?' },
        { type: 'Assignment for MMTechNova', message: 'Assignment Presentation Scheduled!!' }
    ];
}

// Dummy API to send email (future implementation can be to connecting with working gmail api)
function send_email_api(to, content) {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve({ status: 'success', message: 'Email sent successfully!' });
        }, 1000);
    });
}

// Event emitter for handling notifications
const notificationEmitter = new EventEmitter();

// AI Assistant class
class AIAssistant {
    constructor() {
        this.context = {};
        this.model = genAI.getGenerativeModel({ model: "gemini-pro" });
    }

    async processMessage(message, ws) {
        message = message.toLowerCase();

        if (this.isGreeting(message)) {
            return "Hi! How can I assist you today?";
        }

        if (this.isNotificationRequest(message)) {
            const notifications = get_notifications();
            return this.formatNotifications(notifications);
        }

        if (this.isEmailReply(message)) {
            return await this.handleEmailReply(message);
        }

        if (this.isEmailConfirmation(message)) {
            return await this.handleEmailConfirmation(message);
        }

        // General questions
        return await this.handleGeneralQuestion(message);
    }

    isGreeting(message) {
        return ['hello', 'hi', 'hey'].includes(message);
    }

    isNotificationRequest(message) {
        return message.includes('notifications');
    }

    isEmailReply(message) {
        return message.includes('reply to');
    }

    isEmailConfirmation(message) {
        return ['yes', 'no'].includes(message);
    }

    formatNotifications(notifications) {
        const count = notifications.length;
        const formatted = notifications.map((n, i) => {
            if (n.type === 'email') {
                return `${i + 1}. Email from ${n.from}: "${n.subject}"`;
            }
            return `${i + 1}. ${n.type} Alert: "${n.message}"`;
        }).join('\n');
        return `You have ${count} new notifications.\n${formatted}`;
    }

    async handleEmailReply(message) {
        const from = message.replace('reply to ', '').trim();
        const email = get_notifications().find(n => n.type === 'email' && n.from.toLowerCase() === from);
        
        if (!email) {
            return "Sorry, I couldn't find that email.";
        }

        this.context.pendingEmail = {
            to: email.from,
            content: "Got it, see you at 9 PM!"
        };

        return `Email Content: "${email.content}"Suggested Reply: "${this.context.pendingEmail.content}"\nAre you happy to send this? (Yes/No)`;
    }

    async handleEmailConfirmation(message) {
        if (!this.context.pendingEmail) {
            return "No pending email to send.";
        }

        if (message === 'yes') {
            const result = await send_email_api(this.context.pendingEmail.to, this.context.pendingEmail.content);
            this.context.pendingEmail = null;
            return `Sending email...\n${result.message}`;
        }

        this.context.pendingEmail = null;
        return "Email cancelled.";
    }

    async handleGeneralQuestion(message) {
        try {
            // Gemini API call
            const prompt = message;
            const result = await this.model.generateContent(prompt);
            const response = result.response;
            const text = response.text();
            
            return text;
        } catch (error) {
            console.error('Error in Gemini API call:', error);
            return "I'm sorry, I couldn't process that question.";
        }
    }
}

// WebSocket connection handler
wss.on('connection', (ws) => {
    const assistant = new AIAssistant();

    ws.on('message', async (message) => {
        try {
            const response = await assistant.processMessage(message.toString(), ws);
            ws.send(JSON.stringify({ type: 'response', content: response }));
        } catch (error) {
            ws.send(JSON.stringify({ type: 'error', content: 'An error occurred' }));
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
    });
});

console.log('Server running on ws://localhost:8080');