import { Content, ContentVariants, Masthead } from '@patternfly/react-core';
import './App.css';

export function PageHeader() {
    return (
        <Masthead className='App-header'>
            
            <Content>
                <Content component={ContentVariants.h1}>
                    {'OTTOsolution'}
                </Content>
            </Content>
        </Masthead>
    )
}