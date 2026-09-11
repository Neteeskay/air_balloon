import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { ApiError } from '../../../services/apiClient';
import { getAuthSession, setAuthSession } from '../../../services/authSession';
import { currentConfig, metadata } from '../../../test/fixtures';
import { buildCandidateRequest, toEditableConfig } from '../model/configModel';
import { adminApi } from './adminApi';
import { server } from '../../../test/server';

function authenticate() {
  setAuthSession({ accessToken: 'admin-token', tokenType: 'Bearer', expiresAt: '2099-01-01T00:00:00Z' });
}

function expectBearer(request: Request) {
  expect(request.headers.get('authorization')).toBe('Bearer admin-token');
}

describe('admin API integration with MSW', () => {
  it('logs in without Authorization header and logs out with Bearer token', async () => {
    server.use(
      http.post('http://localhost:8080/api/admin/auth/login', async ({ request }) => {
        expect(request.headers.get('authorization')).toBeNull();
        expect(await request.json()).toEqual({ username: 'admin', password: 'admin' });
        return HttpResponse.json({ accessToken: 'admin-token', tokenType: 'Bearer', expiresAt: '2099-01-01T00:00:00Z' });
      }),
      http.post('http://localhost:8080/api/admin/auth/logout', ({ request }) => {
        expect(request.headers.get('authorization')).toBe('Bearer admin-token');
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const session = await adminApi.login({ username: 'admin', password: 'admin' });
    setAuthSession(session);
    await expect(adminApi.logout()).resolves.toBeUndefined();
  });

  it('loads current config and metadata through the typed client', async () => {
    authenticate();
    server.use(
      http.get('http://localhost:8080/api/admin/config/current', ({ request }) => { expectBearer(request); return HttpResponse.json(currentConfig); }),
      http.get('http://localhost:8080/api/admin/config/metadata', ({ request }) => { expectBearer(request); return HttpResponse.json(metadata); }),
    );
    await expect(adminApi.currentConfig()).resolves.toMatchObject({ revision: 10, status: 'ACTIVE' });
    await expect(adminApi.metadata()).resolves.toMatchObject({ greenLevelCount: 9, redLevelCount: 12 });
  });

  it('validates, saves DRAFT and activates with the exact candidate body', async () => {
    authenticate();
    const editable = toEditableConfig(currentConfig);
    editable.points.pointsPerLine = '50';
    const candidate = buildCandidateRequest(editable, 10);
    const draft = { ...currentConfig, id: 'config-11', revision: 11, status: 'DRAFT' as const, baseRevision: 10, points: { ...currentConfig.points, pointsPerLine: 50 } };
    server.use(
      http.post('http://localhost:8080/api/admin/config/validate', async ({ request }) => {
        expectBearer(request);
        const body = await request.json();
        expect(body).toEqual(candidate);
        expect(body).not.toHaveProperty('id');
        return HttpResponse.json({ valid: true, warnings: [] });
      }),
      http.post('http://localhost:8080/api/admin/config', async ({ request }) => {
        expect(await request.json()).toEqual(candidate);
        return HttpResponse.json(draft, { status: 201 });
      }),
      http.post('http://localhost:8080/api/admin/config/config-11/activate', () => HttpResponse.json({ ...draft, status: 'ACTIVE' })),
    );
    await expect(adminApi.validate(candidate)).resolves.toEqual({ valid: true, warnings: [] });
    await expect(adminApi.createDraft(candidate)).resolves.toMatchObject({ revision: 11, status: 'DRAFT' });
    await expect(adminApi.activate('config-11')).resolves.toMatchObject({ revision: 11, status: 'ACTIVE' });
  });

  it('surfaces field validation errors and 409 currentVersion', async () => {
    authenticate();
    const candidate = buildCandidateRequest(toEditableConfig(currentConfig), 10);
    server.use(
      http.post('http://localhost:8080/api/admin/config/validate', () =>
        HttpResponse.json({ status: 400, code: 'CONFIG_VALIDATION_ERROR', fieldErrors: { 'points.pointsPerLine': 'must be positive' }, traceId: 't1' }, { status: 400 }),
      ),
      http.post('http://localhost:8080/api/admin/config', () =>
        HttpResponse.json({ status: 409, code: 'CONFIG_VERSION_CONFLICT', currentVersion: 11, fieldErrors: [], traceId: 't2' }, { status: 409 }),
      ),
    );
    await expect(adminApi.validate(candidate)).rejects.toMatchObject({ code: 'CONFIG_VALIDATION_ERROR', traceId: 't1' });
    await expect(adminApi.createDraft(candidate)).rejects.toMatchObject({ code: 'CONFIG_VERSION_CONFLICT', currentVersion: 11 });
  });

  it('supports paginated versions, detail, diff, rollback and audit filters', async () => {
    authenticate();
    server.use(
      http.get('http://localhost:8080/api/admin/config/versions', ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get('page')).toBe('1');
        expect(url.searchParams.get('size')).toBe('20');
        return HttpResponse.json({ content: [{ id: 'config-10', revision: 10, status: 'ACTIVE', createdAt: currentConfig.createdAt, createdBy: 'admin' }], page: 1, size: 20, totalElements: 21, totalPages: 2 });
      }),
      http.get('http://localhost:8080/api/admin/config/versions/config-10', () => HttpResponse.json(currentConfig)),
      http.get('http://localhost:8080/api/admin/config/versions/config-9/diff/config-10', () => HttpResponse.json({ fromVersionId: 'config-9', toVersionId: 'config-10', changes: [{ field: 'points.pointsPerLine', before: 9, after: 10 }] })),
      http.post('http://localhost:8080/api/admin/config/versions/config-9/rollback', () => HttpResponse.json({ ...currentConfig, id: 'config-11', revision: 11 }, { status: 201 })),
      http.get('http://localhost:8080/api/admin/audit', ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get('action')).toBe('CONFIG_ACTIVATED');
        expect(url.searchParams.get('administrator')).toBe('admin');
        return HttpResponse.json({ content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 });
      }),
    );
    await expect(adminApi.versions(1, 20)).resolves.toMatchObject({ page: 1, totalPages: 2 });
    await expect(adminApi.version('config-10')).resolves.toMatchObject({ id: 'config-10' });
    await expect(adminApi.diff('config-9', 'config-10')).resolves.toMatchObject({ changes: [{ field: 'points.pointsPerLine' }] });
    await expect(adminApi.rollback('config-9')).resolves.toMatchObject({ revision: 11 });
    await expect(adminApi.audit({ action: 'CONFIG_ACTIVATED', administrator: 'admin', page: 0, size: 20 })).resolves.toMatchObject({ content: [] });
  });

  it('clears session on 401 but not on 403', async () => {
    authenticate();
    server.use(http.get('http://localhost:8080/api/admin/config/current', () => HttpResponse.json({ status: 403, code: 'FORBIDDEN' }, { status: 403 })));
    await expect(adminApi.currentConfig()).rejects.toBeInstanceOf(ApiError);
    expect(getAuthSession()).not.toBeNull();

    server.use(http.get('http://localhost:8080/api/admin/config/current', () => HttpResponse.json({ status: 401, code: 'UNAUTHORIZED' }, { status: 401 })));
    await expect(adminApi.currentConfig()).rejects.toBeInstanceOf(ApiError);
    expect(getAuthSession()).toBeNull();
  });
});
