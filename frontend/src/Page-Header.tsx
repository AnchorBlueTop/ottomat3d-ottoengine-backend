import { Masthead, Timestamp, TimestampFormat } from '@patternfly/react-core';
import './App.css';

export function PageHeader() {
    const currentDate = new Date();
    return (
        <Masthead className='App-header'>
            <div className="pf-header-timestamp">
                <Timestamp date={currentDate} dateFormat={TimestampFormat.full} />
            </div>
        </Masthead>
    )
}