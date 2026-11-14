import { createRequire } from 'node:module';
import { expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const requireAdmin = require('../src/middleware/requireAdmin');

it('passes an authenticated admin to the next middleware', () => {
    const next = vi.fn();
    requireAdmin({ user: { role: 'ADMIN' } }, {}, next);
    expect(next).toHaveBeenCalledOnce();
});

it.each([undefined, { role: 'USER' }])('rejects a non-admin session %j', (user) => {
    const response = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();
    requireAdmin({ user }, response, next);
    expect(response.status).toHaveBeenCalledWith(403);
    expect(response.json).toHaveBeenCalledWith({
        success: false,
        message: 'Admin access is required'
    });
    expect(next).not.toHaveBeenCalled();
});
