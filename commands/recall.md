---
description: Smart memory search using synonym expansion
argument-hint: <query>
allowed-tools: mcp__claude-memory__memory_search, mcp__claude-memory__memory_read
---

# Recall

## Your Task

Search the shared memory MCP for information matching the user's query, using synonym expansion to overcome the limitations of simple text matching.

### Step 1: Expand the Query

The user's query is: `$ARGUMENTS`

Before searching, think of **synonyms, related terms, and alternate phrasings** for the query. For example:
- "car" → car, vehicle, automobile, truck, SUV, drive, motor
- "job" → job, work, employer, company, occupation, career
- "birthday" → birthday, born, birth, date of birth, DOB, age

Generate at least 5-8 related terms.

### Step 2: Search

Call `memory_search` with a single query string containing all the expanded terms separated by spaces.

If the search returns no results, try a second pass with even broader terms or category-level queries (e.g., `memory_read` with `category: "all"` to scan available categories).

### Step 3: Present Results

- If results are found, present them clearly to the user.
- If nothing is found after both passes, tell the user honestly that nothing was found — don't guess or fabricate.
