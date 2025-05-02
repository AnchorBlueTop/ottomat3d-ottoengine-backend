import { moonraker } from "./listAPI";
import { JobContext } from "./App";
import { useContext, useEffect, useState } from "react";
import printerRepresentation from "./printerRepresentation";

export default function APILoader() {
    const {setPrinter} = useContext(JobContext);
    const [refresh] = useState(false);

    const fetchPrinterStatus = () => {
        new moonraker().fetchPrinterInfo(
            // "http://pi33.local"
            "http://pi.local"
        ).then((element: any) => {
            return setPrinter(element);
        }).catch(() => {
            console.log('error with - fetchPrinterStatus');
        })
    };




    // fetchPrinterStatus();

    useEffect(() => {
        fetchPrinterStatus();
    }, [refresh]);
}