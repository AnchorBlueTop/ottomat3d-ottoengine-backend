import { Brand, Nav, NavList, PageSection } from '@patternfly/react-core';
import { NavLink } from 'react-router-dom';
import logoWhite from './public/Ottomat3d Logomark - White.png';
import PrintJobIcon from './public/PrintJob-Icon.svg';
import PrinterIcon from './public/printer-Icon.svg'
import OttoEjectIcon from './public/ottoEject-Icon.svg'
import DashboardIcon from './public/dashboard-icon.png';
import OttoRackIcon from './public/ottorack-icon.png';

export function Navbar() {
    const menuItems = [
        { id: 'dashboard', label: 'Dashboard', to: '/dashboard', icon: DashboardIcon },
        { id: 'jobs', label: 'Print Jobs', to: '/jobs', icon: PrintJobIcon },
        { id: 'printers', label: 'Printers', to: '/printers', icon: PrinterIcon },
        { id: 'eject', label: 'OTTOeject', to: '/eject', icon: OttoEjectIcon },
        { id: 'rack', label: 'OTTOrack', to: '/rack', icon: OttoRackIcon },
    ];

    return (
        <PageSection className='pf-custom-navbar'>
            <Brand src={logoWhite} alt={'print job thumbnail'} style={{ paddingTop: '1rem', width: '5rem' }} />
            <Nav>
                <NavList>
                    {menuItems.map(item => (
                        <li key={item.id}>
                            <NavLink
                                to={item.to}
                                className={({ isActive }) => isActive ? 'pf-c-navbar-button-active' : 'pf-c-navbar-button'}
                                onMouseEnter={() => {
                                    if (item.id === 'jobs') { void import('./components/Jobs'); }
                                    if (item.id === 'printers') { void import('./components/Printers'); }
                                    if (item.id === 'eject') { void import('./components/OttoEject'); }
                                    if (item.id === 'rack') { void import('./components/OttoRack'); }
                                }}
                            >
                                {item.icon && <img src={item.icon} alt={`${item.label} icon`} className="pf-custom-nav-icon" />}
                                <span className="font-weight-normal">{item.label}</span>
                            </NavLink>
                        </li>
                    ))}
                </NavList>
            </Nav>
        </PageSection>
    );
}

