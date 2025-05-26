import { Brand, Content, ContentVariants, Divider, Masthead, PageSection, Timestamp, TimestampFormat } from '@patternfly/react-core';
import './App.css';
import fullLogoWhite from './public/Ottomat3d Logo-White.png';

export function PageHeader() {
    const currentDate = new Date();
    return (
        <Masthead className='App-header'>
            {/* <Content> */}
                {/* <Content component={ContentVariants.h1}> */}
                    {/* <Brand src={fullLogoWhite} alt={"print job thumbnail"} style={{height:'2.5rem'}}/> */}
                    <Timestamp date={currentDate} dateFormat={TimestampFormat.full} />
                {/* </Content> */}
            {/* </Content> */}
        </Masthead>
    )
}