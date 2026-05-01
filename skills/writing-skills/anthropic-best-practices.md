# Skill authoring best practices

> Sourced verbatim from <https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices>. Refreshed 2026-05-01.

Learn how to write effective Skills that Claude can discover and use successfully.

---

Good Skills are concise, well-structured, and tested with real usage. This guide provides practical authoring decisions to help you write Skills that Claude can discover and use effectively.

For conceptual background on how Skills work, see the [Skills overview](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview).

## Core principles

### Concise is key

The context window is a public good. Your Skill shares the context window with everything else Claude needs to know, including:
- The system prompt
- Conversation history
- Other Skills' metadata
- Your actual request

Not every token in your Skill has an immediate cost. At startup, only the metadata (name and description) from all Skills is pre-loaded. Claude reads SKILL.md only when the Skill becomes relevant, and reads additional files only as needed. However, being concise in SKILL.md still matters: once Claude loads it, every token competes with conversation history and other context.

**Default assumption:** Claude is already very smart

Only add context Claude doesn't already have. Challenge each piece of information:
- "Does Claude really need this explanation?"
- "Can I assume Claude knows this?"
- "Does this paragraph justify its token cost?"

**Good example: Concise** (approximately 50 tokens):
````markdown
## Extract PDF text

Use pdfplumber for text extraction:

```python
import pdfplumber

with pdfplumber.open("file.pdf") as pdf:
    text = pdf.pages[0].extract_text()
```
````

**Bad example: Too verbose** (approximately 150 tokens):
```markdown
## Extract PDF text

PDF (Portable Document Format) files are a common file format that contains
text, images, and other content. To extract text from a PDF, you'll need to
use a library. There are many libraries available for PDF processing, but
pdfplumber is recommended because it's easy to use and handles most cases well.
First, you'll need to install it using pip. Then you can use the code below...
```

The concise version assumes Claude knows what PDFs are and how libraries work.

### Set appropriate degrees of freedom

Match the level of specificity to the task's fragility and variability.

**High freedom** (text-based instructions):

Use when:
- Multiple approaches are valid
- Decisions depend on context
- Heuristics guide the approach

**Medium freedom** (pseudocode or scripts with parameters):

Use when:
- A preferred pattern exists
- Some variation is acceptable
- Configuration affects behavior

**Low freedom** (specific scripts, few or no parameters):

Use when:
- Operations are fragile and error-prone
- Consistency is critical
- A specific sequence must be followed

**Analogy:** Think of Claude as a robot exploring a path:
- **Narrow bridge with cliffs on both sides:** There's only one safe way forward. Provide specific guardrails and exact instructions (low freedom).
- **Open field with no hazards:** Many paths lead to success. Give general direction and trust Claude to find the best route (high freedom).

### Test with all models you plan to use

Skills act as additions to models, so effectiveness depends on the underlying model. Test your Skill with all the models you plan to use it with.

- **Claude Haiku** (fast, economical): Does the Skill provide enough guidance?
- **Claude Sonnet** (balanced): Is the Skill clear and efficient?
- **Claude Opus** (powerful reasoning): Does the Skill avoid over-explaining?

What works perfectly for Opus might need more detail for Haiku. If you plan to use your Skill across multiple models, aim for instructions that work well with all of them.

## Skill structure

> **YAML Frontmatter:** The SKILL.md frontmatter requires two fields:
>
> `name`:
> - Maximum 64 characters
> - Must contain only lowercase letters, numbers, and hyphens
> - Cannot contain XML tags
> - Cannot contain reserved words: "anthropic", "claude"
>
> `description`:
> - Must be non-empty
> - Maximum 1024 characters
> - Cannot contain XML tags
> - Should describe what the Skill does and when to use it

### Naming conventions

Use consistent naming patterns to make Skills easier to reference and discuss. Consider using **gerund form** (verb + -ing) for Skill names.

**Good naming examples (gerund form):**
- `processing-pdfs`, `analyzing-spreadsheets`, `managing-databases`, `testing-code`, `writing-documentation`

**Acceptable alternatives:**
- Noun phrases: `pdf-processing`, `spreadsheet-analysis`
- Action-oriented: `process-pdfs`, `analyze-spreadsheets`

