# MS-SQL Agent-to-Agent Samples

This project provides a set of JavaScript/TypeScript agents built with [Genkit](https://genkit.dev/) and the [Agent-to-Agent (A2A) SDK](https://github.com/a2a-js/sdk). These agents are designed to interact with MS-SQL databases, offering functionalities for SQL query generation and optimization.

## Features

-   **MS-SQL Query Generation**: An agent that can list database tables, retrieve their schemas, and generate valid MS-SQL queries from natural language requests.
-   **MS-SQL Query Optimization**: An agent dedicated to optimizing existing MS-SQL queries for better performance.
-   **CLI Interaction**: A command-line interface (`cli.ts`) for direct interaction with the deployed agents.
-   **RESTful API**: An Express.js-based API (`api.ts`) that exposes endpoints to programmatically generate and optimize SQL queries by orchestrating the agents.
-   **Ollama Integration**: Utilizes an Ollama plugin for Genkit to leverage local language models.

## Setup

1.  **Clone the repository**:
    ```bash
    git clone <repository-url>
    cd mssql-a2a
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

3.  **Configure Database**: Update the `DATABASE_CONFIG` in `src/config.ts` with your MS-SQL database credentials and server details.

    ```typescript
    export const DATABASE_CONFIG = {
      user: 'your-username',
      password: 'your-password',
      server: 'your-sql-server.database.windows.net', 
      database: 'your-database-name',
    };
    ```

4.  **Ollama Setup**: Ensure you have Ollama running locally and the `llama3:8b` model pulled, or update `src/config.ts` to use a different model.

    ```bash
    ollama run llama3:8b
    ```

## Running the Agents

Each agent runs as a separate process and exposes its functionality via the A2A protocol. You can run them concurrently.

### MS-SQL Query Generation Agent

```bash
npm run agents:ms-sql-agent
```

This agent will start on `http://localhost:41242/`.

### MS-SQL Query Optimization Agent

```bash
npm run agents:ms-sql-optimize-query-agent
```

This agent will start on `http://localhost:41243/`.

## CLI Usage

Once the agents are running, you can interact with them using the provided CLI client. You need to specify the agent's URL as an argument.

To interact with the MS-SQL Query Generation Agent:

```bash
npm run a2a:cli http://localhost:41242
```

To interact with the MS-SQL Query Optimization Agent:

```bash
npm run a2a:cli http://localhost:41243
```

Follow the prompts in the CLI to send messages to the agents.

## API Usage

The `api.ts` file sets up an Express.js server that orchestrates the MS-SQL agents to provide a combined query generation and optimization service.

To start the API server:

```bash
npm run api
```

The API server will run on `http://localhost:3000`.

### Endpoints

#### `POST /generate-and-optimize-query`

Generates an MS-SQL query from natural language and then optimizes it.

-   **Method**: `POST`
-   **URL**: `http://localhost:3000/generate-and-optimize-query`
-   **Request Body (JSON)**:
    ```json
    {
      "query": "your natural language query here"
    }
    ```
-   **Response (JSON)**:
    ```json
    {
      "optimizedQuery": "generated and optimized SQL query"
    }
    ```

#### `POST /generate-and-optimize-query/job`

Initiates a background job for query generation and optimization, returning a job ID immediately.

-   **Method**: `POST`
-   **URL**: `http://localhost:3000/generate-and-optimize-query/job`
-   **Request Body (JSON)**:
    ```json
    {
      "query": "your natural language query here"
    }
    ```
-   **Response (JSON)**:
    ```json
    {
      "jobId": "unique-job-id"
    }
    ```

#### `GET /query-status/:jobId`

Retrieves the status and result of a previously submitted job.

-   **Method**: `GET`
-   **URL**: `http://localhost:3000/query-status/:jobId`
-   **Response (JSON)**:
    ```json
    {
      "status": "pending" | "completed" | "failed",
      "result": { "optimizedQuery": "..." } // Present if status is "completed"
      "error": "..." // Present if status is "failed"
    }
    ```

## Disclaimer

Important: The sample code provided is for demonstration purposes and illustrates the mechanics of the Agent-to-Agent (A2A) protocol. When building production applications, it is critical to treat any agent operating outside of your direct control as a potentially untrusted entity.

All data received from an external agent—including but not limited to its AgentCard, messages, artifacts, and task statuses—should be handled as untrusted input. For example, a malicious agent could provide an AgentCard containing crafted data in its fields (e.g., description, name, skills.description). If this data is used without sanitization to construct prompts for a Large Language Model (LLM), it could expose your application to prompt injection attacks. Failure to properly validate and sanitize this data before use can introduce security vulnerabilities into your application.

Developers are responsible for implementing appropriate security measures, such as input validation and secure handling of credentials to protect their systems and users.