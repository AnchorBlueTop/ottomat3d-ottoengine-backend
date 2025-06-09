import { Button } from "@patternfly/react-core";
import { useContext } from "react";
import { JobContext } from "../../App";

export default function AddNewPrinterButton () {
    const { setIsPrinterAddModalOpen } = useContext(JobContext); 
    return ( 
        <Button 
            id="add-printer-button" 
            className="pf-custom-add-button"
            onClick={() => setIsPrinterAddModalOpen(true)}
        >
            {'+ Add New Printer'}
        </Button>
    );
}