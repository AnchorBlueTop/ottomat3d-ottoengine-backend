import { ReactNode } from 'react';
import { Content, ContentVariants, Masthead, PageSection } from '@patternfly/react-core';
import { Navbar } from './Navbar';
import { PageHeader } from './Page-Header';
import { Outlet, useLocation } from 'react-router-dom';

interface LayoutProps {
    // Keeping type for backward compatibility if imported elsewhere
    children?: ReactNode;
}

export function Layout(_props: LayoutProps) {
    const location = useLocation();
    const path = location.pathname.replace(/\/$/, '');

    const title = (() => {
        switch (true) {
            case path === '' || path === '/':
            case path === '/dashboard':
                return 'Dashboard';
            case path.startsWith('/jobs'):
                return 'Print Jobs';
            case path.startsWith('/printers'):
                return 'Printers';
            case path.startsWith('/eject'):
                return 'OTTOeject';
            case path.startsWith('/rack'):
                return 'OTTOrack';
            default:
                return 'Dashboard';
        }
    })();

    return (
        <div className="pf-custom-layout">
            <aside className="pf-custom-sidebar">
                {/* Sidebar starts at the very top */}
                <Navbar />
            </aside>

            <main className="pf-custom-main-area">
                {/* Header and content start to the right of the navbar */}
                <PageHeader />
                <PageSection className="pf-custom-dashboard">{
                    <>
                        <Masthead className='Main-header'>
                            <Content content={ContentVariants.h2}>
                                {title}
                            </Content>
                        </Masthead>
                        <Outlet />
                    </>
                }</PageSection>
            </main>
        </div>
    )
};