import express from "express";
import { v4 as uuidv4 } from 'uuid';

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
  TaskArtifactUpdateEvent,
  TaskStatusUpdateEvent,
  TextPart,
} from "@a2a-js/sdk";
import { runFlow } from "@genkit-ai/flow";
import { optimizeQueryFlow } from "./genkit.js";

class MsSqlOptimizeQueryAgentExecutor implements AgentExecutor {
  private readonly cancelledTasks = new Set<string>();

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
      `[MsSqlOptimizeQueryAgentExecutor] Processing message ${userMessage.messageId} for task ${taskId} (context: ${contextId})`
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
          parts: [{ kind: 'text', text: 'Optimizing MS-SQL query...' }],
          taskId: taskId,
          contextId: contextId,
        },
        timestamp: new Date().toISOString(),
      },
      final: false,
    };
    eventBus.publish(workingStatusUpdate);

    const inputSql = userMessage.parts.find(p => p.kind === 'text') as TextPart | undefined;

    if (!inputSql || !inputSql.text) {
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
            parts: [{ kind: 'text', text: 'No SQL query provided for optimization.' }],
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

    try {
      const optimizedSql = await runFlow(optimizeQueryFlow, inputSql.text);

      if (this.cancelledTasks.has(taskId)) {
        console.log(`[MsSqlOptimizeQueryAgentExecutor] Request cancelled for task: ${taskId}`);
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

      const artifactUpdate: TaskArtifactUpdateEvent = {
        kind: 'artifact-update',
        taskId: taskId,
        contextId: contextId,
        artifact: {
          artifactId: 'optimized-ms-sql-query',
          name: 'optimized-ms-sql-query.sql',
          parts: [{ kind: 'text', text: optimizedSql }],
        },
        append: false,
        lastChunk: true,
      };
      eventBus.publish(artifactUpdate);

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
                text: 'Optimized MS-SQL query.',
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
        `[MsSqlOptimizeQueryAgentExecutor] Task ${taskId} finished with state: completed `
      );

    } catch (error: any) {
      console.error(
        `[MsSqlOptimizeQueryAgentExecutor] Error processing task ${taskId}: `,
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

const msSqlOptimizeQueryAgentCard: AgentCard = {
  name: 'MS-SQL Optimize Query Agent',
  description:
    'An agent that optimizes MS-SQL queries for better performance.',
  url: 'http://localhost:41243/',
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
  defaultOutputModes: ['text', 'file'],
  skills: [
    {
      id: 'ms_sql_query_optimization',
      name: 'MS-SQL Query Optimization',
      description:
        'Optimizes MS-SQL queries for better performance. (replaces queries with optimized versions)',
      tags: ['sql', 'database', 'optimization', 'performance'],
      examples: [
        'Optimize the following query: SELECT * FROM Orders WHERE OrderDate < GETDATE() - 30',
        'Improve the performance of this query: SELECT SUM(Amount) FROM Transactions GROUP BY AccountId',
      ],
      inputModes: ['text'],
      outputModes: ['text', 'file'],
    },
  ],
  supportsAuthenticatedExtendedCard: false,
};

async function main() {
  const taskStore: TaskStore = new InMemoryTaskStore();
  const agentExecutor: AgentExecutor = new MsSqlOptimizeQueryAgentExecutor();
  const requestHandler = new DefaultRequestHandler(
    msSqlOptimizeQueryAgentCard,
    taskStore,
    agentExecutor
  );
  const appBuilder = new A2AExpressApp(requestHandler);
  const expressApp = appBuilder.setupRoutes(express(), '');
  const PORT = process.env.MS_SQL_OPTIMIZE_QUERY_AGENT_PORT || 41243;
  expressApp.listen(PORT, () => {
    console.log(`[MsSqlOptimizeQueryAgent] Server started on http://localhost:${PORT}`);
    console.log(`[MsSqlOptimizeQueryAgent] Agent Card: http://localhost:${PORT}/.well-known/agent.json`);
    console.log('[MsSqlOptimizeQueryAgent] Press Ctrl+C to stop the server');
  });
}

main().catch(console.error);