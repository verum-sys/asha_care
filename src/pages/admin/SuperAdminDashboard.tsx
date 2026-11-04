import { useLang } from '../../i18n';
import { Link } from 'react-router-dom';
import type { CareTier } from '../../db/types';
import { Icon } from '../../components/Icon';
import { listCases } from '../../db/repo';
import { useLive } from '../../db/useLive';
import { exportReport } from '../../export/caseReport';
const modules: { tier: CareTier; title: string; subtitle: string; icon: 'user' | 'building'; features: string[] }[] = [
  { tier: 'asha', title: 'ASHA', subtitle: 'Community screening', icon: 'user', features: ['CBAC form', 'Refer to PHC', 'AI summary'] },
  { tier: 'phc', title: 'Primary Health Centre', subtitle: 'Primary care & assessment', icon: 'building', features: ['CBAC form', 'Physical examination notes', 'Reports · PDF', 'Refer to DH'] },
  { tier: 'dh', title: 'District Hospital', subtitle: 'Specialist diagnostics', icon: 'building', features: ['Referred and direct patients', 'Walk-in registration with PIN code', 'Physical examination notes', 'Biopsy & radiology · PDF', 'Refer to TCC or send back to ASHA'] },
  { tier: 'tcc', title: 'Tertiary Care Centre', subtitle: 'Advanced cancer care', icon: 'building', features: ['Treatment', 'Referred and direct patients', 'Walk-in registration with PIN code', 'Structured report overview', 'Next appointment back to PHC and ASHA'] },
];
export function SuperAdminDashboard() {
  const { t } = useLang();
  const { data: cases = [] } = useLive(listCases, []);
  return (
    <section aria-labelledby="modules-title" className="module-home">
      <header className="module-home-head">
        <span className="eyebrow">{t('CARE NETWORK')}</span>
        <h1 id="modules-title">{t('Choose a care module')}</h1>
        <p>{t('From community screening to specialist care, every step stays connected.')}</p>
        {/* Program manager tools: the whole network at a glance, and a full Excel report. */}
        <div className="mt-3 flex flex-wrap gap-2">
          <Link to="/analytics" className="btn btn-primary !min-h-[44px] text-sm font-bold"><Icon name="chart" size={16} /><span>{t('Program dashboard')}</span></Link>
          <button type="button" className="btn btn-secondary !min-h-[44px] text-sm font-bold" onClick={() => exportReport(cases, 'all')}><Icon name="download" size={16} /><span>{t('Export full report')}</span></button>
        </div>
      </header>
      <div className="module-grid">
        {modules.map((module, i) => (
          <Link key={module.tier} to={`/tier/${module.tier}`} className={`module-card module-${module.tier}`} aria-label={`${t(module.title)} — ${t('Open module')}`}>
            <div className="module-heading">
              <span className="module-icon"><Icon name={module.icon} size={26} /></span>
              <span className="module-step">{t('TIER')} 0{i + 1}</span>
            </div>
            <h2>{t(module.title)}</h2>
            <p className="module-sub">{t(module.subtitle)}</p>
            <ul>{module.features.map(feature => <li key={feature}><span aria-hidden="true">✓</span>{t(feature)}</li>)}</ul>
            <span className="module-arrow" aria-hidden="true"><Icon name="chevron" size={20} /></span>
          </Link>
        ))}
      </div>
    </section>
  );
}
