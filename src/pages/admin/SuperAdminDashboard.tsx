import { useLang } from '../../i18n';
import { Link } from 'react-router-dom';
import type { CareTier } from '../../db/types';
import { Icon } from '../../components/Icon';
const modules: { tier: CareTier; title: string; subtitle: string; icon: 'user' | 'building'; features: string[] }[] = [
  { tier: 'asha', title: 'ASHA', subtitle: 'Community screening', icon: 'user', features: ['CBAC form', 'Refer to PHC', 'AI summary'] },
  { tier: 'phc', title: 'Primary Health Centre', subtitle: 'Primary care & assessment', icon: 'building', features: ['Editable CBAC form', 'Physical examination notes', 'Reports · PDF', 'Refer to DH', 'AI summary'] },
  { tier: 'dh', title: 'District Hospital', subtitle: 'Specialist diagnostics', icon: 'building', features: ['Editable CBAC form', 'Physical examination notes', 'Reports · PDF', 'Biopsy & radiology · PDF', 'DH notes', 'Refer to TCC', 'AI summary'] },
  { tier: 'tcc', title: 'Tertiary Care Centre', subtitle: 'Advanced cancer care', icon: 'building', features: ['Editable CBAC form', 'Physical examination notes', 'Reports · PDF', 'Biopsy & radiology · PDF', 'TCC notes', 'AI summary'] },
];
export function SuperAdminDashboard() {
  const { t } = useLang();
  return (
    <section aria-label={t('Care modules')} className="compact-home">
      <div className="module-grid">{modules.map((module, i) => <article className={`module-card module-${module.tier}`} key={module.tier}><div className="module-heading"><span className="module-icon"><Icon name={module.icon} size={23}/></span><span className="text-[10px] font-semibold tracking-widest text-slate-400">{t('TIER')} 0{i + 1}</span></div><h3>{t(module.title)}</h3><p className="text-xs text-slate-500">{t(module.subtitle)}</p><ul>{module.features.map(feature => <li key={feature}><span>✓</span>{t(feature)}</li>)}</ul><Link className="module-open" to={`/tier/${module.tier}`}>{t('Open')} {module.tier.toUpperCase()} {t('module')} <span>→</span></Link></article>)}</div>
    </section>
  );
}
