import { verifyToken } from '@clerk/backend';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { CBAC_INTERVIEW_QUESTIONS } from '../src/intelligence/cbacInterviewQuestions';
import { interpretWithGroq } from '../server/interpretation';
const requests = new Map<string, { at: number; count: number }>();
export default async function handler(req: IncomingMessage & { body?: unknown }, res: ServerResponse) {
  const send = (status: number, data: unknown) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store'); res.end(JSON.stringify(data)); };
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return send(405, { error: 'POST required' }); }
  if (!process.env.CLERK_SECRET_KEY || !process.env.GROQ_API_KEY) return send(503, { error: 'AI interpretation is not configured' });
  const bearer = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
  if (!bearer) return send(401, { error: 'Sign in required' });
  let userId: string;
  try {
    const token = await verifyToken(bearer, { secretKey: process.env.CLERK_SECRET_KEY });
    if (!token.sub || !token.sid) return send(401, { error: 'Session required' });
    userId = token.sub;
  } catch { return send(401, { error: 'Invalid session' }); }
  const now = Date.now();
  for (const [id, entry] of requests) if (now - entry.at > 60000) requests.delete(id);
  const entry = requests.get(userId) || { at: now, count: 0 };
  if (++entry.count > 30) { res.setHeader('Retry-After', '60'); return send(429, { error: 'Please wait before retrying' }); }
  requests.set(userId, entry);
  let body: unknown;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; } catch { return send(400, { error: 'Invalid JSON' }); }
  if (!body || typeof body !== 'object') return send(400, { error: 'Invalid request' });
  const { questionId, answer } = body as Record<string, unknown>;
  if (typeof questionId !== 'string' || !CBAC_INTERVIEW_QUESTIONS.some(q => q.id === questionId) || ['name', 'age'].includes(questionId) || typeof answer !== 'string' || !answer.trim() || answer.length > 1000) return send(400, { error: 'Invalid answer' });
  try { return send(200, await interpretWithGroq(questionId, answer.trim(), process.env.GROQ_API_KEY, process.env.GROQ_MODEL || 'qwen/qwen3.8-27b')); }
  catch { return send(502, { error: 'AI interpretation unavailable; use a quick answer' }); }
}
