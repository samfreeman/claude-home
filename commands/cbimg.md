---
allowed-tools: Bash, Read
description: USER COMMAND - Capture image from Windows clipboard and analyze it
---

## Context

Image capture result: !`echo "===== RUNNING IMAGE CAPTURE =====" && REPO_ROOT="/home/samf/source/claude" && if [[ ! -d "$REPO_ROOT/tools/image-to-file" ]]; then echo "Error: image-to-file tool not found at $REPO_ROOT/tools/image-to-file"; exit 1; fi && OUTPUT=$(node "$REPO_ROOT/tools/image-to-file/dist/index.js" --no-dialog 2>&1) && RETURN_CODE=$? && echo "RETURN_CODE:$RETURN_CODE" && echo "OUTPUT:$OUTPUT"`

## Your task

Based on the image capture result above:

- If RETURN_CODE is 0: Read the image file from the OUTPUT path and analyze it based on: $ARGUMENTS
- If RETURN_CODE is not 0: Inform the user that image capture failed and show the error from OUTPUT
