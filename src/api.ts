import express from 'express';
import bodyParser from 'body-parser';
import { runFlow } from '@genkit-ai/flow';
import { msSqlFlow } from './agents/ms-sql-agent/genkit.js';
import { optimizeQueryFlow } from './agents/ms-sql-optimize-query-agent/genkit.js';
import { getTableList, getTableSchema } from './agents/ms-sql-agent/index.js';
import { uuidv7 } from "uuidv7";

const app = express();
const port = 3000;

const jobs = {};
// Get schema from database
const tables = await getTableList();
const schemaPromises = tables.split(', ').map(t => getTableSchema(t));
const schemas = await Promise.all(schemaPromises);
const fullSchema = schemas.join('\n\n');

app.use(bodyParser.json());

app.post('/generate-and-optimize-query', async (req, res) => {
  const { query } = req.body;

  if (!query) {
    return res.status(400).json({ error: 'Missing query in request body' });
  }

  try {
    // Generate query from ms-sql-agent
    const prompt = `You are an expert SQL developer specialized in Microsoft SQL Server.\nGiven the database schema below, convert the following natural language request into a valid MS SQL query.\n\nDatabase schema:\n${fullSchema}\n\nUser ask: ${query}\nOnly output the SQL query. No explanations.`
    const generatedQuery = await runFlow(msSqlFlow, prompt);

    // Optimize query using ms-sql-optimize-query-agent
    const optimizedQuery = await runFlow(optimizeQueryFlow, generatedQuery);

    res.json({ optimizedQuery });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to generate and optimize query' });
  }
});

app.post('/generate-and-optimize-query/job', async (req, res) => {
  const { query } = req.body;

  if (!query) {
    return res.status(400).json({ error: 'Missing query in request body' });
  }

  const jobId = uuidv7(); 
  jobs[jobId] = { status: 'pending' };

  res.status(202).json({ jobId });

  try {
    // Generate query from ms-sql-agent
    const prompt = `You are an expert SQL developer specialized in Microsoft SQL Server.\nGiven the database schema below, convert the following natural language request into a valid MS SQL query.\n\nDatabase schema:\n${fullSchema}\n\nUser ask: ${query}\nOnly output the SQL query. No explanations.`
    const generatedQuery = await runFlow(msSqlFlow, prompt);

    // Optimize query using ms-sql-optimize-query-agent
    const optimizedQuery = await runFlow(optimizeQueryFlow, generatedQuery);

    jobs[jobId] = { status: 'completed', result: { optimizedQuery } };
  } catch (error) {
    console.error(error);
    jobs[jobId] = { status: 'failed', error: 'Failed to generate and optimize query' };
  }
});

app.get('/query-status/:jobId', (req, res) => {
  const { jobId } = req.params;
  const job = jobs[jobId];

  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  res.json(job);
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});

export default app;
