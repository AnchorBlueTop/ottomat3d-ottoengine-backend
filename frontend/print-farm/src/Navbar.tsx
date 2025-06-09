// import { useState } from 'react';
// import {
//   Page,
//   Masthead,
//   MastheadMain,
//   MastheadToggle,
//   MastheadBrand,
//   MastheadLogo,
//   MastheadContent,
//   PageSidebar,
//   PageSidebarBody,
//   PageSection,
//   PageToggleButton,
//   Toolbar,
//   ToolbarContent,
//   ToolbarItem
// } from '@patternfly/react-core';
// import BarsIcon from '@patternfly/react-icons/dist/esm/icons/bars-icon';

// export const PageMultipleSidebarBody: React.FunctionComponent = () => {
//   const [isSidebarOpen, setIsSidebarOpen] = useState(true);

//   const onSidebarToggle = () => {
//     setIsSidebarOpen(!isSidebarOpen);
//   };

//   const headerToolbar = (
//     <Toolbar id="multiple-sidebar-body-toolbar">
//       <ToolbarContent>
//         <ToolbarItem>header-tools</ToolbarItem>
//       </ToolbarContent>
//     </Toolbar>
//   );

//   const masthead = (
//     <Masthead>
//       <MastheadMain>
//         <MastheadToggle>
//           <PageToggleButton
//             variant="plain"
//             aria-label="Global navigation"
//             isSidebarOpen={isSidebarOpen}
//             onSidebarToggle={onSidebarToggle}
//             id="multiple-sidebar-body-nav-toggle"
//           >
//             <BarsIcon />
//           </PageToggleButton>
//         </MastheadToggle>
//         <MastheadBrand>
//           <MastheadLogo href="https://patternfly.org" target="_blank">
//             Logo
//           </MastheadLogo>
//         </MastheadBrand>
//       </MastheadMain>
//       <MastheadContent>{headerToolbar}</MastheadContent>
//     </Masthead>
//   );

//   const sidebar = (
//     <PageSidebar isSidebarOpen={isSidebarOpen} id="multiple-sidebar-body-sidebar">
//       <PageSidebarBody isContextSelector>
//         First sidebar body (for a context selector/perspective switcher)
//       </PageSidebarBody>
//       <PageSidebarBody usePageInsets>Second sidebar body (with insets)</PageSidebarBody>
//       <PageSidebarBody isFilled={true}>Third sidebar body (with fill)</PageSidebarBody>
//       <PageSidebarBody isFilled={false} usePageInsets>
//         Fourth sidebar body (with insets and no fill)
//       </PageSidebarBody>
//     </PageSidebar>
//   );

//   return (
//     <Page masthead={masthead} sidebar={sidebar}>
//       <PageSection>Section 1</PageSection>
//       <PageSection>Section 2</PageSection>
//       <PageSection>Section 3</PageSection>
//     </Page>
//   );
// };



import { Brand, Button, Content, ContentVariants, Nav, NavList, PageSection } from '@patternfly/react-core';
import fullLogoWhite from './public/Ottomat3d Logo-White.png';
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
        <Brand src={logoWhite} alt={"print job thumbnail"} style={{paddingTop:'1rem', width:'5rem'}}/>
        <Nav>
            <NavList>
                {menuItems.map(item => <li key={item.id} >
                    <Button onClick={() => setActiveTab(item.id)}
                        // className={
                        //     `flex items-center w-full p-3 rounded-md transition-colors 
                        //         ${activeTab === item.id ?
                        //         'bg-blue-600' :
                        //         'hover:bg-gray-700'}`}
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

