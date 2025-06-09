import { Brand, Content, ContentVariants, Divider, Masthead, PageSection, Timestamp, TimestampFormat } from '@patternfly/react-core';
import './App.css';
import fullLogoWhite from './public/Ottomat3d Logo-White.png';

export function PageHeader() {
    const currentDate = new Date();
    return (
        <Masthead className='App-header'>
            <Timestamp date={currentDate} dateFormat={TimestampFormat.full} />
        </Masthead>
    )
}