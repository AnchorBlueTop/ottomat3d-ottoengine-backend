import { Brand, Button, Card, CardHeader, Content, ContentVariants, Form, FormGroup, Grid, GridItem, Modal, PageSection } from "@patternfly/react-core";
import { Component, useContext } from "react";
import { JobContext } from "./App";
import uploadBox from './public/box_icon.png';
import thumbnail from './public/thumbnail.png';
import { moonraker } from "./listAPI";

export default function newPrintJob () {
    const { printer, currentFiles, printTaskModalOpen, setIsPrintTaskModalOpen } = useContext(JobContext);


    // const sendFileToPrinter = () => {
    //     new moonraker().uploadFile(
    //         "http://pi33.local",
    //         currentFiles[0]
    //     ).then((element: any) => {
    //         console.log(element);

    //     }).catch(() => {
    //         console.log('error with - uploadingFile');
            
    //     })
    // };

    return (
            // <Modal
            //     isOpen={printTaskModalOpen}
            //     className=""
            //     aria-label="newPrintJob"
            // >

            // </Modal>
            <>
            {printTaskModalOpen ? 
            <PageSection className="pf-custom-new-print-job">
                <Grid hasGutter>
                <CardHeader className='pf-custom-upload-header'>
                    <Content component={ContentVariants.h3}>
                    <Brand src={uploadBox} alt="Upload logo" className='pf-custom-upload-icon'/>
                    {' NEW PRINT JOB'}</Content>
                </CardHeader>
                    <GridItem span={8}>
                        <PageSection>
                        <Form isHorizontal className="pf-custom-text-align-left">
                            
                            <Content component={ContentVariants.h6}>{'DETAILS'}</Content>
                    
                            <Content>{'ID: '+ ' ~id test~'}</Content>
                        
                            <Content>{'STATUS: '+ printer?.result?.state_message}</Content>
                    
                            <Content>{'PRINTER: '+ printer?.result?.hostname}</Content>
                
                            <Content>{'STORAGE LOCATION: '+ ' ~Sortage test~'}</Content>
                    
                            <Content>{'MATERIAL: '+ ' ~Material test~'}</Content>
                    
                            <Content>{'MATERIAL REQUIRED: '+ ' ~Material Required test~'}</Content>
                        
                            <Content>{'DURATION: '+ ' ~Duration test~'}</Content>
                           
                        </Form>
                        </PageSection>
                    </GridItem>

                    <GridItem span={4}>
                        <PageSection>
                        <FormGroup>
                            <Content component={ContentVariants.h6}>{'THUMBNAIL'}</Content>
                            <Brand src={thumbnail} alt={"print job thumbnail"} style={{width: '100%'}} />
                        </FormGroup>
                        </PageSection>
                    </GridItem>

                    <GridItem span={12}>
                        {/* <FormGroup> */}
                            <Card frameBorder={'solid'} className="pf-custom-print-detail-footer">
                                
                                <Content className="pf-custom-text-align-left" component={ContentVariants.h6}>{'FILE'}</Content>
                                <Content >{currentFiles[0].fileName}</Content>
                            </Card>
                        {/* </FormGroup> */}
                    </GridItem>
                
                </Grid>

                <Button 
                    isDisabled={currentFiles.length==0}
                    className="pf-custom-button"
                    // onClick={() => sendFileToPrinter()}
                    onClick={() => {setIsPrintTaskModalOpen(false)}}
                >
                    {'Send File'}
                </Button>
                
                

                

            </PageSection> : ''}
            </>
    )
    
}