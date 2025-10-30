import { Button } from "@patternfly/react-core";
import { useContext } from "react";
import { JobContext } from "../../App";

export default function AddNewPrintJobButton () {
    const { setIsFileUploadModalOpen, setCurrentFiles } = useContext(JobContext); 
    
    return ( 
        <Button 
            id="add-print-button" 
            className="pf-custom-add-button"
            onClick={() => {setCurrentFiles([]),setIsFileUploadModalOpen(true)}}
        >
            {'+ Add New Print Job'}
        </Button>
    );
}