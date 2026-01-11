# Claude Development Guidelines - MedAdmit

## Token Usage Optimization

**When searching for something in the codebase:**
- **FIRST try Grep** to locate the code/pattern
- Only read entire files if absolutely necessary
- Use Grep with `-A` and `-B` flags to get surrounding context
- Avoid reading large PDFs - ask user for key numbers instead

This prevents wasting tokens on reading files when you just need to find something specific.

Example:
```bash
# Good: Grep first to find the function
grep -n "calculateSchoolProbability" src/**/*.ts

# Then read only that section if needed
# Bad: Read the entire school-probability.ts file without knowing where to look
```
