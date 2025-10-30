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
    TextInput} from "@patternfly/react-core";
import { useContext, useState, useEffect } from "react";
import { JobContext } from "../../App.tsx";
import { OttoRackRegistration, Shelf, PrintJob } from "../../representations/ottorackRepresentation.ts";
import { createOttorack } from "../../ottoengine_API";
import ShelfDetailsModal from "./ShelfDetailsModal";
import RackVisualizer from "../rackVisualisation.tsx";


export default function newOttorack() {
    const { ottorack, setOttorack, ottorackAddModalOpen, setIsOttorackAddModalOpen } = useContext(JobContext);
    const [tempOttorack, setTempOttorack] = useState<OttoRackRegistration>({name: ""});
    // const [rackVis, setRackVis] = useState<any[]>([]);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    
    const [selectedShelf, setSelectedShelf] = useState<number | null>(null);
    const [printJobDetails, setPrintJobDetails] = useState<PrintJob | null>(null);
    const [isShelfModalOpen, setIsShelfModalOpen] = useState(false);

    const [tempShelf, setTempShelf] = useState<Shelf[]>([]);
    const minValue = 1;
    const maxValue = 6;
    var uniqueId: number | string = '';
    const [value, setValue] = useState<number>(minValue);
    const isSaveDisabled = !tempOttorack.name?.trim();
    
    const generateRackId = () => {
        const timestamp = new Date().getTime();
        uniqueId = (Math.random().toString(36).substring(2)) ;
        // setTempOttorack({...tempOttorack, id: uniqueId.toString()});
        return uniqueId;
    };

    const updateOttorackList = async (tempOttorack: OttoRackRegistration) => {


        // for (let index = 0; index < value; index++) {
        //     generateRackId();
        //     tempShelf.push({id: uniqueId.toString()})
        //     setTempShelf(tempShelf);
        // }
        // // setTempShelf(tempShelf);
        // tempOttorack.shelves = tempShelf
        // setTempOttorack({shelves: tempShelf});
        // if (!ottorack) {
        //     // registerOttoeject(tempOttorack).then(() => { console.log('then in ottorack registration') });
        //     setOttorack([tempOttorack]);
        //     setTempOttorack({shelves: []});
        //     setTempShelf([]);
        // } else {
        //     if (!ottorack[0]) {
        //         // console.log('in !ottorack[0]');
        //         delete ottorack[0];

        //         ottorack.push(tempOttorack);
        //         // registerOttoeject(tempOttorack).then(() => { console.log('then in ottorack registration') });
        //         setOttorack(ottorack);
        //         setTempOttorack({shelves: []});
        //         setTempShelf([]);
        //     } else {
        //         // registerOttoeject(tempOttorack).then(() => { console.log('then in ottorack registration') });
        //         ottorack.push(tempOttorack);
        //         setOttorack(ottorack);
        //         setIsOttorackAddModalOpen(false);
        //         setTempOttorack({shelves: []});
        //         setTempShelf([]);
        //     }
        // }

        // try {
        //     // Prepare the Ottorack data
        //     const newOttorack = {
        //         name: tempOttorack.name,
        //         number_of_shelves: value, // Use the current shelf count
        //         // shelfSpacingMm: 80, // Example value, adjust as needed
        //         // bedSize: "256x256", // Example value, adjust as needed
        //     };
    
        //     // Call the API to create the Ottorack
        //     const createdOttorack = await createOttorack(newOttorack);
        //     console.log("Ottorack created successfully:", createdOttorack);
    
        //     // Update the frontend state
        //     if (!ottorack) {
        //         setOttorack([createdOttorack]);
        //     } else {
        //         setOttorack([...ottorack, createdOttorack]);
        //     }
    
        //     // Reset temporary state
        //     setTempOttorack({ name: "", number_of_shelves: 0, shelfSpacingMm: 0, bedSize: "" });
        //     setTempShelf([]);
        //     setIsOttorackAddModalOpen(false);
        // } catch (error) {
        //     console.error("Error creating Ottorack:", error);
        //     setErrorMessage("Failed to create Ottorack. Please try again.");
        // }

        // setIsOttorackAddModalOpen(false);

        try {
            const number_of_shelves = value;

            // Ensure we send a shelf record for each slot 1..N (1-based ids)
            const shelves = Array.from({ length: number_of_shelves }, (_, i) => {
                const id = i + 1;
                const s = tempShelf.find(sh => sh.id === id);
                return {
                    id,                                        // 1-based shelf id
                    type: (s?.type ?? '') as '' | 'empty_plate' | 'build_plate',
                    occupied: Boolean(s?.occupied),
                };
            });

            const registration: OttoRackRegistration = {
                name: (tempOttorack.name || '').trim(),
                number_of_shelves,
                bedSize: tempOttorack.bedSize || undefined,
                shelfSpacingMm:
                    tempOttorack.shelfSpacingMm !== undefined && tempOttorack.shelfSpacingMm !== ''
                        ? Number(tempOttorack.shelfSpacingMm)
                        : undefined,
                shelves,
            };

            const createdOttorack = await createOttorack(registration);

            setOttorack(prev => (prev ? [...prev, createdOttorack] : [createdOttorack]));

            // Reset state and close
            setTempOttorack({ name: "", number_of_shelves: 0, shelfSpacingMm: 0, bedSize: "" });
            setTempShelf([]);
            setIsOttorackAddModalOpen(false);
        } catch (error) {
            console.error("Error creating Ottorack:", error);
            setErrorMessage("Failed to create Ottorack. Please try again.");
        }
    };

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
        const newValue = normalizeBetween(value - 1, minValue, maxValue);
        setValue(newValue);
        setTempShelf(prev => {
          const next = [...prev];
          next.splice(newValue);
          return next.map((s, i) => ({ ...s, id: i + 1 }));
        });
    };

    // const onMinus = () => {
    //     const newValue = normalizeBetween(value - 1, minValue, maxValue);
    //     setValue(newValue);
    
    //     // Update tempShelf to match the new number of shelves
    //     const updatedShelves = [...tempShelf];
    //     updatedShelves.splice(newValue); // Remove extra shelves if the value decreases
    
    //     setTempShelf(updatedShelves);
    
    //     // Trigger visualization update with the new value
    //     rackVisualisation(newValue);
    // };

    // const onChange = (event: React.FormEvent<HTMLInputElement>) => {
    //     const value = (event.target as HTMLInputElement).value;
    //     // setValue(value === '' ? value : +value);
    //     // setTempOttorack({...tempOttorack, shelves: (value === undefined ? value : +value)});
    //     rackVisualisation(value);
    // };

    // const onBlur = (event: React.FocusEvent<HTMLInputElement>) => {
    //     const blurVal = +event.target.value;

    //     if (blurVal < minValue) {
    //         setValue(minValue);
    //         // setTempOttorack({...tempOttorack, shelves: minValue});
    //     } else if (blurVal > maxValue) {
    //         setValue(maxValue);
    //         // setTempOttorack({...tempOttorack, shelves: maxValue});
    //     }
    //     rackVisualisation(value);
    // };

    // const onPlus = () => {
    //     const newValue = normalizeBetween((value as number) + 1, minValue, maxValue);
    //     setValue(newValue);
    //     rackVisualisation(newValue);
    // };

    // const onPlus = () => {
    //     const newValue = normalizeBetween(value + 1, minValue, maxValue);
    //     setValue(newValue);
    
    //     // Update tempShelf to match the new number of shelves
    //     const updatedShelves = [...tempShelf];
    //     while (updatedShelves.length < newValue) {
    //         updatedShelves.push({ id: updatedShelves.length + 1, type: "", occupied: false }); // Use 1-based numbering
    //     }
    
    //     setTempShelf(updatedShelves);
    
    //     // Trigger visualization update with the new value
    //     rackVisualisation(newValue);
    // };
    const onPlus = () => {
        const newValue = normalizeBetween(value + 1, minValue, maxValue);
        setValue(newValue);
        setTempShelf(prev => {
          const next = [...prev];
          while (next.length < newValue) {
            next.push({ id: next.length + 1, type: "", occupied: false });
          }
          return next;
        });
    };

    // const rackVisualisation = (value?: any) => {
    //     // const newRackVis = [];
    //     // for (let i = 0; i < value; i++) {
    //     //     newRackVis.push(
    //     //         <>
    //     //             <input className="customCheckBoxInput" type="checkbox" />
    //     //             <label className="customCheckBoxWrapper">
    //     //                 <div onClick={() => { console.log(`shelf - ${value - i}`) }} className="customCheckBox">
    //     //                     <div className="inner">{'>------------------< ' + (value - i)}</div>
    //     //                 </div>
    //     //             </label>
    //     //         </>
    //     //     );
    //     // }
    //     // setRackVis(newRackVis.reverse());

    //     if (!value || value < 1) return; // Ensure value is valid

    //     const newRackVis = [];
    //     for (let i = 0; i < value; i++) {
    //         const shelf = tempShelf.find((s) => s.id === i + 1); // Find the shelf by ID
    //         // const shelfContent = shelf?.type === "empty_plate" ? "Empty Plate" : `Shelf ${value - i}`;
        
    //         // newRackVis.push(
    //         //     <>
    //         //         <input className="customCheckBoxInput" type="checkbox" />
    //         //         <label className="customCheckBoxWrapper">
    //         //             <div onClick={() => handleShelfClick(value - i)} className="customCheckBox">
    //         //                 <div className="inner">{'>------------------< ' + (value - i)}</div>
    //         //             </div>
    //         //         </label>
    //         //     </>
    //         // );

    //         // Conditionally render content based on the shelf type
    //         const shelfContent =
    //             shelf?.type === "empty_plate" ? (
    //                 <div className="inner">
    //                     <span>🟢 Empty Plate</span>
    //                 </div>
    //             ) : (
    //                 <div className="inner">{`>------------------< ${i + 1}`}</div> // Default content for an empty shelf
    //             );

    //         newRackVis.push(
    //             <div key={i} className="shelf-row">
    //                 <input className="customCheckBoxInput" type="checkbox" />
    //                 <label className="customCheckBoxWrapper">
    //                     <div
    //                         onClick={() => handleShelfClick(i + 1)} // Pass the correct shelf number
    //                         className="customCheckBox"
    //                     >
    //                         {shelfContent}
    //                     </div>
    //                 </label>
    //             </div>
    //         );
    //     }

    //     setRackVis(newRackVis.reverse());
    // };

    // const rackVisualisation = (value?: number | any) => {
    //     if (!value || value < 1) return;
    
    //     const newRackVis = [];
    //     for (let i = 0; i < value; i++) {
    //         const shelf = tempShelf?.find((s) => s.id === i + 1);
    
    //         // Determine the class for the wrapper based on the shelf type
    //         const wrapperClass = shelf?.type === "empty_plate" ? "empty-plate-bg" : "empty-shelf-bg";
    
    //         // Calculate the shelf number starting from the bottom
    //         const shelfNumber = (i + 1); // Reverse the numbering
    
    //         // Dropdown for selecting shelf type
    //         const shelfDropdown = (
    //             <select
    //                 className="shelf-dropdown"
    //                 value={shelf?.type || ""}
    //                 onChange={(e) => handleShelfTypeChange(shelfNumber, e.target.value)}
    //             >
    //                 <option value="">Empty Shelf</option>
    //                 <option value="empty_plate">Empty Plate</option>
    //             </select>
    //         );
    
    //         newRackVis.push(
    //             <div key={i} className="shelf-row">
    //                 <span className="shelf-number">{shelfNumber}</span> {/* Display shelf number */}
    //                 <label className={`customCheckBoxWrapper ${wrapperClass}`}>
    //                     <div className="customCheckBox">
    //                         {shelfDropdown}
    //                     </div>
    //                 </label>
    //             </div>
    //         );
    //     }
    
    //     setRackVis(newRackVis); // Update the visualization
    // };

    // const handleShelfTypeChange = (shelfNumber: number, newType: string) => {
    //     const updatedShelves = [...(tempShelf || [])];
    //     const shelfIndex = updatedShelves.findIndex((shelf) => shelf.id === shelfNumber);

    //     if (shelfIndex !== -1) {
    //         updatedShelves[shelfIndex] = {
    //             ...updatedShelves[shelfIndex],
    //             type: newType,
    //             occupied: newType === "empty_plate",
    //         };
    //     } else {
    //         updatedShelves.push({
    //             id: shelfNumber,
    //             type: newType,
    //             occupied: newType === "empty_plate",
    //         });
    //     }

    //     setTempShelf(updatedShelves);
    //     rackVisualisation(updatedShelves.length);
    // };
    const handleShelfTypeChange = (shelfNumber: number, newType: '' | 'empty_plate') => {
        setTempShelf(prev => {
          const next = [...prev];
          const idx = next.findIndex(s => s.id === shelfNumber);
          const updated = { id: shelfNumber, type: newType, occupied: newType === 'empty_plate' };
          if (idx !== -1) next[idx] = updated; else next.push(updated);
          return next;
        });
      };
      const addShelf = (index: number, type: "build_plate") => {
        setTempShelf(prev => {
          const next = [...prev];
          while (next.length < value) next.push({ id: next.length + 1, type: "", occupied: false });
          next[index] = { id: index + 1, type, occupied: false };
          return next;
        });
      };
    
      const removeShelf = (index: number) => {
        setTempShelf(prev => {
          const next = [...prev];
          if (index >= 0 && index < next.length) {
            next[index] = { id: index + 1, type: "", occupied: false };
          }
          return next;
        });
      };

    // const handleShelfClick = (shelfNumber: number) => {
    //     const updatedShelves = [...tempShelf];
    //     const shelfIndex = updatedShelves.findIndex((shelf) => shelf.id === shelfNumber);
    
    //     if (shelfIndex !== -1) {
    //         // Toggle or update the shelf's type
    //         const currentShelf = updatedShelves[shelfIndex];
    //         if (currentShelf.type === "empty_plate") {
    //             updatedShelves[shelfIndex] = {
    //                 ...currentShelf,
    //                 type: "", // Clear the type
    //                 occupied: false,
    //             };
    //         } else {
    //             updatedShelves[shelfIndex] = {
    //                 ...currentShelf,
    //                 type: "empty_plate", // Assign an empty plate
    //                 occupied: true,
    //             };
    //         }
    //     } else {
    //         // If the shelf doesn't exist, create it and assign a default type
    //         updatedShelves.push({
    //             id: shelfNumber,
    //             type: "empty_plate",
    //             occupied: true,
    //         });
    //     }
    
    //     setTempShelf(updatedShelves); // Update the state
    //     setSelectedShelf(shelfNumber); // Update the selected shelf
    //     rackVisualisation(value); // Ensure the visualization is updated
    // };
    const handleShelfClick = (shelfNumber: number) => {
        setTempShelf(prev => {
          const next = [...prev];
          const idx = next.findIndex(shelf => shelf.id === shelfNumber);
          if (idx !== -1) {
            const cur = next[idx];
            next[idx] = cur.type === "empty_plate"
              ? { ...cur, type: "", occupied: false }
              : { ...cur, type: "empty_plate", occupied: true };
          } else {
            next.push({ id: shelfNumber, type: "empty_plate", occupied: true });
          }
          return next;
        });
        setSelectedShelf(shelfNumber);
    };

    // useEffect(() => {
    //     generateRackId();
    //     setValue(minValue);
    //     const initializedShelves = Array(value)
    //         .fill(null)
    //         .map((_, index) => ({
    //             id: index + 1,
    //             type: tempShelf[index]?.type || "", // Preserve existing shelf type if available
    //             occupied: tempShelf[index]?.occupied || false, // Preserve existing occupied state
    //         }));

    //     setTempShelf(initializedShelves); // Update tempShelf state
    //     rackVisualisation(); // Update rack visualization
    // }, [ottorackAddModalOpen]);

    // useEffect(() => {
    //     if (ottorackAddModalOpen) {
            
            
    //         if(tempShelf.length === 0){
    //             setValue(minValue); // Default to 1 shelf
    //             const initializedShelves = Array(minValue) // Default to 1 shelf
    //                 .fill(null)
    //                 .map((_, index) => ({
    //                     id: index + 1,
    //                     type: tempShelf[index]?.type || "", // Preserve existing shelf type if available
    //                     occupied: tempShelf[index]?.occupied || false, // Preserve existing occupied state
    //                 }));
    //             setTempShelf(initializedShelves || []); // Ensure initializedShelves is not undefined
    //         }

            
    //         rackVisualisation(value); // Update rack visualization with default value
    //     }
    // }, [ottorackAddModalOpen, tempShelf]);

     useEffect(() => {
           setTempShelf(prev => {
             const next = [...prev];
             while (next.length < value) {
               next.push({ id: next.length + 1, type: "", occupied: false });
             }
             if (next.length > value) {
               next.splice(value);
             }
             // normalize ids 1..value
             return next.map((s, i) => ({ ...s, id: i + 1 }));
           });
         }, [value]);

    // return (
    //     <Modal
    //         isOpen={ottorackAddModalOpen}
    //         className="pf-custom-new-ottorack-modal"
    //         aria-label="newOttorack"
    //     >
    //         <PageSection className="pf-custom-new-ottorack">
    //             <ModalHeader className="pf-custom-upload-header">
    //                 <Content component={ContentVariants.h3}>
    //                     {/* <Brand src={ottoEjectIcon} alt="ottorack logo" className='pf-custom-modal-icon' /> */}
    //                     {' ADD NEW ottorack'}</Content>
    //             </ModalHeader>
    //             <Grid hasGutter>
    //                 <GridItem span={8}>
    //                     <Form isHorizontal className="pf-custom-text-align-left">

    //                         <Grid>
    //                             <GridItem span={3}>
    //                                 <Content>{'NAME:'}</Content>
    //                             </GridItem>
    //                             <GridItem span={8}>
    //                                 <TextInput
    //                                     id='ottorack-name'
    //                                     placeholder=""
    //                                     value={tempOttorack?.name || ''}
    //                                     onChange={(_event, value: string) => setTempOttorack({ ...tempOttorack, name: value })}
    //                                 />
    //                             </GridItem>
    //                         </Grid>

    //                         <div className="pf-c-form-group">
    //                             <span className="pf-custom-border-label">{'SHELF CONFIGURATION: '}</span>
    //                             <Grid>
    //                                 <GridItem span={3}>
    //                                     <Content>{'SHELVES:'}</Content>
    //                                 </GridItem>
    //                                 <GridItem span={8}>
    //                                     {/* <TextInputGroup>
    //                                         <TextInputGroupMain id='ottorack-shelves' value={tempOttorack?.shelves} onChange={(_event, value: any) => setTempOttorack({ ...tempOttorack, shelves: value })} />
    //                                     </TextInputGroup> */}
    //                                     {<NumberInput
    //                                         value={value}
    //                                         min={minValue}
    //                                         max={maxValue}
    //                                         onMinus={onMinus}
    //                                         // onChange={onChange}
    //                                         // onBlur={onBlur}
    //                                         onPlus={onPlus}
    //                                         inputName="input"
    //                                         inputAriaLabel="number input"
    //                                         minusBtnAriaLabel="minus"
    //                                         plusBtnAriaLabel="plus"
    //                                     />}

    //                                 </GridItem>
    //                             </Grid>
    //                         </div>
    //                     </Form>
    //                 </GridItem>

    //                 {/* <GridItem span={4}>
    //                     <FormGroup>
    //                         <Content component={ContentVariants.h6}>{'THUMBNAIL'}</Content>
    //                         <Brand src={thumbnail} alt={"ottorack thumbnail"} className="pf-custom-thumbnail" />
    //                     </FormGroup>
    //                 </GridItem> */}

    //                 <GridItem span={4} className="pf-custom-rack-render">
    //                     {rackVis}
    //                 </GridItem>
    //             </Grid>

    //             <ModalFooter className="pf-custom-new-ottorack-modal-footer">
    //                 <Button
    //                     variant="danger"
    //                     onClick={() => { setIsOttorackAddModalOpen(false) }}
    //                 >
    //                     {'Cancel'}
    //                 </Button>
    //                 <Button
    //                     className="pf-custom-button"
    //                     onClick={() => {
    //                         console.log(tempOttorack);
    //                         updateOttorackList(tempOttorack);
    //                     }}
    //                 >
    //                     {'ADD'}
    //                 </Button>
    //             </ModalFooter>
    //         </PageSection>
    //         {errorMessage && <p style={{ color: "red" }}>{errorMessage}</p>}

    //         {/* Shelf Details Modal */}
    //         <ShelfDetailsModal
    //             isOpen={isShelfModalOpen}
    //             onClose={() => setIsShelfModalOpen(false)}
    //             shelfNumber={selectedShelf}
    //             printJobDetails={printJobDetails}
    //         />
    //     </Modal>
    // );

    return (
        <Modal
            isOpen={ottorackAddModalOpen}
            className="pf-custom-new-ottorack-modal"
            aria-label="newOttorack"
        >
        <PageSection className="pf-custom-new-ottorack">
            <ModalHeader className="pf-custom-upload-header">
                <Content component={ContentVariants.h3}>
                    {'ADD NEW OTTOrack'}
                </Content>
            </ModalHeader>
            <Grid hasGutter>
                <GridItem span={8}>
                    <Form isHorizontal>
                        <Grid>
                            <GridItem span={3}>
                                <Content>{'NAME:'}</Content>
                            </GridItem>
                            <GridItem span={9}>
                                <TextInput
                                    id="ottorack-name"
                                    placeholder="Enter name"
                                    value={tempOttorack?.name || ''}
                                    onChange={(_event, value: string) =>
                                        setTempOttorack({ ...tempOttorack, name: value })
                                    }
                                />
                            </GridItem>
                        </Grid>
                        <Grid>
                            <GridItem span={3}>
                                <Content>{'SHELVES:'}</Content>
                            </GridItem>
                            <GridItem span={9}>
                                <NumberInput
                                    value={value}
                                    min={minValue}
                                    max={maxValue}
                                    onMinus={onMinus}
                                    onPlus={onPlus}
                                    inputName="input"
                                    inputAriaLabel="number input"
                                    minusBtnAriaLabel="minus"
                                    plusBtnAriaLabel="plus"
                                />
                            </GridItem>
                        </Grid>
                        <Grid>
                            <GridItem span={3}>
                                <Content>{'BED SIZE:'}</Content>
                            </GridItem>
                            <GridItem span={9}>
                                <select
                                    id="ottorack-bed-size"
                                    value={tempOttorack?.bedSize || ''}
                                    onChange={(event) =>
                                        setTempOttorack({ ...tempOttorack, bedSize: event.target.value })
                                    }
                                    className="pf-custom-dropdown"
                                >
                                    <option value="150 x 150">150 x 150</option>
                                    <option value="256 x 256">256 x 256</option>
                                </select>
                            </GridItem>
                        </Grid>
                        <Grid>
                            <GridItem span={3}>
                                <Content>{'SHELF SPACING:'}</Content>
                            </GridItem>
                            <GridItem span={9}>
                                <TextInput
                                    id="ottorack-shelf-spacing"
                                    placeholder="Enter spacing in mm"
                                    value={tempOttorack?.shelfSpacingMm || ''}
                                    onChange={(_event, value: string) =>
                                        setTempOttorack({ ...tempOttorack, shelfSpacingMm: value })
                                    }
                                />
                            </GridItem>
                        </Grid>
                    </Form>
                </GridItem>
                <GridItem span={4} className="pf-custom-rack-render">
                    {/* {rackVis} */}
                        <RackVisualizer
                            shelves={tempShelf}
                            count={value}
                            onTypeChange={handleShelfTypeChange}
                            onShelfClick={handleShelfClick}
                        />
                </GridItem>
            </Grid>
            <ModalFooter>
                <Button
                    variant="danger"
                    onClick={() => setIsOttorackAddModalOpen(false)}
                >
                    {'Cancel'}
                </Button>
                <Button
                    variant="primary"
                    onClick={() => updateOttorackList(tempOttorack)}
                >
                    {'Save'}
                </Button>
            </ModalFooter>
        </PageSection>
        {errorMessage && <p style={{ color: "red" }}>{errorMessage}</p>}
        <ShelfDetailsModal
            isOpen={isShelfModalOpen}
            onClose={() => setIsShelfModalOpen(false)}
            shelfNumber={selectedShelf}
            printJobDetails={printJobDetails}
        />
    </Modal>
    );
}
