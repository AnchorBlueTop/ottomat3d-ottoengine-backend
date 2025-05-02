import { Brand, Content, ContentVariants, Divider, Masthead } from '@patternfly/react-core';
import './App.css';
import fullLogoColour from './public/Ottomat3d Logo-Colour.png';

export function PageHeader() {
    return (
        <Masthead className='App-header'>
            <Content>
                <Content component={ContentVariants.h1}>
                    <Brand src={fullLogoColour} alt={"print job thumbnail"} style={{height:'2.5rem'}}/>
                </Content>
            </Content>
        </Masthead>
    )
}