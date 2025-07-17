import { z } from 'zod';
import sql from 'mssql';
import express from "express";
import { v4 as uuidv4 } from 'uuid';
import { DATABASE_CONFIG } from "../../config.js";
import { msSqlFlow, msSqlGenkit } from './genkit.js';
import { runFlow } from '@genkit-ai/flow';

import {
  InMemoryTaskStore,
  TaskStore,
  A2AExpressApp,
  AgentExecutor,
  RequestContext,
  ExecutionEventBus,
  DefaultRequestHandler,
  AgentCard,
  Task,
  TaskStatusUpdateEvent,
  TextPart,
} from "@a2a-js/sdk";

async function connectDatabase<T>(fn: (pool: sql.ConnectionPool) => Promise<T>): Promise<T> {
  const pool = new sql.ConnectionPool(DATABASE_CONFIG);
  await pool.connect();
  try {
    return await fn(pool);
  } finally {
    await pool.close();
  }
}

export async function getTableList(): Promise<string> {
  return connectDatabase(async (pool) => {
    const result = await pool.request().query('SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = \'BASE TABLE\' AND TABLE_SCHEMA = \'dbo\'');
    const tables = result.recordset.map((row) => row.TABLE_NAME).join(', ');
    return tables || 'No tables found.';
  });
}

export async function getTableSchema(tableName: string): Promise<string> {
  return connectDatabase(async (pool) => {
    const colsResult = await pool.request().query(`SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '${tableName}'`);
    const columns = colsResult.recordset.map((row) => row.COLUMN_NAME);

    if (columns.length === 0) {
      return `Table '${tableName}' not found.`;
    }

    const rowsResult = await pool.request().query(`SELECT TOP 2 * FROM [${tableName}]`);
    const sampleRows = rowsResult.recordset.map((row) => JSON.stringify(row)).join('\n');
    const schemaOutput = `Table: ${tableName}\nColumns:\n- ${columns.join('\n- ')}\n\nSample Rows:\n${sampleRows}`;
    return schemaOutput;
  });
}

export const dbListTables = msSqlGenkit.defineTool(
  {
    name: 'dbListTables',
    description: 'List all tables in the MSSQL database.',
    outputSchema: z.string(),
  },
  getTableList
);

export const dbSchema = msSqlGenkit.defineTool(
  {
    name: 'dbSchema',
    description: 'Given a table name, returns its schema and 2 sample rows.',
    inputSchema: z.object({ tableName: z.string() }),
    outputSchema: z.string(),
  },
  async ({ tableName }) => getTableSchema(tableName)
);

class MsSqlAgentExecutor implements AgentExecutor {
  private cancelledTasks = new Set<string>();

  public cancelTask = async (
        taskId: string,
        eventBus: ExecutionEventBus,
    ): Promise<void> => {
        this.cancelledTasks.add(taskId);
    };

