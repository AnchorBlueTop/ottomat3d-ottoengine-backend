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
// import { moonraker } from "./listAPI";

export default function editPrinter() {
    const { printer, setPrinter, setIsPrinterEditModalOpen, printerEditModalOpen, printerIndex } = useContext(JobContext);
    // const [ID_Value, setID_Value] = useState();
    // const [tempPrinter, setTempPrinter] = useState<printerRepresentation|undefined>(undefined);
    const [refresh, setRefresh] = useState(false);
    const [tempPrinter, setTempPrinter] = useState<PrinterRepresentation|undefined>();

    const editPrinterSave = () => {
        if (tempPrinter) {
            printer[printerIndex!] = tempPrinter;
        }
        setPrinter(printer);
    }

    const deletingPrinter = (id?: any) => {
        deletePrinter(id);
        delete printer[printerIndex!];
        setPrinter(printer)
        // printer.splice(printerIndex!, 1);


    }
 

    useEffect(()=>{
        if(printerIndex || printerIndex == 0){
            setTempPrinter(printer[printerIndex]);
        }
    },[printerEditModalOpen]);

    return (
            <Modal
                isOpen={printerEditModalOpen}
                className="pf-custom-new-printer-modal"
                aria-label="newPrinter"
            >

            {/* <> */}
            {/* {printTaskModalOpen ?  */}
            <PageSection className="pf-custom-new-printer">
                <ModalHeader className="pf-custom-upload-header">
                    <Content component={ContentVariants.h3}>
                        {/* <Brand src={uploadBox} alt="Upload logo" className='pf-custom-upload-icon'/> */}
                        {'EDIT PRINTER'}</Content>
                </ModalHeader>
                <Grid hasGutter>
                
                {/* <CardHeader className='pf-custom-upload-header'>
                    
                </CardHeader> */}

                    <GridItem span={8}>
                        {/* <PageSection> */}
                        <Form isHorizontal className="pf-custom-text-align-left">
                            
                            {/* <Content component={ContentVariants.h6}>{'DETAILS'}</Content> */}
                            
                            <Grid>
                                {/* <FormGroup fieldId="printer-name"> */}
                                <GridItem span={3}>
                                    <Content>{'NAME:'}</Content>
                                </GridItem>
                                <GridItem span={8}>
                                    {/* <TextInputGroup> */}
                                        <TextInput
                                            id='printer-name'
                                            // value={printer?.[0]?.name} 
                                            
                                            value={tempPrinter?.name}
                                            // value={tempPrinter?.name} 


                                            // onChange={(_event, value:any) => setPrinter({...printer, [0]:{name:value}})} 
                                            // onChange={(_event, value:any) => setTempPrinter({...tempPrinter, [0]:{name:value}})}
                                            onChange={(_event, value:any) => setTempPrinter({...tempPrinter, name:value})}
                                            // onChange={(_event, value:any) => tempPrinter.name == value }
                                         

                                            frameBorder={'none'}
                                            
                                        />
                                    {/* </TextInputGroup> */}
                                </GridItem>
                                {/* </FormGroup> */}
                            </Grid>
                        
                            {/* <Content>{'STATUS: '+ printer?.result?.state_message}</Content> */}
                            <Grid>
                                {/* <FormGroup fieldId="printer-printer"> */}
                                <GridItem span={3}>
                                    <Content>{'BRAND:'}</Content>
                                </GridItem>
                                <GridItem span={8}>
                                    <TextInputGroup>
                                        {/* <TextInputGroupMain value={printer?.[0]?.printer} onChange={(_event, value:any) => setPrinter({...printer, [0]:{printer:value}})} /> */}
                                        {/* <TextInputGroupMain id='printer-printer' value={tempPrinter[0]?.printer} onChange={(_event, value:any) => setTempPrinter({...tempPrinter, [0]:{printer:value}})} /> */}
                                        <TextInputGroupMain id='printer-printer' value={tempPrinter?.brand} onChange={(_event, value:any) => setTempPrinter({...tempPrinter, brand:value})} />

                                        {/* <TextInputGroupMain value={tempPrinter?.printer} onChange={(_event, value:any) => tempPrinter.printer==value} /> */}


                                    </TextInputGroup>
                                </GridItem>
                                {/* </FormGroup> */}
                            </Grid>

                            <Grid>
                                {/* <FormGroup fieldId="printer-ottoeject"> */}
                                <GridItem span={3}>
                                    <Content>{'MODEL:'}</Content>
                                </GridItem>
                                <GridItem span={8}>
                                    <TextInputGroup>
                                        {/* <TextInputGroupMain value={printer?.[0]?.ottoeject} onChange={(_event, value:any) => setPrinter({...printer, [0]:{ottoeject:value}})} /> */}
                                        {/* <TextInputGroupMain id='printer-ottoeject' value={tempPrinter[0]?.ottoeject} onChange={(_event, value:any) => setTempPrinter({...tempPrinter, [0]:{ottoeject:value}})} /> */}
                                        <TextInputGroupMain id='printer-ottoeject' value={tempPrinter?.model} onChange={(_event, value:any) => setTempPrinter({...tempPrinter, model:value})} />

                                        {/* <TextInputGroupMain value={tempPrinter.ottoeject} onChange={(_event, value:any) => tempPrinter.ottoeject==value} /> */}

                                    </TextInputGroup>
                                </GridItem>
                                {/* </FormGroup> */}
                            </Grid>

                            <Grid>
                                {/* <FormGroup fieldId="printer-connection-ipaddress"> */}
                                <Content>{'CONNECTION:'}</Content>
                                <GridItem span={3}>
                                    <Content>{'IP ADDRESS:'}</Content>
                                </GridItem>
                                <GridItem span={8}>
                                    <TextInputGroup>
                                        {/* <TextInputGroupMain value={printer?.[0]?.connection?.ipAddress} onChange={(_event, value:any) => setPrinter({...printer, [0]:{connection:{ipAddress:value}}})} /> */}
                                        {/* <TextInputGroupMain id='printer-connection-ipaddress' value={tempPrinter[0]?.connection?.ipAddress} onChange={(_event, value:any) => setTempPrinter({...tempPrinter, [0]:{connection:{...tempPrinter[0]?.connection, ipAddress:value}}})} /> */}
                                        <TextInputGroupMain id='printer-connection-ipaddress' value={tempPrinter?.ip_address} onChange={(_event, value:any) => setTempPrinter({...tempPrinter, ip_address:value})} />

                                        {/* <TextInputGroupMain value={tempPrinter?.connection?.ipAddress} onChange={(_event, value:any) => tempPrinter?.connection?.ipAddress == value }/> */}

                                    </TextInputGroup>
                                </GridItem>
                                {/* </FormGroup> */}
                            </Grid>
                            <Grid>
                                {/* <FormGroup fieldId="pritner-connection-serial"> */}
                                <GridItem span={3}>
                                    <Content>{'SERIAL:'}</Content>
                                </GridItem>
                                <GridItem span={8}>
                                    <TextInputGroup>
                                        {/* <TextInputGroupMain value={printer?.[0]?.connection?.serial} onChange={(_event, value:any) => setPrinter({...printer, [0]:{connection:{serial:value}}})} /> */}
                                        {/* <TextInputGroupMain id='printer-connection-serial' value={tempPrinter[0]?.connection?.serial} onChange={(_event, value:any) => setTempPrinter({...tempPrinter, [0]:{connection:{...tempPrinter[0]?.connection, serial:value}}})} /> */}
                                        <TextInputGroupMain id='printer-connection-serial' value={tempPrinter?.serial_number} onChange={(_event, value:any) => setTempPrinter({...tempPrinter, serial_number:value})} />

                                        {/* <TextInputGroupMain value={tempPrinter.connection?.serial} onChange={(_event, value:any) => tempPrinter?.connection?.serial == value } /> */}

                                    </TextInputGroup>
                                </GridItem>
                                {/* </FormGroup> */}
                            </Grid>

                            {/* <Content>{'IP ADDRESS: '+ ' ~Sortage test~'}</Content> */}
                
                            {/* <Content>{'STORAGE LOCATION: '+ ' ~Sortage test~'}</Content> */}
                    
                            {/* <Content>{'MATERIAL: '+ ' ~Material test~'}</Content> */}
                    
                            {/* <Content>{'MATERIAL REQUIRED: '+ ' ~Material Required test~'}</Content> */}
                        
                            {/* <Content>{'DURATION: '+ ' ~Duration test~'}</Content> */}
                           
                        </Form>
                        {/* </PageSection> */}
                    </GridItem>

                    <GridItem span={4}>
                        {/* <PageSection> */}
                        <FormGroup>
                            <Content component={ContentVariants.h6}>{'THUMBNAIL'}</Content>
                            <Brand src={thumbnail} alt={"printer thumbnail"} style={{width: '100%'}} />
                            {<Content className="pf-custom-align-center"><strong>{tempPrinter?.status}</strong></Content>}
                        </FormGroup>
                        {/* </PageSection> */}
                    </GridItem>
                
                </Grid>


                <ModalFooter className="pf-custom-new-print-job-modal-footer">
                    <Button 
                        // isDisabled={currentFiles.length==0}
                        // className="pf-custom-button"
                        // variant="danger"
                        variant="secondary"
                        // onClick={() => sendFileToPrinter()}
                        onClick={() => {setIsPrinterEditModalOpen(false)}}
                    >
                        {'Cancel'}
                    </Button>
                    <Button 
                        // isDisabled={currentFiles.length==0}
                        className="pf-custom-button"
                        // onClick={() => sendFileToPrinter()}
                        onClick={() => {
                            editPrinterSave();
                            setIsPrinterEditModalOpen(false)
                            setTempPrinter({});
                        }}
                    >
                        {'Save'}
                    </Button>
                    <Button 
                        // isDisabled={currentFiles.length==0}
                        className="pf-custom-button"
                        variant="danger"
                        // onClick={() => sendFileToPrinter()}
                        onClick={() => {
                            deletingPrinter(printer[printerIndex!].id);
                            setIsPrinterEditModalOpen(false)
                            setTempPrinter({});
                        }}
                    >
                        {'Delete'}
                    </Button>
                </ModalFooter>

            </PageSection> 

            {/* : ''} */}
            {/* </> */}
            </Modal>
    )
    
}