import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { SuperAdminDashboard } from './SuperAdminDashboard';

describe('super admin home', () => {
  it('contains only the four care cards', () => {
    const html = renderToStaticMarkup(<MemoryRouter><SuperAdminDashboard /></MemoryRouter>);
    expect(html.match(/<article /g)).toHaveLength(4);
    for (const tier of ['asha', 'phc', 'dh', 'tcc']) expect(html).toContain(`module-${tier}`);
    for (const removed of ['NETWORK OVERVIEW', 'A connected view of care', 'Registered patients', 'Priority cases', 'Diagnostic reports', 'Patient registry', 'Filter facility units']) expect(html).not.toContain(removed);
  });
});
