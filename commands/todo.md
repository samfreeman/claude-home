---
allowed-tools: TodoWrite
description: Manage a todo list for the current coding session
---

## Context

Todo command: $ARGUMENTS

## Your task

Parse the arguments and manage the todo list accordingly:

1. If arguments are empty or "list":
   - Display the current todo list in a nice format
   - Show status (pending/in_progress/completed) with emojis
   - Group by priority if there are many items

2. If arguments start with "add":
   - Extract the task description after "add"
   - Add it to the todo list as pending with medium priority
   - Show the updated list

3. If arguments start with "done" or "complete":
   - Extract the task ID or description
   - Mark the matching todo as completed
   - Show the updated list

4. If arguments start with "start" or "work":
   - Extract the task ID or description
   - Mark the matching todo as in_progress
   - Show the updated list

5. If arguments are "clear":
   - Remove all completed todos
   - Show the updated list

6. If arguments are "reset":
   - Clear the entire todo list after confirmation
   - Start fresh

Examples:

- `/todo` - Show current todo list
- `/todo add Implement user authentication`
- `/todo done 3`
- `/todo start authentication task`
- `/todo clear`
