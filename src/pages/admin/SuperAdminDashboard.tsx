import { useLang } from '../../i18n';
import { Link } from 'react-router-dom';
import type { CareTier } from '../../db/types';
import { Icon } from '../../components/Icon';
const modules: { tier: CareTier; title: string; subtitle: string; icon: 'user' | 'building'; features: string[] }[] = [
  { tier: 'asha', title: 'ASHA', subtitle: 'Community screening', icon: 'user', features: ['CBAC form', 'Refer to PHC', 'AI summary'] },
  { tier: 'phc', title: 'Primary Health Centre', subtitle: 'Primary care & assessment', icon: 'building', features: ['CBAC form', 'Physical examination notes', 'Reports · PDF', 'Refer to DH'] },
  { tier: 'dh', title: 'District Hospital', subtitle: 'Specialist diagnostics', icon: 'building', features: ['CBAC form', 'Physical examination notes', 'Reports · PDF', 'Biopsy & radiology · PDF', 'DH notes', 'Refer to TCC'] },
  { tier: 'tcc', title: 'Tertiary Care Centre', subtitle: 'Advanced cancer care', icon: 'building', features: ['CBAC form', 'Physical examination notes', 'Reports · PDF', 'Biopsy & radiology · PDF', 'TCC notes'] },
];
export function SuperAdminDashboard() {
  const { t } = useLang();
  return (
    <section aria-labelledby="modules-title" className="module-home">
      <header className="module-home-head">
        <span className="eyebrow">{t('CARE NETWORK')}</span>
        <h1 id="modules-title">{t('Choose a care module')}</h1>
        <p>{t('From community screening to specialist care, every step stays connected.')}</p>
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
