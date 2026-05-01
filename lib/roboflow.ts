type RoboflowSourceType = "upload" | "camera" | "stream_url";

export type RoboflowDetectInput = {
  sessionId: string;
  sourceType: RoboflowSourceType;
  streamUrl?: string;
  imageBase64?: string;
  videoBase64?: string;
  mimeType?: string;
};

export type RoboflowDetectionResult = {
  violenceDetected: boolean;
  confidence: number | null;
  raw: Record<string, unknown> | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function firstNumber(...values: unknown[]): number | null {
  for (const v of values) {
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return null;
}

function inferViolence(result: Record<string, unknown>): {
  violenceDetected: boolean;
  confidence: number | null;
} {
  const directBoolean = result.violence_detected;
  if (typeof directBoolean === "boolean") {
    return {
      violenceDetected: directBoolean,
      confidence: firstNumber(result.confidence),
    };
  }

  const predictions = Array.isArray(result.predictions)
    ? result.predictions
    : Array.isArray(result.detections)
      ? result.detections
      : null;

  if (predictions) {
    let bestConfidence = 0;
    for (const p of predictions) {
      const rec = asRecord(p);
      if (!rec) continue;
      const cls = rec.class;
      const label = typeof cls === "string" ? cls.toLowerCase() : "";
      const conf = firstNumber(rec.confidence, rec.score, rec.probability) ?? 0;
      if (
        label.includes("violence") ||
        label.includes("fight") ||
        label.includes("assault")
      ) {
        bestConfidence = Math.max(bestConfidence, conf);
      }
    }
    return {
      violenceDetected: bestConfidence > 0,
      confidence: bestConfidence > 0 ? bestConfidence : null,
    };
  }

  const nestedResult = asRecord(result.result);
  if (nestedResult) return inferViolence(nestedResult);

  return { violenceDetected: false, confidence: null };
}

export async function runRoboflowDetection(
  input: RoboflowDetectInput,
): Promise<RoboflowDetectionResult> {
  const workflowUrl = process.env.ROBOFLOW_WORKFLOW_URL;
  const apiKey = process.env.ROBOFLOW_API_KEY;

  if (!workflowUrl || !apiKey) {
    throw new Error("Missing ROBOFLOW_WORKFLOW_URL or ROBOFLOW_API_KEY");
  }

  const payload: Record<string, unknown> = {
    session_id: input.sessionId,
    source_type: input.sourceType,
    stream_url: input.streamUrl,
    image_base64: input.imageBase64,
    video_base64: input.videoBase64,
    mime_type: input.mimeType,
  };

  const res = await fetch(workflowUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const json = (await res.json().catch(() => null)) as unknown;
  if (!res.ok) {
    const errorMessage =
      (asRecord(json)?.error as string | undefined) ??
      `Roboflow request failed (${res.status})`;
    throw new Error(errorMessage);
  }

  const body = asRecord(json) ?? {};
  const normalized = inferViolence(body);
  return {
    violenceDetected: normalized.violenceDetected,
    confidence: normalized.confidence,
    raw: body,
  };
}
