import { 
    Brand, 
    Button, 
    Card, 
    CardHeader, 
    Content, 
    ContentVariants, 
    Form, 
    FormGroup, 
    Grid, 
    GridItem,
    Modal, 
    ModalFooter, 
    ModalHeader, 
    PageSection, 
    TextInput, 
    TextInputGroup, 
    TextInputGroupMain 
} from "@patternfly/react-core";
import { Component, useContext, useEffect, useState } from "react";
import { JobContext } from "../App.tsx";
import uploadBox from './public/box_icon.png';
import thumbnail from '../public/thumbnail.png';
import { PrinterRepresentation } from "../representations/printerRepresentation.ts";
import { deletePrinter } from "../ottoengine_API.ts";
import { OttoejectDevice } from "../representations/ottoejectRepresentation.ts";
// import { moonraker } from "./listAPI";

export default function editOttoeject() {
    const { ottoeject, setOttoeject, setIsOttoejectEditModalOpen, ottoejectEditModalOpen, ottoejectIndex } = useContext(JobContext);
    const [refresh, setRefresh] = useState(false);
    const [tempOttoeject, setTempOttoeject] = useState<OttoejectDevice|undefined>();

    const editOttoejectSave = () => {
        if (tempOttoeject) {
            ottoeject[ottoejectIndex!] = tempOttoeject;
        }
        setOttoeject(ottoeject);
    }

    const deleteOttoeject = (id?: any) => {
        // deleteOttoeject(id);
        delete ottoeject[ottoejectIndex!];

    }
 

    useEffect(()=>{
        if(ottoejectIndex || ottoejectIndex == 0){
            setTempOttoeject(ottoeject[ottoejectIndex]);
        }
    },[ottoejectEditModalOpen]);

    return (
            <Modal
                isOpen={ottoejectEditModalOpen}
                className="pf-custom-new-ottoeject-modal"
                aria-label="newOttoeject"
            >

            <PageSection className="pf-custom-new-ottoeject">
                <ModalHeader className="pf-custom-upload-header">
                    <Content component={ContentVariants.h3}>
                        {/* <Brand src={uploadBox} alt="Upload logo" className='pf-custom-upload-icon'/> */}
                        {'EDIT ottoeject'}</Content>
                </ModalHeader>
                {/* <PageSection className='pf-custom-align-center-vertically'> */}
                    <Grid hasGutter>
                    
                        

                        <GridItem span={8} height={'max-content'}>
                            <Form isHorizontal className="pf-custom-text-align-left">
                                
                                
                                <Grid>
                                    <GridItem span={3}>
                                        <Content>{'NAME:'}</Content>
                                    </GridItem>
                                    <GridItem span={8}>
                                            <TextInput
                                                id='ottoeject-name'
                                                
                                                value={tempOttoeject?.device_name}
                                                onChange={(_event, value:any) => setTempOttoeject({...tempOttoeject, device_name:value})}
                                            

                                                frameBorder={'none'}
                                                
                                            />
                                    </GridItem>
                                </Grid>
                                <Grid>
                                    <Content>{'CONNECTION:'}</Content>
                                    <GridItem span={3}>
                                        <Content>{'IP ADDRESS:'}</Content>
                                    </GridItem>
                                    <GridItem span={8}>
                                        <TextInputGroup>
                                            <TextInputGroupMain id='ottoeject-connection-ipaddress' value={tempOttoeject?.ip_address} onChange={(_event, value:any) => setTempOttoeject({...tempOttoeject, ip_address:value})} />


                                        </TextInputGroup>
                                    </GridItem>
                                </Grid>
                            </Form>
                        </GridItem>

                        <GridItem span={4}>
                            <FormGroup>
                                <Content component={ContentVariants.h6}>{'THUMBNAIL'}</Content>
                                <Brand src={thumbnail} alt={"ottoeject thumbnail"} style={{width: '100%'}} />
                                {<Content className="pf-custom-align-center"><strong>{tempOttoeject?.status}</strong></Content>}
                            </FormGroup>
                        </GridItem>
                    
                    </Grid>

                {/* </PageSection> */}


                <ModalFooter className="pf-custom-new-ottoeject-modal-footer">
                    <Button
                        variant="secondary"
                        onClick={() => {setIsOttoejectEditModalOpen(false)}}
                    >
                        {'Cancel'}
                    </Button>
                    <Button 
                        className="pf-custom-button"
                        onClick={() => {
                            editOttoejectSave();
                            setIsOttoejectEditModalOpen(false)
                            setTempOttoeject({});
                        }}
                    >
                        {'Save'}
                    </Button>
                    <Button
                        className="pf-custom-button"
                        variant="danger"
                        onClick={() => {
                            deleteOttoeject(ottoeject[ottoejectIndex!]);
                            setIsOttoejectEditModalOpen(false)
                            setTempOttoeject({});
                        }}
                    >
                        {'Delete'}
                    </Button>
                </ModalFooter>

            </PageSection>
            </Modal>
    )
    
}