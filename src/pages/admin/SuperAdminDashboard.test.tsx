import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { SuperAdminDashboard } from './SuperAdminDashboard';

describe('super admin home', () => {
  it('contains only the four care cards', () => {
    const html = renderToStaticMarkup(<MemoryRouter><SuperAdminDashboard /></MemoryRouter>);
    expect(html.match(/<a [^>]*class="module-card /g)).toHaveLength(4); // each whole card is the link
    expect(html).not.toContain('<article');
    expect(html).not.toContain('module-open'); // no separate "open" bar at the bottom
    for (const tier of ['asha', 'phc', 'dh', 'tcc']) expect(html).toContain(`href="/tier/${tier}"`);
    expect(html).not.toContain('Add new CBAC form');
    expect(html).not.toContain('Unit A');
    expect(html).not.toContain('Unit B');
    expect(html).not.toContain('Unit C');
    expect(html).not.toContain('?unit=');
    for (const tier of ['asha', 'phc', 'dh', 'tcc']) expect(html).toContain(`module-${tier}`);
    for (const removed of ['NETWORK OVERVIEW', 'A connected view of care', 'Registered patients', 'Priority cases', 'Diagnostic reports', 'Patient registry', 'Filter facility units']) expect(html).not.toContain(removed);
  });
});
