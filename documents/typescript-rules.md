# TypeScript Formatting Rules

All .ts files and .tsx files and .js files and .jsx files should follow the following set of rules for code formatting:

Other text files (.md, .json, .css, etc) should use 2 spaces for indentation

## Formatting Rules

- Avoid inserting comments and doc-comments - only comment when there is truly something unusual about the code
- Use single quotes for strings
- Use tabs for indentation (size: 4) - except when in an MD code block (then the indentation should be 4 spaces)
- No semicolons at end of lines
- The last line in an array should not end with a comma
- Single-statement blocks should not use braces
- else and catch statements must be on new lines
- Use type-unsafe comparisons (== instead of ===, != instead of !==)
- Arrow function bodies should be on new line
- If statement bodies should be on new line
- Function calls over 80 columns should split parameters to new lines
- Prefer ternary operator to if/else if to set values

## Examples

### Quotes and Indentation

```typescript
const str = 'hello'
function example() {
    const x = 1
    if (x == 1)
        console.log('one')
}
```

### Block Statements and Comparisons

```typescript
if (condition)
    doSomething()

if (x == null)
    return

try {
    riskyOperation()
}
catch (error) {
    handleError()
}
```

### Block Statements with Compound Bodies

```typescript
function () {
    // compound statements
}

if (true) {
    // compound statements
}

class SomeClass {
    // compound members
}
```

### Arrow Functions

```typescript
const processData = () =>
    doSomething()

// Short inline functions are ok
array.map(x => x * 2)
```

### Function Calls

```typescript
someFunction(
    param1,
    param2,
    param3)

// With object literal as last param
someFunction(
    param1,
    param2,
    {
        key: 'value'
    })
```

### Arrays and Objects

```typescript
// Arrays - no trailing comma on last element
const array = [
    'first',
    'second',
    'third'
]

// Objects - no trailing comma on last property
const obj = {
    prop1: 'value1',
    prop2: 'value2',
    prop3: 'value3'
}
```

### Ternary Operator

```typescript
// Bad
let x = 0
if (y > 0)
    x = 1

// Good
const x = y > 0
    ? 1
    : 0
```

## Key Points to Remember

1. **Always use single quotes** for strings
2. **Never use semicolons** at the end of statements
3. **Use tabs for indentation** (4 spaces in MD code blocks only)
4. **No trailing commas** on the last array/object element
5. **Single statements don't need braces** - put them on new lines
6. **Use == instead of ===** for comparisons
7. **Arrow function bodies on new lines** for multi-statement functions
8. **Split long function calls** across multiple lines
9. **else and catch on new lines** always
10. **If statement bodies on new lines** when single statements

This formatting creates clean, readable code that follows consistent patterns throughout the codebase.