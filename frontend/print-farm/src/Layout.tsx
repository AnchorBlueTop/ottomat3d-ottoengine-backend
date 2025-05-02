import React, { ReactNode, useState } from 'react';
import { QueueManagement } from './components/QueueManagement';
import { Brand, Content, ContentVariants, Divider, Grid, GridItem, Masthead, PageSection } from '@patternfly/react-core';
import { Navbar } from './Navbar';
import { Printers } from './components/Printers';
import { PageHeader } from './Page-Header';
import Dashboard from './components/Dashboard';
import fullLogoWhite from './public/Ottomat3d Logo-White.png';
// import { Job } from './Jobs';
// import { PrinterStatus } from './PrinterStatus';
// import { JobDetails } from './JobDetails';
// import { PrinterIcon, ListOrderedIcon, PlusCircleIcon, SettingsIcon, LayoutDashboardIcon } from 'lucide-react';

interface LayoutProps {
    children: ReactNode;
    activeTab: string;
    setActiveTab: (tab: string) => void;
}


export function Layout({
    children,
    activeTab,
    setActiveTab
}: LayoutProps) {
    // const [activeTab, setActiveTab] = useState('printers');
    const [selectedJob, setSelectedJob] = useState(null);
    const [selectedPrinter, setSelectedPrinter] = useState(null);
    const renderContent = () => {
        switch (activeTab) {
            case 'jobs':
            //   return selectedJob ? <JobDetails job={selectedJob} /> : <QueueManagement onSelectJob={setSelectedJob} />;
                return <QueueManagement/>
            case 'printers':
                return <Printers onSelectPrinter={setSelectedPrinter} />;
            case 'eject':
                return <></>;
            case 'rack':
                return <></>;
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
                <Divider />
                <PageSection className="pf-custom-dashboard">{
                    <>
                        <Masthead>
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