import { backDestination } from './backNavigation';
import { type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { UserButton } from '@clerk/clerk-react';
import { useAuth } from '../auth/AuthContext';
import { useLang } from '../i18n';
import { homeForRole, ROLE_LABELS } from '../auth/access';
import { Icon } from './Icon';
import { StatusBar } from './StatusBar';

export function Layout({ children }: { children: ReactNode }) {
  const { user, isSuperAdmin, logout } = useAuth();
  const { lang, setLang, t } = useLang();
  const location = useLocation();
  if (location.pathname === '/login') return <>{children}</>;
  const tiers = [ ['asha', 'ASHA', 'Community screening'], ['phc', 'PHC', 'Primary health centre'], ['dh', 'District Hospital', 'Specialist diagnostics'], ['tcc', 'TCC', 'Tertiary cancer care'] ];
  const isHome = isSuperAdmin && location.pathname === '/';
  const cbacUrl = `/cbac?tier=asha&unit=${user.unit}`;
  return <div className="care-shell">
    {!isHome && <aside className="care-sidebar">
      <Link to={homeForRole(user.role)} className="care-brand"><span className="brand-mark">✚</span><span>Diag<span className="text-teal-600">NXT</span><small>CONNECTED CARE</small></span></Link>
      <div className="sidebar-label">WORKSPACE</div>
      <nav className="care-nav" aria-label="Main navigation">
        {!isSuperAdmin && <NavLink to="/workspace"><Icon name="building" size={18}/><span>My workspace</span></NavLink>}
        {isSuperAdmin && <NavLink to="/" end><Icon name="spark" size={18}/><span>Overview</span></NavLink>}
        {isSuperAdmin && <div className="sidebar-label">CARE NETWORK</div>}
        {tiers.filter(() => isSuperAdmin).map(([key, name, desc]) => <NavLink key={key} to={`/tier/${key}`}><Icon name={key === 'asha' ? 'user' : 'building'} size={18}/><span>{name}<small>{desc}</small></span></NavLink>)}
        <div className="sidebar-label">PATIENT CARE</div>
        {isSuperAdmin && <NavLink to={cbacUrl}><Icon name="check" size={18}/><span>New CBAC form</span></NavLink>}
        <NavLink to="/cases"><Icon name="user" size={18}/><span>Patient registry</span></NavLink>
        <NavLink to="/sync"><Icon name="info" size={18}/><span>Sync & connectivity</span></NavLink>
      </nav>
      <div className="sidebar-bottom"><div className="network-status"><i/> {ROLE_LABELS[user.role]} workspace</div>{isSuperAdmin && <div className="text-xs text-slate-500 mt-2">ASHA → PHC → DH → TCC</div>}</div>
    </aside>}
    <div className={`care-workspace ${isHome ? 'care-workspace-home' : ''}`}>
      <header className="care-topbar"><div><span className="text-slate-400 text-sm">CareLink / </span><span className="text-sm font-semibold">{ROLE_LABELS[user.role]} workspace</span></div><div className="flex items-center gap-3"><button className="text-xs text-slate-500" onClick={() => setLang(lang === 'en' ? 'hi' : 'en')} aria-label="Change language">{t('lang.toggle')}</button><UserButton/><button onClick={logout} className="text-xs font-semibold text-teal-700">Sign out</button></div></header>
      <StatusBar showSync/>
      <main className="care-main">{children}</main>
      <footer className="care-footer"><span>DiagNXT CareLink · Connected care, from community to specialist</span><Link to={homeForRole(user.role)}>Workspace overview →</Link></footer>
    </div>
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
