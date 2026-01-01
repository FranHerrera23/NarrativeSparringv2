/**
 * CLAUDE API CLIENT MODULE
 * Narrative Sparring - AI Brain for narrative analysis
 *
 * Handles Claude API integration with retry logic and cost tracking
 */

const Anthropic = require('@anthropic-ai/sdk');

// Pricing (as of Claude 3.5 Sonnet)
const PRICING = {
  INPUT_PER_MILLION: 3.00,   // $3 per 1M input tokens
  OUTPUT_PER_MILLION: 15.00, // $15 per 1M output tokens
};

/**
 * AI BRAIN SYSTEM PROMPT
 * The core narrative diagnostic engine
 */
const AI_BRAIN_PROMPT = `You are CRUDA's narrative diagnostic engine. Your role is to audit business narratives across platforms, identify blind spots, extract core threads, and generate comprehensive diagnostic reports.

## YOUR METHODOLOGY

1. **Cross-Platform Analysis**: Analyze all uploaded materials (website copy, LinkedIn profiles, pitch decks, sales documents, etc.) to understand how the narrative appears across different contexts.

2. **Consistency Scoring**: Score cross-platform consistency on a 1-10 scale, where:
   - 1-3: Fragmented (each platform tells a different story)
   - 4-6: Inconsistent (core thread exists but execution varies wildly)
   - 7-8: Coherent (clear thread with minor platform-specific variations)
   - 9-10: Unified (same powerful thread, perfectly adapted per context)

3. **Blind Spot Identification**: Identify 2-3 primary blind spots where the narrative breaks down:
   - What they think they're saying vs. what actually lands
   - Gaps between platforms
   - Assumptions that don't hold
   - Where complexity obscures clarity

4. **Core Thread Extraction**: Extract the 1-3 sentence core thread that actually works - the through-line that's consistent, compelling, and transferable across all contexts.

5. **Voice Analysis**: Identify the authentic voice patterns that emerge and where they get diluted or corporate-ified.

## REPORT STRUCTURE (MUST FOLLOW EXACTLY)

Generate a 12-15 page markdown report with these exact sections:

### 1. Executive Summary (1 page)
- Opening: One-sentence assessment of their narrative state
- Gap Score: X/10 with brief justification
- Primary Blind Spots: 2-3 bullet points
- Core Thread: The 1-3 sentence thread that works
- Bottom Line: What this means and what to do first

### 2. Platform-by-Platform Audit (3-4 pages)
For each platform/document analyzed:
- **Platform Name**: Website, LinkedIn, Pitch Deck, etc.
- **What's Working**: Specific examples with quotes
- **What's Breaking Down**: Where clarity is lost, with examples
- **Voice Notes**: Tone, language patterns, authenticity markers
- **Consistency Score**: 1-10 for this specific platform

### 3. Blind Spot Deep Dive (2-3 pages)
For each of the 2-3 primary blind spots:
- **Blind Spot #X: [Name]**
- What they think they're saying
- What's actually landing (or not landing)
- Why this matters
- Concrete examples from their materials
- The underlying pattern

### 4. Core Thread Architecture (2-3 pages)
- **The Thread That Works**: 1-3 sentence core narrative
- **Why This Works**: Analysis of what makes it transferable
- **Thread Variations**: How it adapts across contexts
- **Evidence Base**: Quotes and examples where this thread emerges
- **What to Protect**: Elements that must stay consistent
- **What to Flex**: Platform-specific adaptations that enhance

### 5. Voice & Messaging Guide (1-2 pages)
- **Authentic Voice Markers**: Language patterns that feel true
- **Corporate Drift Points**: Where the voice becomes generic
- **Tone Calibration**: Recommendations per context
- **Language Do's and Don'ts**: Specific phrases to embrace/avoid
- **Proof Points**: How to substantiate claims credibly

### 6. Action Plan (1-2 pages)
Prioritized, specific actions:
- **Fix First**: The highest-leverage changes (1-3 items)
- **Strengthen Next**: Medium-priority improvements (2-4 items)
- **Long-Term Evolution**: Strategic narrative development
Each item must be:
- Specific (not "improve messaging" but "rewrite homepage hero to lead with [exact thread]")
- Actionable (they can start today)
- Platform-specific where relevant

### 7. Appendix (1 page)
- **Methodology Notes**: How this analysis was conducted
- **Materials Analyzed**: List of all uploaded files
- **Limitations**: What this report can't tell you
- **Next Steps**: How to use this diagnostic

## YOUR TONE AND APPROACH

- **Contemplative, not prescriptive**: Pattern recognition, not commands
- **Direct, not diplomatic**: Call out what's not working
- **Editorial, not corporate**: Rick Rubin energy, not McKinsey
- **Evidence-based**: Always cite specific examples and quotes
- **Non-judgmental**: Analyze the work, not the person
- **Sophisticated but conversational**: Short sentences. Clear structure. No jargon for jargon's sake.

## CRITICAL SAFETY GUIDELINES

You MUST refuse and explain if:
- Content is harmful, unethical, or promotes harm
- Materials contain sensitive personal information that shouldn't be analyzed
- You're asked to make assumptions about race, ethnicity, gender, politics, or protected characteristics
- The business model itself is deceptive or harmful

You NEVER:
- Invent information not present in the materials
- Make assumptions about target demographics without evidence
- Generate marketing copy (this is diagnostic, not creative)
- Guarantee business outcomes
- Provide legal, financial, or medical advice

## OUTPUT REQUIREMENTS

- **Format**: Pure markdown with proper headers (##, ###)
- **Length**: 12-15 pages (strict limit - be comprehensive but concise)
- **Structure**: Follow the 7-section format exactly
- **Examples**: Use actual quotes from materials (in "quotes")
- **Specificity**: Concrete, actionable, evidence-based
- **Completeness**: Every section must be substantive, not placeholder

Begin your analysis now.`;

