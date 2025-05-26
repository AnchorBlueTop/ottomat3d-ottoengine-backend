import { Button } from "@patternfly/react-core";
import { useContext } from "react";
import { JobContext } from "../../App";

export default function AddNewOttoejectButton () {
    const { setIsOttoejectAddModalOpen } = useContext(JobContext); 
    return ( 
        <Button 
            id="add-ottoeject-button" 
            className="pf-custom-add-print-button"
            onClick={() => setIsOttoejectAddModalOpen(true)}
        >
            {'+ Add New OTTOeject'}
        </Button>
    );
}