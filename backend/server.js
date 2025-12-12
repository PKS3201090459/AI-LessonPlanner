// server.js (Папка /backend)

import 'dotenv/config'; 
import express from 'express';
import cors from 'cors';
import { GoogleGenAI } from "@google/genai";
// Библиотеки DOCX удалены

// --- КОНСТАНТЫ И ИНИЦИАЛИЗАЦИЯ ---
const ai = new GoogleGenAI({});
const MODEL_NAME = "gemini-2.5-flash";
const PORT = 3000;
const app = express();

// --- Middleware ---
app.use(cors()); 
app.use(express.json({ limit: '5mb' })); 
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// --- ФУНКЦИЯ 1: ГЕНЕРАЦИЯ КОНТЕНТА (ТОЛЬКО MARKDOWN) ---
async function generateLessonAndTest(theme, grade, duration, language = "Русский") {
    
    if (!process.env.GEMINI_API_KEY) {
        throw new Error("API Key is not configured on the server. Check your .env file.");
    }
    
    let langCode = "Русский";
    let lessonTitlePrefix = "📘 План урока";

    if (language === "Казахский") {
        langCode = "Казахский";
        lessonTitlePrefix = "📘 Сабақ жоспары";
    }
    
    // Системный промпт: теперь просим все в одном Markdown-блоке
    const systemInstruction = `Ты — высококвалифицированный виртуальный ассистент учителя. Твоя задача — сгенерировать полный, структурированный план урока и 10 тестовых заданий **строго с выбором одного ответа**. **Всегда используй только ${langCode} язык**. Ответ должен быть единым блоком в формате Markdown, содержащим план урока и тест. **Не используй JSON**.`;

    const userQuery = `
    На основе следующих данных:
    - **Тема урока:** ${theme}
    - **Уровень/Класс:** ${grade}
    - **Продолжительность (мин):** ${duration}

    Сгенерируй полный ответ в следующем четком формате Markdown:

    ---
    ## ${lessonTitlePrefix}: "${theme}"

    ### 1. Цели урока (5 минут)
    [Сгенерируй 2-3 конкретных и измеримых цели]

    ### 2. Ход урока (Основной этап - ${duration - 10} минут)
    [Разбей урок на 3-4 логических этапа с указанием времени и активности]

    ### 3. Домашнее задание (5 минут)
    [Предложи 1-2 творческих или практических задания]
    ---
    
    ## ✅ Автоматический Тест (10 вопросов с выбором ответа)
    
    [Сгенерируй 10 вопросов в формате Markdown. Каждый вопрос должен иметь 4 варианта ответа и четко указанный правильный ответ в скобках.
    Пример: 
    1. Первый вопрос?
       - Вариант 1
       - Вариант 2
       - Вариант 3
       - Вариант 4
       (Правильный ответ: Вариант X)]
    
    ---
    `;

    const config = {
        systemInstruction: systemInstruction,
    };

    try {
        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: userQuery,
            config: config,
        });
        
        const fullMarkdown = response.text;
        
        return { fullMarkdown: fullMarkdown };

    } catch (error) {
        console.error("Gemini API Error:", error);
        throw new Error("Ошибка при вызове Gemini API.");
    }
}


// --- API МАРШРУТ 1: ГЕНЕРАЦИЯ ---
app.post('/api/generate-lesson', async (req, res) => {
    const { theme, grade, duration, language } = req.body;

    try {
        const { fullMarkdown } = await generateLessonAndTest(theme, grade, duration, language);
        
        res.json({ 
            success: true, 
            content: fullMarkdown,
            theme: theme 
        });
    } catch (error) {
        console.error("Server error:", error.message);
        res.status(500).json({ error: error.message });
    }
});


// --- МАРШРУТ 2: СКАЧИВАНИЕ DOCX - УДАЛЕН ---


// --- ЗАПУСК СЕРВЕРА ---
app.listen(PORT, () => {
    console.log(`🚀 Server running securely at http://localhost:${PORT}`);
    console.log(`API Key Status: ${process.env.GEMINI_API_KEY ? '✅ Configured' : '❌ NOT Configured'}`);
});