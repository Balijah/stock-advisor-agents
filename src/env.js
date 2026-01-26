import dotenv from "dotenv";

// Load .env from project root when running from src/.
dotenv.config({ path: new URL("../.env", import.meta.url) });
