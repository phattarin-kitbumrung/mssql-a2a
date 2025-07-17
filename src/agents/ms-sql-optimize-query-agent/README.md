# MS-SQL Optimize Query Agent

This agent optimizes MS-SQL queries for performance using Genkit AI.

## How to Run

To run this agent, use the following command:

```bash
npm run agents:ms-sql-optimize-query-agent
```

## API Endpoint

The agent will be available at `http://localhost:41243/` by default.

## Skills

This agent provides the following skill:

- **MS-SQL Query Optimization**: Optimizes MS-SQL queries for better performance.

  **Examples:**
  - `Optimize the following query: SELECT * FROM Orders WHERE OrderDate < GETDATE() - 30`
  - `Improve the performance of this query: SELECT SUM(Amount) FROM Transactions GROUP BY AccountId`
