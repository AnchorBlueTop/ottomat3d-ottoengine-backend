import { ReactNode } from 'react';
import { Content, ContentVariants, Grid, GridItem, Masthead, PageSection } from '@patternfly/react-core';
import { Navbar } from './Navbar';
import { Printers } from './components/Printers';
import { PageHeader } from './Page-Header';
import Dashboard from './components/Dashboard';
import { Job } from './components/Jobs';
import { Ottoeject } from './components/OttoEject';
import { Ottorack } from './components/OttoRack';
interface LayoutProps {
    children: ReactNode;
    activeTab: string;
    setActiveTab: (tab: string) => void;
}

export function Layout({
    activeTab,
    setActiveTab
}: LayoutProps) {
    const renderContent = () => {
        switch (activeTab) {
            case 'jobs':
                return <Job />
            //   return selectedJob ? <JobDetails job={selectedJob} /> : <QueueManagement onSelectJob={setSelectedJob} />;
            // return <QueueManagement/>
            case 'printers':
                return <Printers />;
            case 'eject':
                return <Ottoeject />;
            case 'rack':
                return <Ottorack />;
            default:
                return <Dashboard />;
        }
    };
    return (
        <Grid>
            <GridItem span={2}>
                {/* Sidebar */}
                <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />
            </GridItem>
            <GridItem span={10}>
                {/* Main content */}
                <PageHeader />
                <PageSection className="pf-custom-dashboard">{
                    <>
                        <Masthead className='Main-header'>
                            <Content content={ContentVariants.h2}>
                                {activeTab === 'dashboard' && 'Dashboard'}
                                {activeTab === 'jobs' && ("Print Jobs")}
                                {activeTab === 'printers' && 'Printers'}
                                {activeTab === 'eject' && 'OTTOeject'}
                                {activeTab === 'rack' && 'OTTOrack'}
                            </Content>
                        </Masthead>
                        {renderContent()}
                    </>
                }</PageSection>
            </GridItem>
        </Grid>
    )
};