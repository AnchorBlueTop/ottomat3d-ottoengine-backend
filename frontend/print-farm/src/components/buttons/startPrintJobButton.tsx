import { Button } from "@patternfly/react-core";
import { useContext } from "react";
import { JobContext } from "../../App";

export default function StartPrintJobsButton () {
    const { selectedJobIDs, setIsJobQueueModalOpen} = useContext(JobContext); 
    
    return ( 
        <>
            {selectedJobIDs.length ? <Button
                id="start-print-job-button"
                className="pf-custom-start-button"
                onClick={() => { setIsJobQueueModalOpen(true) }}
            >
                {'Start'}
            </Button> : ''}
        </>
    );
}