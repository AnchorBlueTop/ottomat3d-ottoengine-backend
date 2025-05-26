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
import { Component, useContext, useState } from "react";
import { JobContext } from "../App.tsx";
import uploadBox from './public/box_icon.png';
import thumbnail from '../public/thumbnail.png';
import { PrinterRegistrationRepresentation, PrinterRepresentation } from "../representations/printerRepresentation.ts";
import { registerPrinter } from "../ottoengine_API.ts";
// import { moonraker } from "./listAPI";

export default function newPrinter () {
    const { printer, setPrinter, printerAddModalOpen, setIsPrinterAddModalOpen } = useContext(JobContext);
    // const [ID_Value, setID_Value] = useState();
    const [tempPrinter, setTempPrinter] = useState<PrinterRegistrationRepresentation>();
    // const [tempPrinter, setTempPrinter] = useState<PrinterRegistrationRepresentation>({
    //     name: '',
    //     brand: '',
    //     model: '',
    //     type: '',
    //     ip_address: '',
    //     serial_number: '',
    //     access_code: ''
    // });
    
    
    // const [tempPrinter, setTempPrinter] = useState<printerRepresentation[]>([{
    //     name: undefined,
    //     printer: undefined,
    //     ottoeject:undefined,
    //     connection: {
    //         ipAddress: undefined,
    //         serial: undefined,
    //         accessCode: undefined
    //     }
    // }]);
    // console.log(tempPrinter);

    const updatePrinterList = (tempPrinter: any) => {
        if(!printer){
            console.log(tempPrinter);
            const registeredResponse = registerPrinter(tempPrinter).then(() => {console.log('then in printer registration')});

                
            console.log(registeredResponse);
            setPrinter([tempPrinter]);
            setTempPrinter({});
        } else {
            if(!printer[0]){
                delete printer[0];
                printer.push(tempPrinter);
                console.log(printer);
                
                setPrinter(printer);
                setTempPrinter({});
            } else {
                console.log(tempPrinter); 
                console.log(printer);
                // setPrinter({...printer, 
                //     [0]:{
                //         name: tempPrinter[0].name,
                //         printer: tempPrinter[0].printer, 
                //         ottoeject: tempPrinter[0].ottoeject, 
                //         connection: {
                //             ipAddress: tempPrinter[0].connection?.ipAddress,
                //             serial: tempPrinter[0].connection?.serial,
                //             accessCode: tempPrinter[0].connection?.accessCode
                //         }
                //     }
                    
                // })
                // async() => {

                    const registeredResponse = registerPrinter(tempPrinter).then(() => {console.log('then in printer registration')});
                    
                    console.log(registeredResponse);
                    printer.push(tempPrinter);
                    console.log(printer);
                    
                    setPrinter(printer);

                    console.log('Adding new Printer');
                    setIsPrinterAddModalOpen(false);
                    setTempPrinter({});
                // }
                
            }
            
        }
        setIsPrinterAddModalOpen(false);

    };

    return (
            <Modal
                isOpen={printerAddModalOpen}
                className="pf-custom-new-printer-modal"
                aria-label="newPrinter"
            >

            {/* <> */}
            {/* {printTaskModalOpen ?  */}
            <PageSection className="pf-custom-new-printer">
                <ModalHeader className="pf-custom-upload-header">
                    <Content component={ContentVariants.h3}>
                        {/* <Brand src={uploadBox} alt="Upload logo" className='pf-custom-upload-icon'/> */}
                        {' ADD NEW PRINTER'}</Content>
                </ModalHeader>
                <Grid hasGutter>
                
                {/* <CardHeader className='pf-custom-upload-header'>
                    
                </CardHeader> */}

                    {/* TODO: ADD TEXT BOX TO CREATE VARIABLES FOR PRINTER */}
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
                                            placeholder=""
                                            value={tempPrinter?.name}
                                            // value={tempPrinter?.name} 


                                            // onChange={(_event, value:any) => setPrinter({...printer, [0]:{name:value}})} 
                                            // onChange={(_event, value:any) => setTempPrinter({...tempPrinter, [0]:{name:value}})}
                                            onChange={(_event, value: string) => setTempPrinter({...tempPrinter, name:value})}
                                            // onChange={(_event, value:any) => tempPrinter.name == value }
                                        

                                            // frameBorder={'none'}
                                            
                                        />
                                    {/* </TextInputGroup> */}
                                </GridItem>
                                {/* </FormGroup> */}
                            </Grid>
                        
                            {/* <Content>{'STATUS: '+ printer?.result?.state_message}</Content> */}
                            <Grid>
                                {/* <FormGroup fieldId="printer-printer"> */}
                                <GridItem span={3}>
                                    <Content>{'PRINTER BRAND:'}</Content>
                                </GridItem>
                                <GridItem span={8}>
                                    <TextInputGroup>
                                        {/* <TextInputGroupMain value={printer?.[0]?.printer} onChange={(_event, value:any) => setPrinter({...printer, [0]:{printer:value}})} /> */}
                                        {/* <TextInputGroupMain id='printer-printer' value={tempPrinter[0]?.printer} onChange={(_event, value:any) => setTempPrinter({...tempPrinter, [0]:{printer:value}})} /> */}
                                        <TextInputGroupMain id='printer-brand' value={tempPrinter?.brand} onChange={(_event, value:any) => setTempPrinter({...tempPrinter, brand:value})} />

                                        {/* <TextInputGroupMain value={tempPrinter?.printer} onChange={(_event, value:any) => tempPrinter.printer==value} /> */}


                                    </TextInputGroup>
                                </GridItem>
                                {/* </FormGroup> */}
                            </Grid>

                            <Grid>
                                {/* <FormGroup fieldId="printer-ottoeject"> */}
                                <GridItem span={3}>
                                    <Content>{'PRINTER MODEL:'}</Content>
                                </GridItem>
                                <GridItem span={8}>
                                    <TextInputGroup>
                                        {/* <TextInputGroupMain value={printer?.[0]?.ottoeject} onChange={(_event, value:any) => setPrinter({...printer, [0]:{ottoeject:value}})} /> */}
                                        {/* <TextInputGroupMain id='printer-ottoeject' value={tempPrinter[0]?.ottoeject} onChange={(_event, value:any) => setTempPrinter({...tempPrinter, [0]:{ottoeject:value}})} /> */}
                                        <TextInputGroupMain id='printer-model' value={tempPrinter?.model} onChange={(_event, value:any) => setTempPrinter({...tempPrinter, model:value})} />

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
                            <Grid>
                                {/* <FormGroup fieldId="pritner-connection-accesscode"> */}
                                <GridItem span={3}>
                                    <Content>{'ACCESS CODE:'}</Content>
                                </GridItem>
                                <GridItem span={8}>
                                    <TextInputGroup>
                                        {/* <TextInputGroupMain value={printer?.[0]?.connection?.accessCode} onChange={(_event, value:any) => setPrinter({...printer, [0]:{connection:{accessCode:value}}})} /> */}
                                        {/* <TextInputGroupMain id='printer-connection-accesscode' value={tempPrinter[0]?.connection?.accessCode} onChange={(_event, value:any) => setTempPrinter({...tempPrinter, [0]:{connection:{...tempPrinter[0]?.connection, accessCode:value}}})} /> */}
                                        <TextInputGroupMain id='printer-connection-accesscode' value={tempPrinter?.access_code} onChange={(_event, value:any) => setTempPrinter({...tempPrinter, access_code:value})} />

                                        {/* <TextInputGroupMain value={tempPrinter.connection?.accessCode} onChange={(_event, value:any) => tempPrinter?.connection?.accessCode == value} /> */}

                                    </TextInputGroup>
                                </GridItem>
                                {/* </FormGroup> */}
                            </Grid>
                            <Grid>
                                {/* <FormGroup fieldId="pritner-connection-accesscode"> */}
                                <GridItem span={3}>
                                    <Content>{'TYPE:'}</Content>
                                </GridItem>
                                <GridItem span={8}>
                                    <TextInputGroup>
                                        {/* <TextInputGroupMain value={printer?.[0]?.connection?.accessCode} onChange={(_event, value:any) => setPrinter({...printer, [0]:{connection:{accessCode:value}}})} /> */}
                                        {/* <TextInputGroupMain id='printer-connection-accesscode' value={tempPrinter[0]?.connection?.accessCode} onChange={(_event, value:any) => setTempPrinter({...tempPrinter, [0]:{connection:{...tempPrinter[0]?.connection, accessCode:value}}})} /> */}
                                        <TextInputGroupMain placeholder='eg. FDM' id='printer-type' value={tempPrinter?.type} onChange={(_event, value:any) => setTempPrinter({...tempPrinter, type:value})} />

                                        {/* <TextInputGroupMain value={tempPrinter.connection?.accessCode} onChange={(_event, value:any) => tempPrinter?.connection?.accessCode == value} /> */}

                                    </TextInputGroup>
                                </GridItem>
                                {/* </FormGroup> */}
                            </Grid>
                           
                        </Form>
                        {/* </PageSection> */}
                    </GridItem>

                    <GridItem span={4}>
                        {/* <PageSection> */}
                        <FormGroup>
                            <Content component={ContentVariants.h6}>{'THUMBNAIL'}</Content>
                            <Brand src={thumbnail} alt={"printer thumbnail"} style={{width: '100%'}} />
                        </FormGroup>
                        {/* </PageSection> */}
                    </GridItem>
                
                </Grid>


                <ModalFooter className="pf-custom-new-print-job-modal-footer">
                    <Button 
                        // isDisabled={currentFiles.length==0}
                        // className="pf-custom-button"
                        variant="danger"
                        // onClick={() => sendFileToPrinter()}
                        onClick={() => {setIsPrinterAddModalOpen(false)}}
                    >
                        {'Cancel'}
                    </Button>
                    <Button 
                        // isDisabled={currentFiles.length==0}
                        className="pf-custom-button"
                        // onClick={() => sendFileToPrinter()}
                        onClick={() => {
                            // console.log(tempPrinter), 
                            // console.log(printer),
                            // // setPrinter({...printer, 
                            // //     [0]:{
                            // //         name: tempPrinter[0].name,
                            // //         printer: tempPrinter[0].printer, 
                            // //         ottoeject: tempPrinter[0].ottoeject, 
                            // //         connection: {
                            // //             ipAddress: tempPrinter[0].connection?.ipAddress,
                            // //             serial: tempPrinter[0].connection?.serial,
                            // //             accessCode: tempPrinter[0].connection?.accessCode
                            // //         }
                            // //     }
                                
                            // // })
                            
                            updatePrinterList(tempPrinter);
                            // printer.push(tempPrinter);
                            // console.log(printer);
                            
                            // setPrinter(printer);
                            // printer.push(tempPrinter);

                            // add back in after
                            // console.log('Adding new Printer')
                            // setIsPrinterAddModalOpen(false)
                            // setTempPrinter({});
                        }}
                    >
                        {'ADD'}
                    </Button>
                </ModalFooter>

            </PageSection> 

            {/* : ''} */}
            {/* </> */}
            </Modal>
    )
    
}