import { JobContext } from "./App";
import { Button, Grid, GridItem, PageSection } from "@patternfly/react-core";
import { useContext, useEffect, useState } from "react";
import addPrintTask from "./AddPrintTask";
import newPrintJob from "./newPrintJob";
import APILoader from "./loadAPI";
import { moonraker } from "./listAPI";



export default function Dashboard() {
    const { printer, setIsFileUploadModalOpen, printTaskModalOpen, fileUploadModalOpen } = useContext(JobContext);
    // const [refresh] = useState(false);
    // const [workflow, setWorkflow] = useState<any>();
    // useEffect(() => {
    //     APILoader();
    // }, [refresh]);
    APILoader();

    // const workflow = () => {
    //     console.log(printer);

    //     if(fileUploadModalOpen) {
    //         console.log('add print task');
    //         return (
    //             addPrintTask()
    //         )
    //     }
    //     if(printTaskModalOpen) {
    //         console.log('new print job')
    //         return(
    //             newPrintJob()
    //         )
    //     }
    // };

    // const workflow = () => {
        // console.log(printer);

        // if(fileUploadModalOpen) {
        //     console.log('add print task');
        //     setWorkflow(addPrintTask());
        // }
        
        // if(printTaskModalOpen) {
        //     console.log('new print job')
        //     setWorkflow(newPrintJob());
        // }
    // };
    

    return (
        <>
            <Grid>
                <GridItem span={2}>
                    <PageSection id='left-navbar' className="pf-custom-navbar">

                    </PageSection>
                </GridItem>

                <GridItem span={10}>
                    <GridItem rowSpan={1}>
                        <PageSection id='top-toolbar' className="pf-custom-top-toolbar">
                            <Button 
                                id="add-print-button" 
                                className="pf-custom-add-print-button"
                                onClick={() => setIsFileUploadModalOpen(true)}
                            >
                                {'+ Add'}
                            </Button>
                        </PageSection>
                    </GridItem>

                    <GridItem>
                        <PageSection id='dashboard' className="pf-custom-dashboard">
                            {newPrintJob()}
                            {addPrintTask()}
                            {/* {workflow()} */}
                        </PageSection>
                    </GridItem>
                </GridItem>
                
            </Grid>
            {/* <PageSection className="pf-custom-main">
                        
                <PageSection id='left-navbar' className="pf-custom-navbar">

                </PageSection>

                <PageSection className="pf-custom-main">
                    <PageSection id='top-toolbar' className="pf-custom-top-toolbar">
                        <Button 
                            id="add-print-button" 
                            className="pf-custom-add-print-button"
                            onClick={() => setIsPrintTaskModalOpen(true)}
                        >
                            {'+ Add'}
                        </Button>
                    </PageSection>

                    <PageSection id='dashboard' className="pf-custom-dashboard">

                    </PageSection>
                </PageSection>
            </PageSection> */}

            {/* <PageSection>
                <Button
                onClick = {() => startPrintTask()}
                >
                {'Start Print Task'}
                </Button>


            </PageSection>
            <PageSection>
                <Button
                onClick = {() => startEjectTask()}
                >
                {'Start ejectobot'}
                </Button>
            </PageSection>
            <PageSection>
                <Button
                onClick = {() => getPrinterInfo()}
                >
                {'Printer Info to console log'}
                </Button>
            </PageSection> */}
            {/* {addPrintTask()} */}
        </>
    )
}