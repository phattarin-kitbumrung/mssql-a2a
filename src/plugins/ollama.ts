import { defineModel } from "@genkit-ai/ai/model";
import { genkitPlugin } from "genkit/plugin";
import { GENKIT_MODEL, MODEL_NAME } from "../config.js";

export const ollama = genkitPlugin("ollama", (genkit) => {
  defineModel(
    genkit.registry,
    {
      name: GENKIT_MODEL,
      apiVersion: "v2",
      supports: {
        multiturn: true,
        tools: true,
        media: false,
        systemRole: true,
      },
    },
    async (input) => {
      const messages = input.messages.map((msg) => ({
        role: msg.role,
        content: msg.content.map((part) => part.text).join("\n"),
      }));
      console.log(
        `[Ollama Plugin] Messages sent to Ollama: ${JSON.stringify(messages)}`
      );
      const response = await fetch("http://localhost:11434/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: MODEL_NAME,
          messages: messages,
          stream: false,
        }),
      });
      const data = await response.json();
      return {
        candidates: [
          {
            index: 0,
            message: {
              content: [{ text: data.message.content }],
              role: "model",
            },
            finishReason: "stop",
          },
        ],
      };
    }
  );
});
