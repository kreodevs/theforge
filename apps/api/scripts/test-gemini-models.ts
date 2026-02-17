
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as dotenv from "dotenv";

dotenv.config();

async function listModels() {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
        console.error("No API key found.");
        process.exit(1);
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    try {
        // Use the API key to instantiate the client

        // Actually the SDK doesn't have a direct 'listModels' in the lightweight client, 
        // but we can try a simple generation to check if 2.0 or 1.5-pro-002 works, 
        // OR we can just use the models we know are latest: gemini-2.0-flash-exp, gemini-1.5-pro-002

        // Better strategy: Test the candidate models directly.
        const candidates = [
            "gemini-2.0-flash",
            "gemini-1.5-pro",
            "gemini-1.5-pro-002",
            "gemini-1.5-flash",
            "gemini-1.5-flash-002",
            "gemini-2.0-flash-exp",
        ];

        console.log("Testing model availability...");

        for (const modelName of candidates) {
            try {
                const model = genAI.getGenerativeModel({ model: modelName });
                const result = await model.generateContent("Hello, are you there?");
                const response = result.response;
                if (response.text()) {
                    console.log(`✅ ${modelName} is AVAILABLE.`);
                }
            } catch (error: any) {
                console.log(`❌ ${modelName} failed: ${error.message.split(' ')[0]}...`);
            }
        }

    } catch (error) {
        console.error("Error:", error);
    }
}

listModels();
