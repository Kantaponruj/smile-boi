// src/ai/claudeClient.js
// Claude API wrapper — ส่ง chat message + Rulebook context แล้วรับ structured JSON

const Anthropic = require('@anthropic-ai/sdk');
const { retrieveRulebookChunks } = require('../retrieval/vectorSearch');
const { validateOutput, buildRefusalOutput } = require('../validation/schemaValidator');
const { calculateConfidence, shouldEscalate } = require('../validation/confidenceEngine');
const { logTagging, logRefusal } = require('../models/TaggingLog');
const logger = require('pino')();

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514';

// ─── System Prompt ───────────────────────────────────────────────────
function buildSystemPrompt(rulebookChunks) {
  const chunksText = rulebookChunks
    .map((c) => `[${c.document_id} v${c.version} §${c.section_id}]\n${c.content}`)
    .join('\n\n---\n\n');

  return `You are smileChatBot, an Evidence-Gated Intent Tagging Engine for a LINE OA customer service system.

## Your Core Rules (NON-NEGOTIABLE)
1. ALWAYS base your analysis on the provided Rulebook sections below — NEVER hallucinate or invent tags
2. If confidence is low (< 0.6), set recommended_action to "refuse" and explain in missing_information
3. ALWAYS return a valid JSON object matching the exact schema — NO free text, NO markdown fences

## Available Rulebook Context
${chunksText}

## Output Schema (return ONLY this JSON, nothing else)
{
  "answer_summary": {
    "tag": "<tag_name or null>",
    "description": "<explanation in Thai>"
  },
  "source_evidence": {
    "document": "<document name>",
    "version": "<vX.X>",
    "section": "<section number>",
    "effective_date": "<YYYY-MM-DD>"
  },
  "confidence_signal": {
    "vector_similarity": <0.0-1.0>,
    "llm_self_score": <0.0-1.0 — your honest self-assessment>,
    "weighted_final": <calculated: (vector * 0.5) + (llm * 0.5)>,
    "level": "<high|medium|low>"
  },
  "missing_information": <null or "explanation of what's missing">,
  "recommended_action": "<tag|ask_clarification|escalate|refuse>",
  "review_owner": "<admin|supervisor>"
}

## Confidence Level Rules
- llm_self_score >= 0.8: high confidence — tag automatically
- llm_self_score 0.6-0.79: medium — tag but flag for spot check  
- llm_self_score < 0.6: low — REFUSE, fill missing_information, set recommended_action="refuse"

## Available Tags (from Rulebook)
- #Quotation_Request — ลูกค้าขอราคา/ใบเสนอราคา
- #Purchase_Intent — ลูกค้าแสดงเจตนาซื้อชัดเจน
- #General_Inquiry — สอบถามทั่วไป ไม่ได้ต้องการซื้อ
- #Bug_Report — แจ้งปัญหา/ข้อผิดพลาด
- #Complaint — ร้องเรียน
- #Support_Request — ขอความช่วยเหลือด้านเทคนิค
- (ดูเพิ่มเติมใน Rulebook §2.3)`;
}

// ─── Main Process Function ───────────────────────────────────────────
async function processMessage(event) {
  const chatMessage = event.message.text;
  const userId = event.source.userId;
  const caseId = `LINE-${userId.slice(-8)}`; // derive case_id from userId

  logger.info({ caseId, messageLength: chatMessage.length }, 'Processing message');

  try {
    // 1. Retrieve relevant Rulebook chunks from Vector DB
    const { chunks, vectorSimilarity } = await retrieveRulebookChunks(chatMessage);

    if (!chunks || chunks.length === 0) {
      logger.warn({ caseId }, 'No rulebook chunks found — refusing');
      const refusal = buildRefusalOutput('ไม่พบ Rulebook ที่ตรงกับข้อความนี้ในฐานข้อมูล');
      await logRefusal({ case_id: caseId, ai_suggestion: null, refusal_reason: 'no_chunks_found' });
      return refusal;
    }

    // 2. Build prompt and call Claude API
    const systemPrompt = buildSystemPrompt(chunks);

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: parseInt(process.env.CLAUDE_MAX_TOKENS || '1000'),
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `วิเคราะห์ข้อความแชทต่อไปนี้และระบุเจตนาของลูกค้า:\n\n"${chatMessage}"`
        }
      ]
    });

    // 3. Parse response
    const rawText = response.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('');

    let parsed;
    try {
      const cleaned = rawText.replace(/```json|```/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch (e) {
      logger.error({ caseId, rawText }, 'Failed to parse Claude JSON response');
      return buildRefusalOutput('ระบบ AI ตอบกลับในรูปแบบที่ไม่ถูกต้อง');
    }

    // 4. Recalculate confidence with vector similarity
    const confidenceResult = calculateConfidence(
      vectorSimilarity,
      parsed.confidence_signal?.llm_self_score || 0
    );

    // Override confidence_signal ด้วยค่าที่คำนวณจริง
    parsed.confidence_signal = confidenceResult;

    // 5. Validate schema
    const { valid, errors } = validateOutput(parsed);
    if (!valid) {
      logger.error({ caseId, errors }, 'Schema validation failed');
      return buildRefusalOutput(`Schema validation failed: ${errors?.join(', ')}`);
    }

    // 6. Apply refusal logic if confidence too low
    if (shouldEscalate(confidenceResult)) {
      parsed.recommended_action = 'refuse';
      parsed.review_owner = 'supervisor';
      await logRefusal({
        case_id: caseId,
        ai_suggestion: parsed.answer_summary?.tag,
        refusal_reason: `confidence_too_low: ${confidenceResult.weighted_final}`
      });
      logger.info({ caseId, confidence: confidenceResult.weighted_final }, 'Refusing — escalating to human');
    } else {
      // 7. Log successful tagging
      await logTagging({ case_id: caseId, output: parsed });
      logger.info({ caseId, tag: parsed.answer_summary?.tag, level: confidenceResult.level }, 'Tagged successfully');
    }

    return parsed;

  } catch (err) {
    logger.error({ err, caseId }, 'Unexpected error in processMessage');
    return buildRefusalOutput('เกิดข้อผิดพลาดภายในระบบ กรุณาลองใหม่หรือติดต่อ Supervisor');
  }
}

module.exports = { processMessage };
