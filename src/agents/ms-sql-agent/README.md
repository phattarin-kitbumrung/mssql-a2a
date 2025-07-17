
# MS SQL Agent

This agent connects to a Microsoft SQL Server database and allows you to interact with it using natural language.

## Prerequisites

- Access to a Microsoft SQL Server database.
- The `mssql` package installed in your project.

## Configuration

1.  Update the database connection configuration in `src/agents/ms-sql-agent/index.ts` with your database credentials.
2.  Make sure your SQL server is configured to accept TCP/IP connections.

## Usage

Once the agent is configured, you can use it to:

- List all tables in the database.
- Get the schema of a specific table.
- Convert natural language queries into SQL queries.
