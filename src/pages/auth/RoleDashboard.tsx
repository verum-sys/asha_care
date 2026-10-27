import { useLang } from '../../i18n';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { ROLE_LABELS } from '../../auth/access';
export function RoleDashboard() {
  const { t } = useLang();
  const { user } = useAuth();
  return <div className="space-y-6"><div><span className="eyebrow">{t('CLINICAL PORTAL')}</span><h1 className="text-3xl font-semibold mt-2">{t(ROLE_LABELS[user.role])} {t('workspace')}</h1><p className="text-sm text-slate-500 mt-2">{t('Welcome,')} {user.name}{t('. View patient records and referral activity for Unit')} {user.unit.toUpperCase()}.</p></div><div className="grid gap-5"><Link className="registry-panel block" to="/facility"><h2 className="font-semibold">{t('Referral inbox →')}</h2><p className="text-sm text-slate-500 mt-2">{t('Review incoming referrals and care updates.')}</p></Link></div></div>;
}