  async execute(
    requestContext: RequestContext,
    eventBus: ExecutionEventBus
  ): Promise<void> {
    const userMessage = requestContext.userMessage;
    const existingTask = requestContext.task;

    const taskId = existingTask?.id || uuidv4();
    const contextId = userMessage.contextId || existingTask?.contextId || uuidv4();

    console.log(
      `[MsSqlAgentExecutor] Processing message ${userMessage.messageId} for task ${taskId} (context: ${contextId})`
    );

    if (!existingTask) {
      const initialTask: Task = {
        kind: 'task',
        id: taskId,
        contextId: contextId,
        status: {
          state: 'submitted',
          timestamp: new Date().toISOString(),
        },
        history: [userMessage],
        metadata: userMessage.metadata,
        artifacts: [],
      };
      eventBus.publish(initialTask);
    }

    const workingStatusUpdate: TaskStatusUpdateEvent = {
      kind: 'status-update',
      taskId: taskId,
      contextId: contextId,
      status: {
        state: 'working',
        message: {
          kind: 'message',
          role: 'agent',
          messageId: uuidv4(),
          parts: [{ kind: 'text', text: 'Processing your request...' }],
          taskId: taskId,
          contextId: contextId,
        },
        timestamp: new Date().toISOString(),
      },
      final: false,
    };
    eventBus.publish(workingStatusUpdate);

    const inputText = userMessage.parts.find(p => p.kind === 'text') as TextPart | undefined;

    if (!inputText || !inputText.text) {
      const failureUpdate: TaskStatusUpdateEvent = {
        kind: 'status-update',
        taskId: taskId,
        contextId: contextId,
        status: {
          state: 'failed',
          message: {
            kind: 'message',
            role: 'agent',
            messageId: uuidv4(),
            parts: [{ kind: 'text', text: 'No input provided.' }],
            taskId: taskId,
            contextId: contextId,
          },
          timestamp: new Date().toISOString(),
        },
        final: true,
      };
      eventBus.publish(failureUpdate);
      return;
    }

    let outputMessage = '';
    try {
      const tables = await getTableList();      console.log(`[MsSqlAgentExecutor] Tables found: ${tables}`);      const schemaPromises = tables.split(', ').map(t => getTableSchema(t));      const schemas = await Promise.all(schemaPromises);      console.log(`[MsSqlAgentExecutor] Schemas generated: ${schemas.join('\n\n')}`);      const fullSchema = schemas.join('\n\n');

      const state = {
        schema: fullSchema,
      };
      const user_message = inputText.text;

      const prompt = `You are an expert SQL developer specialized in Microsoft SQL Server.\nGiven the database schema below, convert the following natural language request into a valid MS SQL query.\n\nDatabase schema:\n${state['schema']}\n\nUser ask: ${user_message}\nOnly output the SQL query. No explanations.`;

      outputMessage = await runFlow(msSqlFlow, prompt);

      if (this.cancelledTasks.has(taskId)) {
        console.log(`[MsSqlAgentExecutor] Request cancelled for task: ${taskId}`);
        const cancelledUpdate: TaskStatusUpdateEvent = {
          kind: 'status-update',
          taskId: taskId,
          contextId: contextId,
          status: {
            state: 'canceled',
            timestamp: new Date().toISOString(),
          },
          final: true,
        };
        eventBus.publish(cancelledUpdate);
        return;
      }

      const finalUpdate: TaskStatusUpdateEvent = {
        kind: 'status-update',
        taskId: taskId,
        contextId: contextId,
        status: {
          state: 'completed',
          message: {
            kind: 'message',
            role: 'agent',
            messageId: uuidv4(),
            parts: [
              {
                kind: 'text',
                text: outputMessage,
              },
            ],
            taskId: taskId,
            contextId: contextId,
          },
          timestamp: new Date().toISOString(),
        },
        final: true,
      };
      eventBus.publish(finalUpdate);

      console.log(
        `[MsSqlAgentExecutor] Task ${taskId} finished with state: completed `
      );

    } catch (error: any) {
      console.error(
        `[MsSqlAgentExecutor] Error processing task ${taskId}: `,
        error
      );
      const errorUpdate: TaskStatusUpdateEvent = {
        kind: 'status-update',
        taskId: taskId,
        contextId: contextId,
        status: {
          state: 'failed',
          message: {
            kind: 'message',
            role: 'agent',
            messageId: uuidv4(),
            parts: [{ kind: 'text', text: `Agent error: ${error.message} ` }],
            taskId: taskId,
            contextId: contextId,
          },
          timestamp: new Date().toISOString(),
        },
        final: true,
      };
      eventBus.publish(errorUpdate);
    }
  }
}

const msSqlAgentCard: AgentCard = {
  name: 'MS-SQL Agent',
  description:
    'An agent that interacts with MS-SQL database to list tables and get schema.',
  url: 'http://localhost:41242/', // Changed port to avoid conflict
  provider: {
    organization: 'A2A Samples',
    url: 'https://example.com/a2a-samples',
  },
  version: '0.0.1',
  capabilities: {
    streaming: true,
    pushNotifications: false,
    stateTransitionHistory: true,
  },
  securitySchemes: undefined,
  security: undefined,
  defaultInputModes: ['text'],
  defaultOutputModes: ['text'],
  skills: [
    {
      id: 'ms_sql_database_interaction',
      name: 'MS-SQL Database Interaction',
      description:
        'Interacts with MS-SQL database to list tables and get schema for a given table.',
      tags: ['sql', 'database', 'mssql'],
      examples: [
        'List all tables in the database.',
        'Show schema of Orders table.',
      ],
      inputModes: ['text'],
      outputModes: ['text'],
    },
  ],
  supportsAuthenticatedExtendedCard: false,
};

async function main() {
  const taskStore: TaskStore = new InMemoryTaskStore();
  const agentExecutor: AgentExecutor = new MsSqlAgentExecutor();
  const requestHandler = new DefaultRequestHandler(
    msSqlAgentCard,
    taskStore,
    agentExecutor
  );
  const appBuilder = new A2AExpressApp(requestHandler);
  const expressApp = appBuilder.setupRoutes(express(), '');
  const PORT = process.env.MS_SQL_AGENT_PORT || 41242; // Changed port
  expressApp.listen(PORT, () => {
    console.log(`[MsSqlAgent] Server started on http://localhost:${PORT}`);
    console.log(`[MsSqlAgent] Agent Card: http://localhost:${PORT}/.well-known/agent.json`);
    console.log('[MsSqlAgent] Press Ctrl+C to stop the server');
  });
}

main().catch(console.error);
