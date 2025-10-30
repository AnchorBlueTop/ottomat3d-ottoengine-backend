import React, { memo } from "react";
import { Grid, GridItem, PageSection } from "@patternfly/react-core";
// import uploadPrintFile from "./modals/UploadPrintFile";
import newPrintJob from "./modals/newPrintJob";
import { Printers } from "./Printers";
import { Ottoeject } from "./OttoEject";
import { Job } from "./Jobs";

// export default function Dashboard() {
//     // COMMENT TEMPOARILY
//     // APILoader();

//     return (
//         <>
//             <Grid>
//                 <PageSection id='top-toolbar' className="pf-custom-top-toolbar">
//                     {/* {AddNewPrintJobButton()} */}
//                 </PageSection>
//                 <Grid hasGutter>
//                     <GridItem className="pf-c-overflow-auto" span={7} rowSpan={2}>
//                         <PageSection isWidthLimited className="pf-c-dashboard-jobs">
//                             <Job />
//                         </PageSection>
//                     </GridItem>
//                     <GridItem span={5}>
//                         <Grid hasGutter>
//                             <GridItem className="pf-c-overflow-auto" span={12}>
//                                 <Printers />
//                             </GridItem>
//                             <GridItem className="pf-c-overflow-auto" span={12}>
//                                 <Ottoeject />
//                             </GridItem>
//                         </Grid>
//                     </GridItem>
//                 </Grid>

//             </Grid>
//             {newPrintJob()}
//             {uploadPrintFile()}
//         </>
//     )
// }

function Dashboard() {
    // COMMENT TEMPOARILY
    // APILoader();
  
    return (
      <>
        <Grid>
          <PageSection id="top-toolbar" className="pf-custom-top-toolbar">
            {/* {AddNewPrintJobButton()} */}
          </PageSection>
          <Grid hasGutter>
            <GridItem className="pf-c-overflow-auto" span={7} rowSpan={2}>
              <PageSection isWidthLimited className="pf-c-dashboard-jobs">
                <Job />
              </PageSection>
            </GridItem>
            <GridItem span={5}>
              <Grid hasGutter>
                <GridItem className="pf-c-overflow-auto" span={12}>
                  <Printers />
                </GridItem>
                <GridItem className="pf-c-overflow-auto" span={12}>
                  <Ottoeject />
                </GridItem>
              </Grid>
            </GridItem>
          </Grid>
        </Grid>
      </>
    );
  }
  
  export default memo(Dashboard);