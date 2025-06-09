import { Button } from "@patternfly/react-core";
import { useContext } from "react";
import { JobContext } from "../../App";

export default function AddNewOttorackButton () {
    const { setIsOttorackAddModalOpen } = useContext(JobContext); 
    return ( 
        <Button 
            id="add-ottorack-button" 
            className="pf-custom-add-button"
            onClick={() => setIsOttorackAddModalOpen(true)}
        >
            {'+ Add New OTTOrack'}
        </Button>
    );
}