**Avoid:**
- Vague: `helper`, `utils`, `tools`
- Overly generic: `documents`, `data`, `files`
- Reserved words: `anthropic-helper`, `claude-tools`

### Writing effective descriptions

The `description` field enables Skill discovery and should include both what the Skill does and when to use it.

> **Always write in third person**. The description is injected into the system prompt, and inconsistent point-of-view can cause discovery problems.

**Be specific and include key terms**. Include both what the Skill does and specific triggers/contexts for when to use it.

Effective examples:

```yaml
description: Extract text and tables from PDF files, fill forms, merge documents. Use when working with PDF files or when the user mentions PDFs, forms, or document extraction.
```
```yaml
description: Analyze Excel spreadsheets, create pivot tables, generate charts. Use when analyzing Excel files, spreadsheets, tabular data, or .xlsx files.
```
```yaml
description: Generate descriptive commit messages by analyzing git diffs. Use when the user asks for help writing commit messages or reviewing staged changes.
```

Avoid vague descriptions:

```yaml
description: Helps with documents
description: Processes data
description: Does stuff with files
```

### Progressive disclosure patterns

SKILL.md serves as an overview that points Claude to detailed materials as needed.

- Keep SKILL.md body under 500 lines for optimal performance
- Split content into separate files when approaching this limit

```text
pdf/
├── SKILL.md              # Main instructions (loaded when triggered)
├── FORMS.md              # Form-filling guide (loaded as needed)
├── reference.md          # API reference (loaded as needed)
├── examples.md           # Usage examples (loaded as needed)
└── scripts/
    ├── analyze_form.py   # Utility script (executed, not loaded)
    ├── fill_form.py
    └── validate.py
```

#### Pattern 1: High-level guide with references

````markdown
---
name: pdf-processing
description: Extracts text and tables from PDF files, fills forms, and merges documents. Use when working with PDF files or when the user mentions PDFs, forms, or document extraction.
---

# PDF Processing

## Quick start

Extract text with pdfplumber:
```python
import pdfplumber
with pdfplumber.open("file.pdf") as pdf:
    text = pdf.pages[0].extract_text()
```

## Advanced features

**Form filling**: See [FORMS.md](FORMS.md) for complete guide
**API reference**: See [REFERENCE.md](REFERENCE.md) for all methods
**Examples**: See [EXAMPLES.md](EXAMPLES.md) for common patterns
````

#### Pattern 2: Domain-specific organization

For Skills with multiple domains, organize content by domain to avoid loading irrelevant context.

```text
bigquery-skill/
├── SKILL.md (overview and navigation)
└── reference/
    ├── finance.md (revenue, billing metrics)
    ├── sales.md (opportunities, pipeline)
    ├── product.md (API usage, features)
    └── marketing.md (campaigns, attribution)
```

#### Pattern 3: Conditional details

Show basic content, link to advanced content:

```markdown
# DOCX Processing

## Creating documents

Use docx-js for new documents. See [DOCX-JS.md](DOCX-JS.md).

## Editing documents

For simple edits, modify the XML directly.

**For tracked changes**: See [REDLINING.md](REDLINING.md)
**For OOXML details**: See [OOXML.md](OOXML.md)
```

### Avoid deeply nested references

Claude may partially read files when they're referenced from other referenced files. When encountering nested references, Claude might use commands like `head -100` to preview content rather than reading entire files, resulting in incomplete information.

**Keep references one level deep from SKILL.md**. All reference files should link directly from SKILL.md.

**Bad example: Too deep**:
```markdown
# SKILL.md
See [advanced.md](advanced.md)...

# advanced.md
See [details.md](details.md)...
```

**Good example: One level deep**:
```markdown
# SKILL.md
**Basic usage**: [instructions in SKILL.md]
**Advanced features**: See [advanced.md](advanced.md)
**API reference**: See [reference.md](reference.md)
```

### Structure longer reference files with table of contents

For reference files longer than 100 lines, include a table of contents at the top.

```markdown
# API Reference

## Contents
- Authentication and setup
- Core methods (create, read, update, delete)
- Advanced features (batch operations, webhooks)
- Error handling patterns
- Code examples
```

## Workflows and feedback loops

### Use workflows for complex tasks

Break complex operations into clear, sequential steps. For complex workflows, provide a checklist that Claude can copy and check off.

