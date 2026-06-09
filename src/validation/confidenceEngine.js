// src/validation/confidenceEngine.js
const WEIGHT_VECTOR = parseFloat(process.env.CONFIDENCE_WEIGHT_VECTOR || '0.5');
const WEIGHT_LLM    = parseFloat(process.env.CONFIDENCE_WEIGHT_LLM    || '0.5');
const THRESHOLD_LOW  = parseFloat(process.env.CONFIDENCE_THRESHOLD      || '0.6');
const THRESHOLD_HIGH = parseFloat(process.env.CONFIDENCE_HIGH_THRESHOLD || '0.8');

function calculateConfidence(vectorSimilarity, llmSelfScore) {
  if (typeof vectorSimilarity !== 'number' || typeof llmSelfScore !== 'number') {
    throw new Error('Confidence scores must be numbers');
  }
  if (vectorSimilarity < 0 || vectorSimilarity > 1 || llmSelfScore < 0 || llmSelfScore > 1) {
    throw new Error('Confidence scores must be between 0 and 1');
  }
  const weightedFinal = vectorSimilarity * WEIGHT_VECTOR + llmSelfScore * WEIGHT_LLM;
  const level = getConfidenceLevel(weightedFinal);
  return {
    vector_similarity: round(vectorSimilarity),
    llm_self_score:    round(llmSelfScore),
    weighted_final:    round(weightedFinal),
    level
  };
}

function getConfidenceLevel(score) {
  if (score >= THRESHOLD_HIGH) return 'high';
  if (score >= THRESHOLD_LOW)  return 'medium';
  return 'low';
}

function decideAction(confidenceResult) {
  switch (confidenceResult.level) {
    case 'high':   return 'tag';
    case 'medium': return 'tag_with_flag';
    case 'low':    return 'refuse';
    default:       return 'refuse';
  }
}

function shouldEscalate(confidenceResult) {
  return confidenceResult.level === 'low';
}

function round(num, decimals = 2) {
  return Math.round(num * 10 ** decimals) / 10 ** decimals;
}

module.exports = { calculateConfidence, getConfidenceLevel, decideAction, shouldEscalate };
