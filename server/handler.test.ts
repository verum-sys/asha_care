import { beforeEach, describe, expect, it, vi } from 'vitest';
import handler from '../api/interpret-answer';
import { verifyToken } from '@clerk/backend';
vi.mock('@clerk/backend', () => ({ verifyToken: vi.fn(async () => ({ sub: 'user_test', sid: 'session_test' })) }));
vi.mock('../server/interpretation', () => ({ interpretWithGroq: vi.fn(async () => ({ normalizedAnswer: 'Socially', confidence: 0.95, needsClarification: false, explanation: '' })) }));
vi.mock('../server/clinicalNotes', () => ({ generateClinicalNotes: vi.fn(async () => 'Screening notes. Draft for worker review.') }));
function response() { return { statusCode: 0, setHeader: vi.fn(), end: vi.fn() }; }
beforeEach(() => { vi.stubEnv('CLERK_SECRET_KEY', 'test'); vi.stubEnv('GROQ_API_KEY', 'test'); vi.mocked(verifyToken).mockResolvedValue({ sub: 'user_test', sid: 'session_test' } as never); });
describe('authenticated answer API', () => {
  it('rejects unauthenticated requests', async () => {
    const res = response(); await handler({ method: 'POST', headers: {} } as never, res as never);
    expect(res.statusCode).toBe(401);
  });
  it('rejects invalid sessions', async () => {
    vi.mocked(verifyToken).mockRejectedValueOnce(new Error('invalid'));
    const res = response(); await handler({ method: 'POST', headers: { authorization: 'Bearer fake' } } as never, res as never);
    expect(res.statusCode).toBe(401);
  });
  it('rejects oversized answers', async () => {
    const res = response(); await handler({ method: 'POST', headers: { authorization: 'Bearer fake' }, body: { questionId: 'alcohol', answer: 'x'.repeat(1001) } } as never, res as never);
    expect(res.statusCode).toBe(400);
  });
  it('returns interpretation only to a valid session', async () => {
    const res = response(); await handler({ method: 'POST', headers: { authorization: 'Bearer fake' }, body: { questionId: 'alcohol', answer: 'At weddings' } } as never, res as never);
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.end.mock.calls[0][0]).normalizedAnswer).toBe('Socially');
  });
});

describe('authenticated clinical notes API', () => {
  it('requires authentication before generating notes', async () => {
    const res = response();
    await handler({ method: 'POST', headers: {}, body: { task: 'clinical-notes', context: 'Risk score 5/12' } } as never, res as never);
    expect(res.statusCode).toBe(401);
  });
  it('returns a draft for authenticated requests', async () => {
    const res = response();
    await handler({ method: 'POST', headers: { authorization: 'Bearer fake' }, body: { task: 'clinical-notes', context: 'Risk score 5/12' } } as never, res as never);
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.end.mock.calls[0][0]).notes).toContain('Draft for worker review');
  });
  it('rejects oversized note context', async () => {
    const res = response();
    await handler({ method: 'POST', headers: { authorization: 'Bearer fake' }, body: { task: 'clinical-notes', context: 'x'.repeat(3501) } } as never, res as never);
    expect(res.statusCode).toBe(400);
  });
});
