export const SCORING_ACTIONS = Object.freeze([
  "task",
  "quiz",
  "tradeOffer",
  "tradeConfirm",
  "assist",
  "challenge",
  "secret",
  "mystery",
  "rewardRedeem",
]);

// Preserve the historical load harness's zero-based, non-interpolated method.
export function quantile(sorted, q) {
  if (!Number.isFinite(q) || q < 0 || q > 1)
    throw new RangeError("Invalid quantile");
  return sorted.length
    ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))]
    : null;
}

export function createTimingRecorder(limit = 500000) {
  if (!Number.isSafeInteger(limit) || limit < 1)
    throw new RangeError("Invalid timing limit");
  const records = [];
  let dropped = 0;
  return {
    record(input) {
      if (!Number.isFinite(input.durationMs) || input.durationMs < 0)
        throw new Error("Invalid confirmed duration");
      if (records.length === limit) {
        dropped++;
        return;
      }
      // Explicit allowlist: never retain action payloads, answer text, cookies,
      // login tokens, or free-form server messages in the timing artifact.
      records.push({
        requestId: input.requestId,
        type: input.type,
        phaseAtSend: input.phaseAtSend,
        chapterAtSend: input.chapterAtSend,
        phaseAtConfirm: input.phaseAtConfirm,
        chapterAtConfirm: input.chapterAtConfirm,
        sentAt: input.sentAt,
        confirmedAt: input.confirmedAt,
        durationMs: input.durationMs,
        httpStatus: input.httpStatus,
        scoringInventory: SCORING_ACTIONS.includes(input.type),
        outcome: {
          accepted: true,
          correct:
            typeof input.result?.correct === "boolean"
              ? input.result.correct
              : null,
          complete:
            typeof input.result?.complete === "boolean"
              ? input.result.complete
              : null,
          tradeStatus: ["pending", "complete", "cancelled"].includes(
            input.result?.status,
          )
            ? input.result.status
            : null,
        },
      });
    },
    export(metadata) {
      return {
        formatVersion: 1,
        metadata,
        maxRecords: limit,
        complete: dropped === 0,
        dropped,
        recordCount: records.length,
        method:
          "Successful POST /api/action only; performance.now elapsed through response JSON parsing. Quantile: sorted[min(n-1,floor(n*q))], zero-based, no interpolation. Synthetic history prefill is excluded.",
        records,
      };
    },
  };
}
