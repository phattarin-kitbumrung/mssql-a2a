import { genkit } from "genkit/beta";
import { ollama } from "./plugins/ollama.js";

export const GENKIT_MODEL = "ollama/llama3:8b";
export const MODEL_NAME = "llama3:8b";
export const DATABASE_CONFIG = {
  user: 'your_username',
  password: 'your_password',
  server: 'your_server_address',
  database: 'your_database_name',
};

genkit({
  plugins: [ollama],
});
