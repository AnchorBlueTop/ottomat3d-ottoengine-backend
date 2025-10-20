import {
    Button,
    Content,
    ContentVariants,
    Form,
    Grid,
    GridItem,
    Modal,
    ModalFooter,
    ModalHeader,
    NumberInput,
    PageSection,
    TextInput
} from "@patternfly/react-core";
import { useContext, useState, useEffect } from "react";
import { JobContext } from "../../App.tsx";
import { OttoRack, Shelf } from "../../representations/ottorackRepresentation.ts";

export default function editOttorack() {
    const { ottorack, setOttorack, ottorackEditModalOpen, setIsOttorackEditModalOpen, ottorackIndex } = useContext(JobContext);
    const [tempOttorack, setTempOttorack] = useState<OttoRack>({ name: '' });
    const [rackVis, setRackVis] = useState<any[]>([]);
    const [selectedShelf, setSelectedShelf] = useState<number | null>(null);


    const [tempShelf, setTempShelf] = useState<Shelf[]>([]);
    const minValue = 1;
    const maxValue = 6;
    var uniqueId: number | string = '';
    const [value, setValue] = useState<number>(minValue);

    const generateRackId = () => {
        uniqueId = (Math.random().toString(36).substring(2));
        return uniqueId;
    };

    const editOttorackSave = () => {
        tempOttorack.shelves = tempShelf
        setTempOttorack({ ...tempOttorack, shelves: tempShelf });

        if (tempOttorack) {

            ottorack[ottorackIndex!] = tempOttorack;
        }
        setOttorack(ottorack);
    }

    const deletingOttorack = (id: any) => {

        delete ottorack[id];
        setOttorack(ottorack)
    }

    const normalizeBetween = (value: number, min: number, max: number) => {
        if (min !== undefined && max !== undefined) {
            return Math.max(Math.min(value, max), min);
        } else if (value <= min) {
            return min;
        } else if (value >= max) {
            return max;
        }
        return value;
    };

    const onMinus = () => {
        const newValue = normalizeBetween((value as number) - 1, minValue, maxValue);
        setValue(newValue);
        tempShelf?.pop();
        setTempShelf(tempShelf);
        // setTempOttorack({...tempOttorack, shelves: newValue});
        rackVisualisation(newValue);
    };

    const onChange = (event: React.FormEvent<HTMLInputElement>) => {
        const value = (event.target as HTMLInputElement).value;
        setValue(value === null ? value : +value);

        // setTempOttorack({...tempOttorack, shelves: (value === undefined ? value : +value)});
        rackVisualisation(value);
    };

    const onBlur = (event: React.FocusEvent<HTMLInputElement>) => {
        const blurVal = +event.target.value;

        if (blurVal < minValue) {
            setValue(minValue);
            // setTempOttorack({...tempOttorack, shelves: minValue});
        } else if (blurVal > maxValue) {
            setValue(maxValue);
            // setTempOttorack({...tempOttorack, shelves: maxValue});
        }
        rackVisualisation(value);
    };

    const onPlus = () => {
        const newValue = normalizeBetween((value as number) + 1, minValue, maxValue);
        setValue(newValue);
        rackVisualisation(newValue);
        // setTempOttorack({...tempOttorack, shelves: newValue});
        generateRackId();
        tempShelf?.push({ id: uniqueId.toString() });
        setTempShelf(tempShelf);
    };

    // const rackVisualisation = (value: any) => {
    //     const newRackVis = [];
    //     for (let i = 0; i < value; i++) {
    //         newRackVis.push(
    //             <>
    //                 <input className="customCheckBoxInput" type="checkbox" />
    //                 <label className="customCheckBoxWrapper">
    //                     <div onClick={() => { console.log(`shelf - ${value - i}`) }} className="customCheckBox">
    //                         <div className="inner">{'>------------------< ' + (value - i)}</div>
    //                     </div>
    //                 </label>
    //             </>
    //         );
    //     }

    //     setRackVis(newRackVis.reverse());
    // };

    const rackVisualisation = (value?: number | any) => {
        if (!value || value < 1) return; // Ensure value is valid
    
        const newRackVis = [];
        for (let i = 0; i < value; i++) {
            const shelf = tempShelf?.find((s) => s.id === i + 1); // Find the shelf by ID
    
            // Conditionally render content based on the shelf type
            const shelfContent =
                shelf?.type === "empty_plate" ? (
                    <div className="shelf-content">
                        <span>🟢 Empty Plate</span>
                    </div>
                ) : (
                    <div className="shelf-content">{`>------------------< ${i + 1}`}</div> // Default content for an empty shelf
                );
    
            newRackVis.push(
                <>
                    <input className="customCheckBoxInput" type="checkbox" />
                    <label className="customCheckBoxWrapper">
                        <div
                            onClick={() => handleShelfClick(i + 1)} // Pass the correct shelf number
                            className="customCheckBox"
                        >
                            {shelfContent}
                        </div>
                    </label>
                </>
            );
        }
    
        setRackVis(newRackVis.reverse()); // Update the rackVis state
    };

    const handleShelfClick = (shelfNumber: number) => {
        const updatedShelves = [...tempShelf];
        const shelfIndex = updatedShelves.findIndex((shelf) => shelf.id === shelfNumber);
    
        if (shelfIndex !== -1) {
            // Toggle or update the shelf's type
            const currentShelf = updatedShelves[shelfIndex];
            if (currentShelf.type === "empty_plate") {
                updatedShelves[shelfIndex] = {
                    ...currentShelf,
                    type: "", // Clear the type
                    occupied: false,
                };
            } else {
                updatedShelves[shelfIndex] = {
                    ...currentShelf,
                    type: "empty_plate", // Assign an empty plate
                    occupied: true,
                };
            }
        } else {
            // If the shelf doesn't exist, create it and assign a default type
            updatedShelves.push({
                id: shelfNumber,
                type: "empty_plate",
                occupied: true,
            });
        }
    
        setTempShelf(updatedShelves); // Update the state
        setSelectedShelf(shelfNumber); // Update the selected shelf
        rackVisualisation(value); // Ensure the visualization is updated
    };

    useEffect(() => {
        if (ottorackIndex || ottorackIndex == 0) {
            setTempOttorack(ottorack[ottorackIndex]);
            setValue(ottorack[ottorackIndex].shelves!.length);
            setTempShelf(ottorack[ottorackIndex].shelves || []);
            rackVisualisation(ottorack[ottorackIndex].shelves!.length);
        }
        generateRackId();
    }, [ottorackEditModalOpen]);

    return (
        <Modal
            isOpen={ottorackEditModalOpen}
            className="pf-custom-new-ottorack-modal"
            aria-label="newOttorack"
            onClose={() => setIsOttorackEditModalOpen(false)}
        >
            <PageSection className="pf-custom-new-ottorack">
                <ModalHeader className="pf-custom-upload-header">
                    <Content component={ContentVariants.h3}>
                        {/* <Brand src={ottoEjectIcon} alt="ottorack logo" className='pf-custom-modal-icon' /> */}
                        {' ADD NEW ottorack'}</Content>
                </ModalHeader>
                <Grid hasGutter>
                    <GridItem span={8}>
                        <Form isHorizontal className="pf-custom-text-align-left">

                            <Grid>
                                <GridItem span={3}>
                                    <Content>{'NAME:'}</Content>
                                </GridItem>
                                <GridItem span={8}>
                                    <TextInput
                                        id='ottorack-name'
                                        placeholder=""
                                        value={tempOttorack?.name || ''}
                                        onChange={(_event, value: string) => setTempOttorack({ ...tempOttorack, name: value })}
                                    />
                                </GridItem>
                            </Grid>

                            <div className="pf-c-form-group">
                                <span className="pf-custom-border-label">{'SHELF CONFIGURATION: '}</span>
                                <Grid>
                                    <GridItem span={3}>
                                        <Content>{'SHELVES:'}</Content>
                                    </GridItem>
                                    <GridItem span={8}>
                                        {/* <TextInputGroup>
                                            <TextInputGroupMain id='ottorack-shelves' value={tempOttorack?.shelves} onChange={(_event, value: any) => setTempOttorack({ ...tempOttorack, shelves: value })} />
                                        </TextInputGroup> */}
                                        {<NumberInput
                                            value={value}
                                            min={minValue}
                                            max={maxValue}
                                            onMinus={onMinus}
                                            // onChange={onChange}
                                            // onBlur={onBlur}
                                            onPlus={onPlus}
                                            inputName="input"
                                            inputAriaLabel="number input"
                                            minusBtnAriaLabel="minus"
                                            plusBtnAriaLabel="plus"
                                        />}

                                    </GridItem>
                                </Grid>
                            </div>
                        </Form>
                    </GridItem>

                    <GridItem span={4} className="pf-custom-rack-render">

                        {rackVis}

                    </GridItem>
                </Grid>

                <ModalFooter className="pf-custom-new-ottorack-modal-footer">
                    <Button
                        variant="secondary"
                        onClick={() => { setIsOttorackEditModalOpen(false) }}
                    >
                        {'Cancel'}
                    </Button>
                    <Button
                        className="pf-custom-button"
                        onClick={() => {
                            editOttorackSave();
                            setIsOttorackEditModalOpen(false)
                            setTempOttorack({ name: '' });
                        }}
                    >
                        {'Save'}
                    </Button>
                    <Button
                        className="pf-custom-button"
                        variant="danger"
                        onClick={() => {
                            deletingOttorack(ottorack[ottorackIndex!].id);
                            setIsOttorackEditModalOpen(false)
                            setTempOttorack({ name: '' });
                        }}
                    >
                        {'Delete'}
                    </Button>
                </ModalFooter>
            </PageSection>
        </Modal>
    );
}