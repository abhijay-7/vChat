import { useEffect, useState } from "react"
import useWsStore from "./store/wsStore";


const MsgCount = ()=>{
    const [count, setCount] = useState(0);
    const socket = useWsStore(state =>state.socket);
    
    useEffect(()=>{
        function onMsg(){
            setCount(count+1);
        }
        socket.on("message", onMsg);
        return ()=> (
            socket.off("message", onMsg)
        );
    })


    return (
        <>
            <div>
                Msgcount : {count}
            </div>
        </>
    )
}

export default MsgCount