**Example: PDF form filling workflow**:

````markdown
## PDF form filling workflow

```
- [ ] Step 1: Analyze the form (run analyze_form.py)
- [ ] Step 2: Create field mapping (edit fields.json)
- [ ] Step 3: Validate mapping (run validate_fields.py)
- [ ] Step 4: Fill the form (run fill_form.py)
- [ ] Step 5: Verify output (run verify_output.py)
```
````

### Implement feedback loops

**Common pattern:** Run validator → fix errors → repeat

```markdown
## Document editing process

1. Make your edits to `word/document.xml`
2. **Validate immediately**: `python ooxml/scripts/validate.py unpacked_dir/`
3. If validation fails:
   - Review the error message carefully
   - Fix the issues in the XML
   - Run validation again
4. **Only proceed when validation passes**
5. Rebuild: `python ooxml/scripts/pack.py unpacked_dir/ output.docx`
6. Test the output document
```

## Content guidelines

### Avoid time-sensitive information

Don't include information that will become outdated:

**Bad** (will become wrong):
```markdown
If you're doing this before August 2025, use the old API.
After August 2025, use the new API.
```

**Good** (use "old patterns" section):
```markdown
## Current method

Use the v2 API endpoint: `api.example.com/v2/messages`

## Old patterns

<details>
<summary>Legacy v1 API (deprecated 2025-08)</summary>

The v1 API used: `api.example.com/v1/messages`

This endpoint is no longer supported.
</details>
```

### Use consistent terminology

Choose one term and use it throughout the Skill:

**Good:** Always "API endpoint"; always "field"; always "extract".
**Bad:** Mix "API endpoint", "URL", "API route", "path"; mix "field", "box", "element", "control".

## Common patterns

### Template pattern

Provide templates for output format. Match the level of strictness to your needs (strict for API responses; flexible for analysis).

### Examples pattern

For Skills where output quality depends on seeing examples, provide input/output pairs.

### Conditional workflow pattern

```markdown
## Document modification workflow

1. Determine the modification type:
   **Creating new content?** → Follow "Creation workflow" below
   **Editing existing content?** → Follow "Editing workflow" below
```

## Evaluation and iteration

### Build evaluations first

**Create evaluations BEFORE writing extensive documentation.** This ensures your Skill solves real problems rather than documenting imagined ones.

**Evaluation-driven development:**
1. **Identify gaps:** Run Claude on representative tasks without a Skill. Document specific failures or missing context.
2. **Create evaluations:** Build three scenarios that test these gaps.
3. **Establish baseline:** Measure Claude's performance without the Skill.
4. **Write minimal instructions:** Create just enough content to address the gaps and pass evaluations.
5. **Iterate:** Execute evaluations, compare against baseline, and refine.

**Evaluation structure:**
```json
{
  "skills": ["pdf-processing"],
  "query": "Extract all text from this PDF file and save it to output.txt",
  "files": ["test-files/document.pdf"],
  "expected_behavior": [
    "Successfully reads the PDF file using an appropriate PDF processing library",
    "Extracts text content from all pages without missing any pages",
    "Saves the extracted text to output.txt in a clear, readable format"
  ]
}
```

### Develop Skills iteratively with Claude

Work with one instance of Claude ("Claude A") to create a Skill that is used by other instances ("Claude B"). Claude A helps you design and refine instructions; Claude B tests them in real tasks.

1. **Complete a task without a Skill** with Claude A using normal prompting.
2. **Identify the reusable pattern** from the context you provided.
3. **Ask Claude A to create a Skill** that captures the pattern.
4. **Review for conciseness** — remove unnecessary explanations.
5. **Improve information architecture** — organize content effectively.
6. **Test on similar tasks** with Claude B (a fresh instance with the Skill loaded).
7. **Iterate based on observation** — bring observations from Claude B back to Claude A.

### Observe how Claude navigates Skills

Watch for:
- **Unexpected exploration paths**
- **Missed connections** to important files
- **Overreliance on certain sections**
- **Ignored content**

Iterate based on these observations rather than assumptions.

## Anti-patterns to avoid

### Avoid Windows-style paths

Always use forward slashes in file paths, even on Windows:

