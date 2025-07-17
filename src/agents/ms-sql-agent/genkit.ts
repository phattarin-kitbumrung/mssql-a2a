import { defineFlow } from '@genkit-ai/flow';
import { genkit } from "genkit/beta";
import { GENKIT_MODEL } from "../../config.js";
import { ollama } from '../../plugins/ollama.js';
import { z } from 'zod';

export const msSqlGenkit = genkit({
    plugins: [ollama],
    model: GENKIT_MODEL,
});

export const msSqlFlow = defineFlow(
  {
    name: 'msSqlFlow',
    inputSchema: z.string(),
    outputSchema: z.string(),
  },
  async (prompt) => {
    const llmResponse = await msSqlGenkit.generate({
      prompt: prompt,
    });

    return llmResponse.text;
  }
);