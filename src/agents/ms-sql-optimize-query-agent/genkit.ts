import { defineFlow } from '@genkit-ai/flow';
import { genkit } from "genkit/beta";
import { GENKIT_MODEL } from "../../config.js";
import { ollama } from "../../plugins/ollama.js";
import { z } from 'zod';

export const optimizeQueryGenkit = genkit({
  plugins: [ollama],
  model: GENKIT_MODEL,
});

export const optimizeQueryFlow = defineFlow(
  {
    name: 'optimizeQueryFlow',
    inputSchema: z.string(),
    outputSchema: z.string(),
  },
  async (sql) => {
    const llmResponse = await optimizeQueryGenkit.generate({
      prompt: `You are a senior database optimization expert. Your task is to review and optimize the following Microsoft SQL Server (MS SQL) query. Respond with ONLY the optimized SQL code, and nothing else: ${sql}`,
      config: { temperature: 0.3 },
    });

    const optimizedSql = llmResponse.text;
    if (!optimizedSql) {
      throw new Error('Failed to optimize SQL query.');
    }
    return optimizedSql;
  }
);