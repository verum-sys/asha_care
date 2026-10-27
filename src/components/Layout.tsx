import { backDestination } from './backNavigation';
import { type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { UserButton } from '@clerk/clerk-react';
import { useAuth } from '../auth/AuthContext';
import { useLang } from '../i18n';
import { homeForRole, ROLE_LABELS } from '../auth/access';
import { Icon } from './Icon';
import { StatusBar } from './StatusBar';
import { useConnectivity } from '../sync/connectivity';

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const { online } = useConnectivity();
  const { lang, setLang, t } = useLang();
  const location = useLocation();
  if (location.pathname === '/login') return <>{children}</>;
  return <div className="care-shell">
    <div className="care-workspace care-workspace-home">
      <header className="care-topbar"><div className="flex items-center gap-4"><Link to={homeForRole(user.role)} className="care-brand !mb-0"><span className="brand-mark">✚</span><span>Diag<span className="text-teal-600">NXT</span> CareLink</span></Link><span className="text-slate-400 text-sm hidden sm:inline">/ <span className="font-semibold text-ink">{t(ROLE_LABELS[user.role])} {t('workspace')}</span></span></div><div className="flex items-center gap-3">{!online && <Link to="/sync" className="hidden sm:inline text-xs font-semibold text-teal-700">{t('Sync')}</Link>}<button className="text-xs text-slate-500" onClick={() => setLang(lang === 'en' ? 'hi' : 'en')} aria-label={t('Change language')}>{t('lang.toggle')}</button><UserButton/><button onClick={logout} className="hidden sm:inline text-xs font-semibold text-teal-700">{t('Sign out')}</button></div></header>
      <StatusBar showSync/>
      <main className="care-main">{children}</main>
      <footer className="care-footer hidden sm:flex"><span>{t('DiagNXT CareLink · Connected care, from community to specialist')}</span><Link to={homeForRole(user.role)}>{t('Workspace overview →')}</Link></footer>
    </div>
    <nav className="mobile-tabbar" aria-label={t('Main navigation')}>
      <NavLink to={homeForRole(user.role)} end><Icon name="building" size={20}/><span>{t('Home')}</span></NavLink>
      {!online && <NavLink to="/sync"><Icon name="info" size={20}/><span>{t('Sync')}</span></NavLink>}
    </nav>
  </div>;
}
export function BackLink({ label }: { label?: string }) {
  const { t } = useLang();
  const navigate = useNavigate();
  return <Link to="/" onClick={event => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const target = backDestination(window.history.state);
    if (target === -1) { event.preventDefault(); navigate(-1); }
  }} className="mb-3 inline-flex min-h-[40px] items-center gap-1 text-sm font-semibold text-teal-700"><Icon name="back" size={18}/>{label ?? t('case.back')}</Link>;
}
