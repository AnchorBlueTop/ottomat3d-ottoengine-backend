import { Brand, Button, Content, ContentVariants, Nav, NavList, PageSection } from '@patternfly/react-core';
import logoWhite from './public/Ottomat3d Logomark - White.png';
import PrintJobIcon from './public/PrintJob-Icon.svg';
import PrinterIcon from './public/printer-Icon.svg'
import OttoEjectIcon from './public/ottoEject-Icon.svg'
interface NavbarProps {
    activeTab: string;
    setActiveTab: (tab: string) => void;
}
export function Navbar({
    activeTab,
    setActiveTab
}: NavbarProps) {
    const menuItems = [{
        id: 'dashboard',
        label: 'Dashboard',
        // icon: HomeIcon
    }, {
        id: 'jobs',
        label: 'Print Jobs',
        icon: PrintJobIcon
    }, {
        id: 'printers',
        label: 'Printers',
        icon: PrinterIcon
    }, {
        id: 'eject',
        label: 'OTTOeject',
        icon: OttoEjectIcon
    }, {
        id: 'rack',
        label: 'OTTOrack',
        // icon: SettingsIcon
    }];

    return <PageSection className='pf-custom-navbar'>
        {/* <div className="mb-8"> */}
        {/* <h1 className="text-xl font-bold text-center py-4">3D Print Manager</h1> */}
        {/* </div> */}
        <Brand src={logoWhite} alt={"print job thumbnail"} style={{ paddingTop: '1rem', width: '5rem' }} />
        <Nav>
            <NavList>
                {menuItems.map(item => <li key={item.id} >
                    <Button onClick={() => setActiveTab(item.id)}
                        className={activeTab === item.id ? 'pf-c-navbar-button-active' : 'pf-c-navbar-button'}
                    >
                        {/* <item.icon className="mr-3 h-5 w-5" /> */}
                        {/* <Brand src={item.icon} alt={item.label} className='pf-custom-nav-icon'/> */}
                        <Content className={activeTab === item.id ? 'pf-c-navbar-button-active' : 'pf-c-navbar-button'} content={ContentVariants.h2}>{item.label}</Content>
                    </Button>
                </li>)}
            </NavList>
        </Nav>
    </PageSection>;
}