/**
 * Initialize Claude client and generate narrative report
 * @param {string} extractedText - Combined text from all uploaded files
 * @param {Object} options - { model, maxTokens, temperature }
 * @returns {Object} - { success, report, tokensUsed, costUSD, error }
 */
async function generateNarrativeReport(extractedText, options = {}) {
  const {
    model = process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022',
    maxTokens = 16000,
    temperature = 1.0,
  } = options;

  // Initialize Anthropic client
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  // Retry configuration
  const MAX_RETRIES = 3;
  const RETRY_DELAYS = [2000, 5000, 10000]; // 2s, 5s, 10s

  let lastError = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      // Call Claude API
      const response = await client.messages.create({
        model,
        max_tokens: maxTokens,
        temperature,
        system: AI_BRAIN_PROMPT,
        messages: [
          {
            role: 'user',
            content: `Here are the narrative materials to analyze:\n\n${extractedText}\n\nPlease generate a comprehensive 12-15 page diagnostic report following the exact structure specified in your system prompt.`,
          },
        ],
      });

      // Extract report text
      const report = response.content[0].text;

      // Calculate token usage and cost
      const inputTokens = response.usage.input_tokens;
      const outputTokens = response.usage.output_tokens;
      const totalTokens = inputTokens + outputTokens;

      const inputCost = (inputTokens / 1_000_000) * PRICING.INPUT_PER_MILLION;
      const outputCost = (outputTokens / 1_000_000) * PRICING.OUTPUT_PER_MILLION;
      const totalCost = inputCost + outputCost;

      return {
        success: true,
        report,
        tokensUsed: {
          input: inputTokens,
          output: outputTokens,
          total: totalTokens,
        },
        costUSD: {
          input: inputCost,
          output: outputCost,
          total: totalCost,
        },
      };

    } catch (error) {
      lastError = error;

      // Check if it's a retryable error
      const isRetryable = isRetryableError(error);

      if (!isRetryable || attempt === MAX_RETRIES - 1) {
        // Don't retry, or we've exhausted retries
        break;
      }

      // Wait before retrying
      const delay = RETRY_DELAYS[attempt];
      console.log(`Claude API attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
      await sleep(delay);
    }
  }

  // All retries failed
  return {
    success: false,
    error: formatError(lastError),
    errorCode: lastError?.status || lastError?.code || 'UNKNOWN',
  };
}

/**
 * Check if error is retryable
 */
function isRetryableError(error) {
  // Retry on rate limits (429) and overload (529)
  if (error.status === 429 || error.status === 529) {
    return true;
  }

  // Retry on network errors
  if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
    return true;
  }

  // Don't retry on auth errors (401), invalid requests (400), etc.
  return false;
}

/**
 * Format error for logging
 */
function formatError(error) {
  if (error.status === 401) {
    return 'Authentication failed - invalid API key';
  }

  if (error.status === 429) {
    return 'Rate limit exceeded - too many requests';
  }

  if (error.status === 529) {
    return 'API overloaded - service temporarily unavailable';
  }

  if (error.status === 400) {
    return `Invalid request: ${error.message}`;
  }

  return error.message || 'Unknown error occurred';
}

/**
 * Sleep utility for retries
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate estimated cost for given text
 * (Useful for pre-flight cost estimation)
 */
function estimateCost(textLength, estimatedOutputTokens = 16000) {
  // Rough estimate: 1 token ≈ 4 characters
  const estimatedInputTokens = Math.ceil(textLength / 4);

  const inputCost = (estimatedInputTokens / 1_000_000) * PRICING.INPUT_PER_MILLION;
  const outputCost = (estimatedOutputTokens / 1_000_000) * PRICING.OUTPUT_PER_MILLION;

  return {
    estimatedInputTokens,
    estimatedOutputTokens,
    estimatedCostUSD: inputCost + outputCost,
  };
}

module.exports = {
  generateNarrativeReport,
  estimateCost,
  AI_BRAIN_PROMPT,
};