- ✓ **Good:** `scripts/helper.py`, `reference/guide.md`
- ✗ **Avoid:** `scripts\helper.py`, `reference\guide.md`

### Avoid offering too many options

Don't present multiple approaches unless necessary:

````markdown
**Bad example: Too many choices** (confusing):
"You can use pypdf, or pdfplumber, or PyMuPDF, or pdf2image, or..."

**Good example: Provide a default** (with escape hatch):
"Use pdfplumber for text extraction:
```python
import pdfplumber
```

For scanned PDFs requiring OCR, use pdf2image with pytesseract instead."
````

## Advanced: Skills with executable code

### Solve, don't punt

Handle error conditions in scripts rather than punting to Claude.

**Good:**
```python
def process_file(path):
    try:
        with open(path) as f:
            return f.read()
    except FileNotFoundError:
        print(f"File {path} not found, creating default")
        with open(path, "w") as f:
            f.write("")
        return ""
```

**Bad:**
```python
def process_file(path):
    return open(path).read()  # let Claude figure it out
```

Avoid "voodoo constants" (Ousterhout's law). If you don't know the right value, how will Claude?

**Good:**
```python
# HTTP requests typically complete within 30 seconds
REQUEST_TIMEOUT = 30
```

**Bad:**
```python
TIMEOUT = 47  # Why 47?
```

### Provide utility scripts

Pre-made scripts are more reliable than Claude-generated code, save tokens, save time, and ensure consistency.

Make execution intent explicit:
- **Execute the script**: "Run `analyze_form.py` to extract fields"
- **Read it as reference**: "See `analyze_form.py` for the field extraction algorithm"

### Create verifiable intermediate outputs

The "plan-validate-execute" pattern catches errors early.

**When to use:** Batch operations, destructive changes, complex validation rules, high-stakes operations.

### Package dependencies

- **claude.ai:** Can install packages from npm, PyPI, and GitHub repositories
- **Claude API:** No network access, no runtime package installation

### Runtime environment

Skills run in a code execution environment with filesystem access, bash commands, and code execution.

1. **Metadata pre-loaded:** name + description from all Skills loaded into system prompt at startup
2. **Files read on-demand:** SKILL.md and other files read via bash when needed
3. **Scripts executed efficiently:** Utility scripts run via bash without loading their full contents into context
4. **No context penalty for large files:** Reference files don't consume tokens until accessed

### MCP tool references

If your Skill uses MCP tools, always use fully qualified names: `ServerName:tool_name`.

```markdown
Use the BigQuery:bigquery_schema tool to retrieve table schemas.
Use the GitHub:create_issue tool to create issues.
```

### Avoid assuming tools are installed

```markdown
**Bad**: "Use the pdf library to process the file."

**Good**: "Install required package: `pip install pypdf`. Then use it..."
```

## Technical notes

### YAML frontmatter requirements

- `name`: Maximum 64 characters, lowercase letters/numbers/hyphens only, no XML tags, no reserved words ("anthropic", "claude")
- `description`: Maximum 1024 characters, non-empty, no XML tags

### Token budgets

Keep SKILL.md body under 500 lines for optimal performance. If your content exceeds this, split into separate files using progressive disclosure.

## Checklist for effective Skills

### Core quality
- [ ] Description is specific and includes key terms
- [ ] Description includes both what the Skill does and when to use it
- [ ] SKILL.md body is under 500 lines
- [ ] Additional details are in separate files (if needed)
- [ ] No time-sensitive information (or in "old patterns" section)
- [ ] Consistent terminology throughout
- [ ] Examples are concrete, not abstract
- [ ] File references are one level deep
- [ ] Progressive disclosure used appropriately
- [ ] Workflows have clear steps

### Code and scripts
- [ ] Scripts solve problems rather than punt to Claude
- [ ] Error handling is explicit and helpful
- [ ] No "voodoo constants" (all values justified)
- [ ] Required packages listed and verified as available
- [ ] Scripts have clear documentation
- [ ] No Windows-style paths (all forward slashes)
- [ ] Validation/verification steps for critical operations
- [ ] Feedback loops included for quality-critical tasks

### Testing
- [ ] At least three evaluations created
- [ ] Tested with Haiku, Sonnet, and Opus
- [ ] Tested with real usage scenarios
- [ ] Team feedback incorporated (if applicable)
