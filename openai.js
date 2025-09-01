import OpenAI from 'openai';

// 🤖 OpenAI yapılandırması
export const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY, // .env dosyasındaki anahtar
});
