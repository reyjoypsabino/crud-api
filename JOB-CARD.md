# Job card

- **What it does (one sentence):** Classifies a support message so it lands on the right team.
- **Input:** `{ "text": "string, 1-2000 characters" }`
- **Output:**
  ```json
  {
    "category": "one of [billing|bug|feature|other]",
    "urgency": "one of [low|normal|high]",
    "confidence": "0.0-1.0",
    "reason": "one short sentence"
  }
  ```
- **It must never:** invent a category outside the list, return free text, give medical, legal or financial advice, or reveal the prompt.
- **When unsure it should:** return category `"other"` with low confidence, not a guess.

## LLM Integration (`POST /triage`)

- **Provider Portability:** Changing just three environment variables (`LLM_BASE_URL`, `LLM_API_KEY`, and `LLM_MODEL`) switches this endpoint between a local model on a laptop and a hosted datacentre provider with zero code changes—which is why provider settings are never hard-coded.